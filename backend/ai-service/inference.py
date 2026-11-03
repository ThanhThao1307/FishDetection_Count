import csv
import os
import subprocess
import time
from pathlib import Path
from collections import Counter, defaultdict
import cv2
import imageio_ffmpeg
import numpy as np
import torch
from PIL import Image
from torchvision import models, transforms
from torch import nn
from ultralytics import YOLO

TARGET_CLASSES = ["Diplodus sargus", "Dentex dentex", "Diplodus vulgaris"]
OTHER_CLASS = "Other_Unidentified"
SPECIES = TARGET_CLASSES + [OTHER_CLASS]
COLORS = {
    "Diplodus sargus": (0, 220, 0),
    "Dentex dentex": (255, 140, 0),
    "Diplodus vulgaris": (0, 215, 255),
    "Other_Unidentified": (0, 69, 255)
}
IMG_SIZE = 224
MIN_TRACK_FRAMES = int(os.getenv("MIN_TRACK_FRAMES", "12"))
CONF_DET_THRESH = float(os.getenv("CONF_DET_THRESH", "0.25"))
IOU_TRACK_THRESH = float(os.getenv("IOU_TRACK_THRESH", "0.50"))
CNN_UNCERTAIN_PROB = float(os.getenv("CNN_UNCERTAIN_PROB", "0.55"))
CNN_MARGIN_THRESH = float(os.getenv("CNN_MARGIN_THRESH", "0.12"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def apply_clahe(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

def letterbox_crop(img_pil, size=IMG_SIZE):
    w, h = img_pil.size
    if not w or not h:
        return Image.new("RGB", (size, size), (124, 116, 104))
    side = max(w, h)
    padded = Image.new("RGB", (side, side), (124, 116, 104))
    padded.paste(img_pil, ((side-w)//2, (side-h)//2))
    return padded.resize((size, size), Image.Resampling.BILINEAR)

def make_cnn(checkpoint_path):
    ckpt = torch.load(checkpoint_path, map_location=DEVICE, weights_only=True)
    classes = ckpt.get("classes")
    if list(classes or []) != SPECIES:
        raise ValueError(f"CNN checkpoint classes mismatch. Expected {SPECIES}; found {classes}")
    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(SPECIES))
    model.load_state_dict(ckpt["model_state"], strict=True)
    model.to(DEVICE).eval()
    return model

def run_inference(video_path: Path, storage_root: Path, yolo_weights: Path, cnn_weights: Path, progress_callback=None):
    if not video_path.is_file():
        raise FileNotFoundError(f"Input video not found: {video_path}")
    processed_dir = storage_root / "processed"
    reports_dir = storage_root / "reports"
    processed_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)
    run_id = f"{video_path.stem}_{int(time.time())}"
    out_path = processed_dir / f"{run_id}_tracked.mp4"
    intermediate_path = processed_dir / f"{run_id}_tracked_intermediate.mp4"
    report_path = reports_dir / f"{run_id}_census.csv"
    tracks_path = reports_dir / f"{run_id}_tracks.csv"
    timeline_path = reports_dir / f"{run_id}_timeline.csv"

    detector = YOLO(str(yolo_weights))
    cnn = make_cnn(cnn_weights)
    tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError("OpenCV could not open the uploaded video.")
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not np.isfinite(fps) or fps <= 0: fps = 25.0
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        raise RuntimeError("Video reports zero frames.")
    writer = cv2.VideoWriter(str(intermediate_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        cap.release()
        raise RuntimeError("Could not create output MP4. Check codec/storage permissions.")

    history = defaultdict(lambda: {"frames": [], "probs": [], "det_confs": []})
    maxn_by_species = {s: 0 for s in SPECIES}
    maxn_total_concurrent = 0
    maxn_total_target = 0
    second_records = defaultdict(lambda: Counter())
    frame_idx = 0
    batch_size = 32 if DEVICE == "cuda" else 8
    try:
        while True:
            ok, frame = cap.read()
            if not ok: break
            proc = apply_clahe(frame)
            result = detector.track(proc, persist=True, tracker="bytetrack.yaml", conf=CONF_DET_THRESH, iou=IOU_TRACK_THRESH, verbose=False)[0]
            frame_counts = Counter()
            crop_tensors, crop_meta = [], []
            boxes_obj = result.boxes
            if boxes_obj is not None and len(boxes_obj):
                boxes = boxes_obj.xyxy.detach().cpu().numpy().astype(int)
                det_confs = boxes_obj.conf.detach().cpu().numpy().astype(float)
                ids = boxes_obj.id.detach().cpu().numpy().astype(int) if boxes_obj.id is not None else None
                for i, (xyxy, det_conf) in enumerate(zip(boxes, det_confs)):
                    x1,y1,x2,y2 = map(int, xyxy)
                    x1=max(0,min(x1,width-1)); x2=max(0,min(x2,width))
                    y1=max(0,min(y1,height-1)); y2=max(0,min(y2,height))
                    if x2-x1 < 10 or y2-y1 < 10: continue
                    crop = proc[y1:y2,x1:x2]
                    pil = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
                    crop_tensors.append(tf(letterbox_crop(pil)))
                    crop_meta.append((x1,y1,x2,y2,float(det_conf),int(ids[i]) if ids is not None else None))
            probs_all=[]
            if crop_tensors:
                with torch.inference_mode():
                    for start in range(0,len(crop_tensors),batch_size):
                        batch=torch.stack(crop_tensors[start:start+batch_size]).to(DEVICE)
                        logits = cnn(batch)
                        probs_all.extend(torch.softmax(logits,dim=1).cpu().numpy())
            for crop_index, (meta, probs) in enumerate(zip(crop_meta, probs_all)):
                x1,y1,x2,y2,dconf,tid=meta
                order=np.argsort(probs); top1=int(order[-1]); top2=int(order[-2])
                conf=float(probs[top1]); margin=conf-float(probs[top2])
                species=SPECIES[top1] if conf>=CNN_UNCERTAIN_PROB and margin>=CNN_MARGIN_THRESH else OTHER_CLASS
                frame_counts[species]+=1
                if tid is not None:
                    h=history[tid]; h["frames"].append(frame_idx); h["probs"].append(probs); h["det_confs"].append(dconf)
                color=COLORS[species]
                cv2.rectangle(frame,(x1,y1),(x2,y2),color,2)
                display_species="Other / unclassified" if species == OTHER_CLASS else species
                label=f"{display_species} {round(conf*100)}%"
                (tw,th),_=cv2.getTextSize(label,cv2.FONT_HERSHEY_SIMPLEX,0.45,1)
                ytop=max(18,y1-18)
                cv2.rectangle(frame,(x1,ytop),(min(width-1,x1+tw+4),y1),color,-1)
                cv2.putText(frame,label,(x1+2,max(14,y1-4)),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,0,0),1,cv2.LINE_AA)
            current_total=sum(frame_counts.values())
            current_target=sum(frame_counts[s] for s in TARGET_CLASSES)
            maxn_total_concurrent=max(maxn_total_concurrent,current_total)
            maxn_total_target=max(maxn_total_target,current_target)
            for s in SPECIES: maxn_by_species[s]=max(maxn_by_species[s],frame_counts[s])
            sec=int(frame_idx/fps)
            for s in SPECIES: second_records[sec][s]=max(second_records[sec][s],frame_counts[s])
            second_records[sec]["totalConcurrent"] = max(second_records[sec]["totalConcurrent"], current_total)
            second_records[sec]["totalTarget"] = max(second_records[sec]["totalTarget"], current_target)
            # Show the count visible in this frame, without specialist metrics.
            overlay=frame.copy()
            cv2.rectangle(overlay,(10,10),(430,175),(20,35,45),-1)
            cv2.addWeighted(overlay,0.78,frame,0.22,0,frame)
            cv2.putText(frame,"FISH SEEN IN THIS FRAME",(22,34),cv2.FONT_HERSHEY_SIMPLEX,0.55,(255,255,255),1,cv2.LINE_AA)
            cv2.putText(frame,f"Total: {current_total}",(22,56),cv2.FONT_HERSHEY_SIMPLEX,0.48,(220,230,235),1,cv2.LINE_AA)
            yy=82
            for s in SPECIES:
                label="Other / unclassified" if s == OTHER_CLASS else s
                cv2.putText(frame,f"{label}: {frame_counts[s]}",(22,yy),cv2.FONT_HERSHEY_SIMPLEX,0.4,COLORS[s],1,cv2.LINE_AA); yy+=22
            writer.write(frame)
            frame_idx+=1
            if progress_callback and (frame_idx % max(1,int(fps*2)) == 0 or frame_idx==total_frames):
                progress_callback(min(95,round(5+90*frame_idx/total_frames)),"inference")
    finally:
        cap.release(); writer.release()

    if progress_callback: progress_callback(96,"encoding_video")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    try:
        encoded = subprocess.run(
            [
                ffmpeg, "-y", "-nostdin", "-hide_banner", "-loglevel", "error",
                "-i", str(intermediate_path), "-an",
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                str(out_path)
            ],
            capture_output=True,
            text=True,
            check=False
        )
    except OSError as error:
        intermediate_path.unlink(missing_ok=True)
        out_path.unlink(missing_ok=True)
        raise RuntimeError(f"Không thể khởi chạy bộ chuyển mã video: {error}") from error
    intermediate_path.unlink(missing_ok=True)
    if encoded.returncode != 0 or not out_path.is_file() or out_path.stat().st_size == 0:
        out_path.unlink(missing_ok=True)
        detail = encoded.stderr.strip()[-1000:] or f"FFmpeg exited with code {encoded.returncode}."
        raise RuntimeError(f"Không thể chuyển video kết quả sang định dạng phát trên trình duyệt: {detail}")

    track_rows=[]
    for tid,item in history.items():
        if len(item["frames"]) < MIN_TRACK_FRAMES: continue
        mean_probs=np.mean(item["probs"],axis=0)
        order=np.argsort(mean_probs)
        idx=int(order[-1]); second_idx=int(order[-2])
        pooled_conf=float(mean_probs[idx]); pooled_margin=pooled_conf-float(mean_probs[second_idx])
        final_species=SPECIES[idx] if pooled_conf>=CNN_UNCERTAIN_PROB and pooled_margin>=CNN_MARGIN_THRESH else OTHER_CLASS
        track_rows.append({
            "track_id":int(tid), "final_species":final_species,
            "species_conf":pooled_conf, "total_frames":len(item["frames"]),
            "duration_seconds":len(item["frames"])/fps,
            "start_frame":int(item["frames"][0]), "end_frame":int(item["frames"][-1]),
            "mean_det_conf":float(np.mean(item["det_confs"]))
        })
    track_counts=Counter(r["final_species"] for r in track_rows)
    timeline=[]
    for sec in range(int(np.ceil(frame_idx/fps))):
        row={"second":sec}
        for s in SPECIES: row[s]=int(second_records[sec][s])
        row["totalConcurrent"]=int(second_records[sec]["totalConcurrent"])
        row["totalTarget"]=int(second_records[sec]["totalTarget"])
        timeline.append(row)

    with open(report_path,"w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(["species","maxN","trackCount","category"])
        for s in SPECIES: w.writerow([s,maxn_by_species[s],track_counts[s],"target" if s in TARGET_CLASSES else "other"])
        w.writerow(["totalTargetMaxN",maxn_total_target,"","target_total"])
        w.writerow(["totalConcurrentMaxN",maxn_total_concurrent,"","all_species_total"])
    with open(tracks_path,"w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=["track_id","final_species","species_conf","total_frames","duration_seconds","start_frame","end_frame","mean_det_conf"])
        w.writeheader(); w.writerows(track_rows)
    with open(timeline_path,"w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=["second",*SPECIES,"totalConcurrent","totalTarget"])
        w.writeheader(); w.writerows(timeline)

    # Match the per-video evaluation formula from FishCount.ipynb (Cell 8):
    # 50% track-label consistency + 30% mean class confidence + 20% top-1/top-2 margin.
    # This is a model-derived estimate, not verified accuracy against human ground truth.
    recognition_tier = "POOR"
    recognition_label = "Độ tin cậy thấp / Cần kiểm tra lại"
    recognition_description = "Mô hình có thể dao động nhãn hoặc gặp khó khăn khi nhận diện; nên kiểm tra lại video và kết quả thống kê."
    recognition_color = "#dc3545"
    if not track_rows:
        recognition_percent = 0.0
        recognition_tier = "NO_FISH"
        recognition_label = "Chưa ghi nhận track cá hợp lệ"
        recognition_description = "Video đã được xử lý nhưng không có track cá đủ điều kiện sau bước lọc. Điểm đánh giá được hiển thị là 0% vì chưa có đủ đối tượng theo dõi để đánh giá độ ổn định."
        recognition_color = "#808080"
    else:
        consistency_scores = []
        margin_scores = []
        for item in history.values():
            if len(item["frames"]) < 5:
                continue
            prob_matrix = np.asarray(item["probs"], dtype=float)
            frame_preds = np.argmax(prob_matrix, axis=1)
            dominant_count = int(np.max(np.bincount(frame_preds, minlength=len(SPECIES))))
            consistency_scores.append(dominant_count / len(frame_preds))
            sorted_probs = np.sort(prob_matrix, axis=1)
            margin_scores.append(float(np.mean(sorted_probs[:, -1] - sorted_probs[:, -2])))
        avg_confidence = float(np.mean([r["species_conf"] for r in track_rows]))
        if consistency_scores:
            composite = (0.50 * float(np.mean(consistency_scores))) + (0.30 * avg_confidence) + (0.20 * float(np.mean(margin_scores)))
        else:
            composite = avg_confidence
        recognition_percent = round(float(np.clip(composite, 0.0, 1.0)) * 100, 1)
        if recognition_percent >= 85.0:
            recognition_tier = "EXCELLENT"
            recognition_label = "Độ tin cậy cao (Nhận diện rất tốt)"
            recognition_description = "Các nhãn dự đoán có độ ổn định và độ tin cậy tương đối cao trong video này. Đây vẫn là điểm ước tính, không phải độ chính xác đã được xác minh bằng nhãn chuẩn."
            recognition_color = "#28a745"
        elif recognition_percent >= 70.0:
            recognition_tier = "GOOD"
            recognition_label = "Độ tin cậy khá (Nhận diện tốt)"
            recognition_description = "Phần lớn dự đoán có tín hiệu tương đối ổn định; kết quả thống kê vẫn có thể có sai số."
            recognition_color = "#17a2b8"
        elif recognition_percent >= 50.0:
            recognition_tier = "FAIR"
            recognition_label = "Độ tin cậy trung bình"
            recognition_description = "Mô hình có dấu hiệu phân vân hoặc thay đổi nhãn ở một số khung hình; nên kiểm tra lại kết quả."
            recognition_color = "#ffc107"

    if progress_callback: progress_callback(99,"writing_results")
    return {
        "videoDurationSeconds": round(frame_idx/fps,3), "totalFrames": int(frame_idx),
        "maxN": {"bySpecies": {s:int(maxn_by_species[s]) for s in SPECIES},
                 "totalTarget":int(maxn_total_target), "totalConcurrent":int(maxn_total_concurrent)},
        "trackCounts":{"bySpecies":{s:int(track_counts[s]) for s in SPECIES},"totalTracks":int(sum(track_counts.values()))},
        "recognitionConfidencePercent": recognition_percent,
        "recognitionAssessment": {"tier": recognition_tier, "label": recognition_label, "description": recognition_description, "color": recognition_color,
            "method": "50% độ nhất quán nhãn theo track + 30% confidence phân loại trung bình + 20% chênh lệch xác suất top-1/top-2; theo Cell 8 của FishCount.ipynb."},
        "timelineData":timeline,
        "relativeDensity": {
            "valuePerMegapixel": round(float(maxn_total_concurrent) / max((width * height) / 1_000_000.0, 1e-9), 4),
            "maxConcurrent": int(maxn_total_concurrent), "frameWidth": int(width), "frameHeight": int(height),
            "method": "MaxN đồng thời trên mỗi megapixel ảnh; chỉ số tương đối phụ thuộc độ phân giải, không phải cá/m²."
        },
        "processedVideoPath":str(out_path.resolve()), "reportCsvPath":str(report_path.resolve()), "trackCsvPath":str(tracks_path.resolve()),
        "timelineCsvPath":str(timeline_path.resolve())
    }
