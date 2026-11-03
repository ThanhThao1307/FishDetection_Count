import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { STORAGE_ROOT } from "../storage.js";
import Analysis from "../models/Analysis.js";
import { startInference, getInferenceTask } from "../services/aiServiceClient.js";
import { signVideoToken, verifyVideoToken } from "../middleware/auth.js";

const ROOT = STORAGE_ROOT;
const uploads = path.join(ROOT, "uploads");
const processed = path.join(ROOT, "processed");
const reports = path.join(ROOT, "reports");
const toPublic = (doc) => ({
  id: String(doc._id), originalName: doc.originalName,
  videoDurationSeconds: doc.videoDurationSeconds, totalFrames: doc.totalFrames,
  status: doc.status, progress: doc.progress, stage: doc.stage, errorMessage: doc.errorMessage,
  maxN: doc.maxN, trackCounts: doc.trackCounts, timelineData: doc.timelineData,
  recognitionConfidencePercent: doc.recognitionConfidencePercent, recognitionAssessment: doc.recognitionAssessment,
  relativeDensity: doc.relativeDensity,
  createdAt: doc.createdAt, completedAt: doc.completedAt,
  hasProcessedVideo: Boolean(doc.processedVideoPath)
});
const validId = (id) => mongoose.isValidObjectId(id);

export async function createAnalysis(req, res, next) {
  let doc;
  try {
    if (!req.file) return res.status(400).json({ message: "Chưa nhận được video." });
    await Promise.all([fs.mkdir(uploads, { recursive: true }), fs.mkdir(processed, { recursive: true }), fs.mkdir(reports, { recursive: true })]);
    const videoPath = path.resolve(req.file.path);
    doc = await Analysis.create({
      userId: req.user?._id || null,
      originalName: req.file.originalname,
      originalVideoPath: videoPath,
      status: "pending", progress: 0, stage: "queued"
    });
    const task = await startInference({ analysisId: String(doc._id), videoPath });
    doc.status = "processing";
    doc.stage = task.stage || "queued";
    doc.progress = task.progress || 0;
    await doc.save();
    return res.status(202).json(toPublic(doc));
  } catch (err) {
    if (doc) {
      doc.status = "failed";
      doc.errorMessage = err.response?.data?.detail || err.message || "Không gọi được dịch vụ AI.";
      await doc.save().catch(() => {});
    }
    if (req.file && !doc) await fs.unlink(req.file.path).catch(() => {});
    return next(err);
  }
}

export async function getAnalysis(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID tác vụ không hợp lệ." });
    const doc = await Analysis.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tác vụ." });
    if (doc.userId && String(doc.userId) !== String(req.user?._id || "")) return res.status(403).json({ message: "Bạn không có quyền xem kết quả này." });
    if (doc.status === "pending" || doc.status === "processing") {
      // Synchronize task progress from the AI service; request remains fast.
      try {
        const taskId = String(doc._id);
        const task = await getInferenceTask(taskId);
        doc.status = task.status || doc.status;
        doc.progress = Math.min(100, Math.max(0, Number(task.progress) || 0));
        doc.stage = task.stage || doc.stage;
        if (task.error) doc.errorMessage = task.error;
        if (task.status === "completed" && task.result) {
          const r = task.result;
          doc.videoDurationSeconds = Number(r.videoDurationSeconds) || 0;
          doc.totalFrames = Number(r.totalFrames) || 0;
          doc.maxN = r.maxN;
          doc.trackCounts = r.trackCounts;
          doc.recognitionConfidencePercent = Number.isFinite(Number(r.recognitionConfidencePercent)) ? Number(r.recognitionConfidencePercent) : 0;
          doc.recognitionAssessment = r.recognitionAssessment || null;
          doc.timelineData = r.timelineData || [];
          doc.relativeDensity = r.relativeDensity || null;
          doc.processedVideoPath = r.processedVideoPath || null;
          doc.reportCsvPath = r.reportCsvPath || null;
          doc.trackCsvPath = r.trackCsvPath || null;
          doc.completedAt = new Date();
          doc.progress = 100;
        }
        if (task.status === "failed") doc.errorMessage = task.error || "Phân tích thất bại.";
        await doc.save();
      } catch (syncError) {
        // Keep previous state; temporary AI-service outages should not erase task results.
        console.error("AI status sync failed:", syncError.message);
      }
    }
    return res.json(toPublic(doc));
  } catch (err) { return next(err); }
}

