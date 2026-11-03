import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../middleware/auth.js";
const publicUser = u => ({ id: String(u._id), displayName: u.displayName, email: u.email });
export async function register(req, res, next) { try {
  const displayName = String(req.body.displayName || "").trim(); const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || "");
  if (displayName.length < 2 || displayName.length > 80) return res.status(400).json({ message: "Tên hiển thị cần từ 2 đến 80 ký tự." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Email không hợp lệ." });
  if (password.length < 8) return res.status(400).json({ message: "Mật khẩu cần ít nhất 8 ký tự." });
  if (await User.exists({ email })) return res.status(409).json({ message: "Email này đã được đăng ký." });
  const user = await User.create({ displayName, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
} catch (e) { if (e.code === 11000) return res.status(409).json({ message: "Email này đã được đăng ký." }); next(e); } }
export async function login(req, res, next) { try {
  const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || "");
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
  res.json({ token: signToken(user), user: publicUser(user) });
} catch (e) { next(e); } }
export async function me(req, res) { res.json({ user: publicUser(req.user) }); }
export async function updateMe(req, res, next) { try {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản." });

  const displayName = req.body.displayName === undefined ? user.displayName : String(req.body.displayName).trim();
  const email = req.body.email === undefined ? user.email : String(req.body.email).trim().toLowerCase();
  if (displayName.length < 2 || displayName.length > 80) return res.status(400).json({ message: "Tên hiển thị cần từ 2 đến 80 ký tự." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Email không hợp lệ." });
  if (await User.exists({ email, _id: { $ne: user._id } })) return res.status(409).json({ message: "Email này đã được tài khoản khác sử dụng." });

  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    }
    if (newPassword.length < 8) return res.status(400).json({ message: "Mật khẩu mới cần ít nhất 8 ký tự." });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  user.displayName = displayName;
  user.email = email;
  await user.save();
  res.json({ user: publicUser(user) });
} catch (e) { if (e.code === 11000) return res.status(409).json({ message: "Email này đã được tài khoản khác sử dụng." }); next(e); } }
