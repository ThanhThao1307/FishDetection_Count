import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import path from "node:path";
import fs from "node:fs";
import { STORAGE_ROOT } from "./storage.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ROOT = STORAGE_ROOT;
const frontendOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
for (const d of ["uploads", "processed", "reports"]) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
app.use(cors({ origin: frontendOrigins }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev", { skip: req => /^\/api\/analyses\/[^/]+\/video$/.test(req.path) }));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "fish-detection-api" }));
app.use("/api/auth", authRoutes);
app.use("/api/analyses", analysisRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.name === "MulterError" ? 413 : (err.response?.status || 500);
  res.status(status).json({ message: err.message || "Lỗi máy chủ." });
});

try {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fish_detection");
  app.listen(PORT, () => console.log(`API listening at http://localhost:${PORT}`));
} catch (err) {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
}
