import { useState } from "react";
import Home from "./pages/Home.jsx";
import History from "./pages/History.jsx";
import Profile from "./pages/Profile.jsx";
import About from "./pages/About.jsx";
import { authenticate } from "./services/api.js";
function AuthPanel({ onAuth, onClose }) {
 const [mode,setMode]=useState("login"); const [displayName,setDisplayName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setBusy(true);setError("");try{const r=await authenticate(mode, mode==="register"?{displayName,email,password}:{email,password});onAuth(r);onClose();}catch(err){setError(err.response?.data?.message||err.message)}finally{setBusy(false)}}
 return <div className="auth-backdrop"><form className="auth-panel" onSubmit={submit}><button type="button" className="auth-close" onClick={onClose}>×</button><span className="eyebrow">TÀI KHOẢN NGƯỜI DÙNG</span><h2>{mode==="login"?"Đăng nhập":"Tạo tài khoản"}</h2><p className="muted">Đăng nhập để lưu và xem lịch sử phân tích của riêng bạn.</p>{mode==="register"&&<label>Họ tên<input required minLength="2" maxLength="80" value={displayName} onChange={e=>setDisplayName(e.target.value)} /></label>}<label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Mật khẩu<input type="password" required minLength="8" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<p className="error">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Đang xử lý…":mode==="login"?"Đăng nhập":"Đăng ký"}</button><p className="auth-switch">{mode==="login"?"Chưa có tài khoản?":"Đã có tài khoản?"} <button type="button" className="text-link" onClick={()=>{setMode(mode==="login"?"register":"login");setError("")}}>{mode==="login"?"Đăng ký":"Đăng nhập"}</button></p></form></div>
}
export default function App(){
 const [page,setPage]=useState("about"); const [selected,setSelected]=useState(null); const [authOpen,setAuthOpen]=useState(false); const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("fish_user")||"null")}catch{return null}});
 function onAuth(r){localStorage.setItem("fish_token",r.token);localStorage.setItem("fish_user",JSON.stringify(r.user));setUser(r.user);setPage("home")}
 function logout(){localStorage.removeItem("fish_token");localStorage.removeItem("fish_user");setUser(null);setPage("home")}
 function goHistory(){if(!user){setAuthOpen(true);return}setPage("history")}
 function goProfile(){if(!user){setAuthOpen(true);return}setPage("profile")}
 function onUserUpdated(updatedUser){localStorage.setItem("fish_user",JSON.stringify(updatedUser));setUser(updatedUser)}
 function openAnalysis(id){setSelected(id);setPage("home")}
 return <div className="app-shell"><header className="topbar"><div className="brand"><div className="brand-mark">F</div><div><strong>Nhận diện cá</strong><small>PHÂN TÍCH VIDEO</small></div></div><nav><button className={page==="about"?"nav-active":""} onClick={()=>setPage("about")}>Giới thiệu</button><button className={page==="home"?"nav-active":""} onClick={()=>{setPage("home");setSelected(null)}}>Phân tích video</button><button className={page==="history"?"nav-active":""} onClick={goHistory}>Lịch sử</button>{user?<><button className={`user-greeting ${page==="profile"?"nav-active":""}`} onClick={goProfile} aria-label={`Thông tin cá nhân của ${user.displayName}`}>{user.displayName}</button><button onClick={logout}>Đăng xuất</button></>:<button className="nav-active" onClick={()=>setAuthOpen(true)}>Đăng nhập</button>}</nav></header>
 <main><section className="hero"><div><span className="eyebrow">NHẬN DIỆN CÁ TRONG VIDEO</span><h1>Xem các loài cá<br/><span>xuất hiện trong video.</span></h1><p>Tải video lên để xem phần mềm nhận diện những nhóm cá nào và đánh dấu vị trí của chúng trong video.</p></div><div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="scan-lines"/><span>NHẬN DIỆN CÁ</span><span>PHÂN LOẠI LOÀI</span><span>XEM KẾT QUẢ</span></div></section>
 {page==="home"?<Home key={selected||"new"} initialId={selected} user={user} onLogin={()=>setAuthOpen(true)}/>:page==="about"?<About onStart={()=>{setPage("home");setSelected(null)}}/>:page==="profile"?<Profile user={user} onUserUpdated={onUserUpdated} onOpenAnalysis={openAnalysis}/>:<History onOpen={openAnalysis}/>}
 </main>{authOpen&&<AuthPanel onAuth={onAuth} onClose={()=>setAuthOpen(false)}/>}</div>
}