export async function listAnalyses(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit || "10", 10)));
    const [items, total] = await Promise.all([
      Analysis.find({ userId: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Analysis.countDocuments({ userId: req.user._id })
    ]);
    res.json({ items: items.map(toPublic), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

export async function getTimeline(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID tác vụ không hợp lệ." });
    const doc = await Analysis.findById(req.params.id).select("status timelineData userId");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tác vụ." });
    if (doc.userId && String(doc.userId) !== String(req.user?._id || "")) return res.status(403).json({ message: "Bạn không có quyền xem kết quả này." });
    res.json({ status: doc.status, timelineData: doc.timelineData || [] });
  } catch (err) { next(err); }
}

async function streamFile(req, res, next, field, mime, download = false) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID tác vụ không hợp lệ." });
    const doc = await Analysis.findById(req.params.id).select(`originalName ${field} userId`);
    if (!doc || !doc[field]) return res.status(404).json({ message: "File chưa sẵn sàng hoặc không tồn tại." });
    const hasVideoAccess = field === "processedVideoPath" && verifyVideoToken(req.params.id, req.query.token);
    if (doc.userId && String(doc.userId) !== String(req.user?._id || "") && !hasVideoAccess) return res.status(403).json({ message: "Bạn không có quyền tải file này." });
    const file = path.resolve(doc[field]);
    const rootAllowed = path.resolve(ROOT) + path.sep;
    if (!file.startsWith(rootAllowed)) return res.status(403).json({ message: "Đường dẫn file không hợp lệ." });
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) return res.status(404).json({ message: "Không tìm thấy file." });
    res.setHeader("Content-Type", mime);
    res.setHeader("Accept-Ranges", "bytes");
    if (download) res.setHeader("Content-Disposition", `attachment; filename="${path.basename(file).replace(/["\\]/g, "_")}"`);
    const range = req.headers.range;
    if (range && !download) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) return res.status(416).end();
      let start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
      let end = m[2] && m[1] ? Number(m[2]) : stat.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= stat.size) {
        res.setHeader("Content-Range", `bytes */${stat.size}`);
        return res.status(416).end();
      }
      end = Math.min(end, stat.size - 1);
      res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      res.setHeader("Content-Length", end - start + 1);
      const stream = (await import("node:fs")).createReadStream(file, { start, end });
      stream.on("error", next); return stream.pipe(res);
    }
    res.setHeader("Content-Length", stat.size);
    const stream = (await import("node:fs")).createReadStream(file);
    stream.on("error", next); stream.pipe(res);
  } catch (err) { next(err); }
}
export async function getProcessedVideoAccess(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID tác vụ không hợp lệ." });
    const doc = await Analysis.findById(req.params.id).select("processedVideoPath userId");
    if (!doc || !doc.processedVideoPath) return res.status(404).json({ message: "Video kết quả chưa sẵn sàng." });
    if (doc.userId && String(doc.userId) !== String(req.user?._id || "")) return res.status(403).json({ message: "Bạn không có quyền xem kết quả này." });
    const file = path.resolve(doc.processedVideoPath);
    const rootAllowed = path.resolve(ROOT) + path.sep;
    if (!file.startsWith(rootAllowed)) return res.status(403).json({ message: "Đường dẫn file không hợp lệ." });
    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile() || stat.size === 0) return res.status(404).json({ message: "Video kết quả chưa sẵn sàng." });
    res.json({ token: signVideoToken(req.params.id) });
  } catch (err) { next(err); }
}
export const getProcessedVideo = (req, res, next) =>
  streamFile(req, res, next, "processedVideoPath", "video/mp4", req.query.download === "1");

export async function deleteAnalysis(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID tác vụ không hợp lệ." });
    const doc = await Analysis.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Không tìm thấy tác vụ." });
    if (doc.userId && String(doc.userId) !== String(req.user?._id || "")) return res.status(403).json({ message: "Bạn không có quyền xóa tác vụ này." });
    const candidates = [doc.originalVideoPath, doc.processedVideoPath, doc.reportCsvPath, doc.trackCsvPath].filter(Boolean);
    const rootAllowed = path.resolve(ROOT) + path.sep;
    for (const f of candidates) {
      const resolved = path.resolve(f);
      if (resolved.startsWith(rootAllowed)) await fs.unlink(resolved).catch((e) => { if (e.code !== "ENOENT") throw e; });
    }
    await doc.deleteOne();
    res.json({ deleted: true, id: req.params.id });
  } catch (err) { next(err); }
}
