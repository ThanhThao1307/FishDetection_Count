import jwt from "jsonwebtoken";
import User from "../models/User.js";
const secret = () => process.env.JWT_SECRET || "replace-this-secret-before-deployment";
export async function optionalAuth(req, _res, next) {
  try { const raw = req.headers.authorization || ""; const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
    if (token) { const payload = jwt.verify(token, secret()); const user = await User.findById(payload.sub).select("_id displayName email"); if (user) req.user = user; }
  } catch { /* Invalid/expired token behaves as guest; protected routes reject below. */ }
  next();
}
export function requireAuth(req, res, next) { if (!req.user) return res.status(401).json({ message: "Vui lòng đăng nhập để dùng lịch sử cá nhân." }); next(); }
export function signToken(user) { return jwt.sign({ sub: String(user._id) }, secret(), { expiresIn: "7d" }); }
export function signVideoToken(analysisId) {
  return jwt.sign({ scope: "processed-video", analysisId: String(analysisId) }, secret(), { expiresIn: "24h" });
}
export function verifyVideoToken(analysisId, token) {
  try {
    const payload = jwt.verify(token || "", secret());
    return payload.scope === "processed-video" && payload.analysisId === String(analysisId);
  } catch {
    return false;
  }
}
