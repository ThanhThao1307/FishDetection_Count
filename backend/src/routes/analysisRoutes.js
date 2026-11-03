import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { STORAGE_ROOT } from "../storage.js";
import {
  createAnalysis, getAnalysis, listAnalyses, getTimeline, getProcessedVideoAccess, getProcessedVideo, deleteAnalysis
} from "../controllers/analysisController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const router = Router();
const ROOT = STORAGE_ROOT;
const UPLOAD_DIR = path.join(ROOT, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 500);
const allowedExt = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".mpeg", ".mpg"]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage, limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.has(ext) || !["video/mp4", "video/quicktime", "video/x-matroska", "video/x-msvideo", "video/webm", "video/mpeg", "application/octet-stream"].includes(file.mimetype)) {
      return cb(new Error("Định dạng video không được hỗ trợ."));
    }
    cb(null, true);
  }
});
router.post("/", optionalAuth, upload.single("video"), createAnalysis);
router.get("/", optionalAuth, requireAuth, listAnalyses);
router.get("/:id/timeline", optionalAuth, getTimeline);
router.get("/:id/video-access", optionalAuth, getProcessedVideoAccess);
router.get("/:id/video", optionalAuth, getProcessedVideo);
router.get("/:id", optionalAuth, getAnalysis);
router.delete("/:id", optionalAuth, deleteAnalysis);
export default router;
