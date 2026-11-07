import { useEffect, useRef, useState } from "react";
import VideoUploader from "../components/VideoUploader.jsx";
import ProcessingStatus from "../components/ProcessingStatus.jsx";
import FishCountCards from "../components/FishCountCards.jsx";
import FishAbundanceChart from "../components/FishAbundanceChart.jsx";
import ResultVideo from "../components/ResultVideo.jsx";
import { uploadVideo, getAnalysis } from "../services/api.js";

const SPECIES_INFO = [
  { name: "Diplodus sargus", traits: "Thân dẹt, màu bạc; thường có các sọc dọc sẫm trên thân và một mảng đen gần cuống đuôi." },
  { name: "Dentex dentex", traits: "Thân bầu dục dẹt bên; loài trưởng thành có răng nanh lớn ở phía trước hai hàm." },
  { name: "Diplodus vulgaris", traits: "Thân bạc hơi xám; thường có hai dải đen, một gần đầu và một gần cuống đuôi." },
  { name: "Loài khác / chưa xác định", traits: "Cá không thuộc ba loài mục tiêu hoặc hình ảnh chưa đủ rõ để phần mềm phân loại chắc chắn." }
];

function SpeciesInfoPanel() {
  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">THÔNG TIN THAM KHẢO</span><h2>Các nhóm cá trong kết quả</h2></div></div>
    <div className="species-info-grid">{SPECIES_INFO.map(species=><article className="species-info-card" key={species.name}><h3>{species.name}</h3><p>{species.traits}</p></article>)}</div>
    <p className="note">Đây là thông tin để tham khảo. Kết quả phụ thuộc vào góc quay, ánh sáng và chất lượng video; phần mềm có thể phân loại nhầm.</p>
  </section>;
}

function VideoRecognitionPanel({ item }) {
  const value = Number.isFinite(Number(item?.recognitionConfidencePercent)) ? Number(item.recognitionConfidencePercent) : 0;
  const assessment = item?.recognitionAssessment || {};
  return <section className="panel">
    <span className="eyebrow">ĐÁNH GIÁ CỦA PHẦN MỀM</span>
    <h2>Mức độ ổn định khi nhận diện</h2>
    <div className="recognition-score-row">
      <div className="recognition-score" style={{"--score": `${Math.max(0, Math.min(100, value))}%`, "--score-color": assessment.color || "#087f87"}}>
        <div><strong>{value.toFixed(1)}%</strong><span>mức tham khảo</span></div>
      </div>
      <div className="recognition-details"><strong>{assessment.label || "Mức độ ổn định"}</strong><p>{assessment.description || "Mức đánh giá tham khảo cho video này."}</p></div>
    </div>
    <p className="note">Đây là mức tham khảo do phần mềm tự đánh giá, không phải tỷ lệ nhận diện chính xác đã được kiểm chứng.</p>
  </section>;
}

export default function Home({ initialId=null, user, onLogin }) {
  const [item,setItem]=useState(null);
  const [busy,setBusy]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  const [error,setError]=useState("");
  const pollRef=useRef(null);

  useEffect(()=>{
    if(initialId)refresh(initialId);
    return ()=>clearInterval(pollRef.current);
  },[initialId]);

  async function refresh(id) {
    try {
      const next=await getAnalysis(id);
      setItem(next);
      if(["completed","failed"].includes(next.status))clearInterval(pollRef.current);
    } catch(e) { setError(e.response?.data?.message||e.message); }
  }

  async function submit(file) {
    setBusy(true);setError("");setItem(null);setUploadProgress(0);
    try {
      const created=await uploadVideo(file,e=>setUploadProgress(e.total?Math.round(e.loaded/e.total*100):0));
      setItem(created);setBusy(false);clearInterval(pollRef.current);
      pollRef.current=setInterval(()=>refresh(created.id),2500);
      await refresh(created.id);
    } catch(e) { setError(e.response?.data?.message||e.message||"Tải video lên thất bại.");setBusy(false); }
  }

  return <div className="home-grid">
    <div className="main-column">
      <VideoUploader onSubmit={submit} busy={busy}/>
      {!user&&<p className="guest-note">Bạn có thể dùng thử mà không cần đăng nhập. <button className="text-link" onClick={onLogin}>Đăng nhập hoặc tạo tài khoản</button> để lưu lịch sử.</p>}
      {error&&<p className="error">{error}</p>}
      {item&&<ProcessingStatus item={item} uploadProgress={uploadProgress}/>}
      {item?.status==="completed"&&<>
        <VideoRecognitionPanel item={item}/>
        <FishCountCards item={item}/>
        <FishAbundanceChart data={item.timelineData||[]}/>
        <SpeciesInfoPanel/>
      </>}
      {item&&<ResultVideo id={item.id} ready={item.status==="completed"&&item.hasProcessedVideo}/>}
    </div>
    <aside className="side-column">
      <section className="panel guide-panel"><span className="eyebrow">CÁCH SỬ DỤNG</span><h3>Xem kết quả video</h3><ol>
        <li>Tải video lên để bắt đầu.</li>
        <li>Chờ phần mềm xem hết video và nhận diện các nhóm cá.</li>
        <li>Xem tổng số cá, số cá theo từng nhóm loài và video có đánh dấu.</li>
      </ol></section>
    </aside>
  </div>;
}
