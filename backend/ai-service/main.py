import os
import hmac
import uuid
import threading
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, Header, HTTPException
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from inference import run_inference, SPECIES

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")
STORAGE_ROOT_SETTING = Path(os.getenv("STORAGE_ROOT", "../storage"))
STORAGE_ROOT = (BACKEND_DIR / STORAGE_ROOT_SETTING).resolve()
WEIGHTS_DIR = Path(os.getenv("WEIGHTS_DIR", BASE_DIR / "weights")).resolve()
YOLO_WEIGHTS = Path(os.getenv("YOLO_WEIGHTS", WEIGHTS_DIR / "fish_yolo_4species_best.pt")).resolve()
CNN_WEIGHTS = Path(os.getenv("CNN_WEIGHTS", WEIGHTS_DIR / "fish_resnet18_4species_best.pt")).resolve()
SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "change-this-local-secret")
app = FastAPI(title="Fish Census AI Service", version="1.0.0")
tasks = {}
task_lock = threading.Lock()
gpu_lock = threading.Lock()  # Avoid overlapping inference tasks on one GPU/model runtime.

class TaskRequest(BaseModel):
    analysisId: str = Field(min_length=1, max_length=100)
    videoPath: str = Field(min_length=1)

def check_token(value: Optional[str]):
    if not hmac.compare_digest(value or "", SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid AI service token.")

def worker(task_id: str, video_path: Path):
    try:
        with gpu_lock:
            def progress_callback(percent, stage):
                with task_lock:
                    tasks[task_id].update({"progress": int(percent), "stage": stage, "status": "processing"})
            result = run_inference(
                video_path=video_path, storage_root=STORAGE_ROOT,
                yolo_weights=YOLO_WEIGHTS, cnn_weights=CNN_WEIGHTS,
                progress_callback=progress_callback
            )
        with task_lock:
            tasks[task_id].update({"status": "completed", "progress": 100, "stage": "completed", "result": result})
    except Exception as exc:
        with task_lock:
            tasks[task_id].update({"status": "failed", "stage": "failed", "error": str(exc), "progress": 0})

@app.get("/health")
def health():
    return {"ok": True, "weights": {"yoloExists": YOLO_WEIGHTS.is_file(), "cnnExists": CNN_WEIGHTS.is_file()}}

@app.post("/tasks", status_code=202)
def create_task(body: TaskRequest, background_tasks: BackgroundTasks, x_service_token: Optional[str] = Header(default=None)):
    check_token(x_service_token)
    video_path = Path(body.videoPath).resolve()
    allowed_root = (STORAGE_ROOT / "uploads").resolve()
    if not str(video_path).startswith(str(allowed_root) + os.sep) or not video_path.is_file():
        raise HTTPException(status_code=400, detail="Video path is outside uploads storage or does not exist.")
    if not YOLO_WEIGHTS.is_file() or not CNN_WEIGHTS.is_file():
        raise HTTPException(status_code=503, detail=f"Missing model weights. Expected {YOLO_WEIGHTS} and {CNN_WEIGHTS}.")
    task_id = body.analysisId
    with task_lock:
        if task_id in tasks:
            raise HTTPException(status_code=409, detail="Task already exists.")
        tasks[task_id] = {"taskId": task_id, "status": "processing", "progress": 0, "stage": "queued", "result": None, "error": None}
    background_tasks.add_task(worker, task_id, video_path)
    return {"taskId": task_id, "status": "processing", "progress": 0, "stage": "queued"}

@app.get("/tasks/{task_id}")
def get_task(task_id: str, x_service_token: Optional[str] = Header(default=None)):
    check_token(x_service_token)
    with task_lock:
        task = tasks.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found in this AI service process.")
        return task
