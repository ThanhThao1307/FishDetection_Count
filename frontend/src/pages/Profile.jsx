import { useState } from "react";
import History from "./History.jsx";
import { updateProfile } from "../services/api.js";

export default function Profile({ user, onUserUpdated, onOpenAnalysis }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { user: updatedUser } = await updateProfile({
        displayName,
        email,
        ...(newPassword ? { currentPassword, newPassword } : {})
      });
      onUserUpdated(updatedUser);
      setDisplayName(updatedUser.displayName);
      setEmail(updatedUser.email);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Đã cập nhật thông tin tài khoản.");
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Không thể cập nhật thông tin.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="profile-page">
    <section className="panel profile-panel">
      <div className="section-heading">
        <div><span className="eyebrow">TÀI KHOẢN CỦA BẠN</span><h2>Thông tin cá nhân</h2></div>
      </div>
      <form className="profile-form" onSubmit={submit}>
        <label>Tên hiển thị<input required minLength="2" maxLength="80" value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
        <label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <div className="profile-password-heading"><strong>Đổi mật khẩu</strong><span>Để trống nếu bạn không muốn đổi.</span></div>
        <label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
        <label>Mật khẩu mới<input type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
        {error && <p className="error">{error}</p>}
        {message && <p className="profile-success" role="status">{message}</p>}
        <button className="button primary profile-save" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button>
      </form>
    </section>
    <History onOpen={onOpenAnalysis} title="Video đã tải lên và nhận diện" eyebrow="LỊCH SỬ VIDEO" />
  </div>;
}
