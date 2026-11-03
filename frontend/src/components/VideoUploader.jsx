import { useRef, useState } from "react";
export default function VideoUploader({ onSubmit, busy }) {
  const input = useRef(null); const [file, setFile] = useState(null); const [drag, setDrag] = useState(false); const [error,setError] = useState("");
  function choose(f) {
    setError("");
    if (!f) return;
    if (!/\.(mp4|mov|mkv|avi|webm|mpeg|mpg)$/i.test(f.name)) { setError("Định dạng chưa hỗ trợ. Hãy chọn video MP4, MOV, MKV, AVI hoặc WEBM."); return; }
    setFile(f);
  }
  return <section className={`upload-panel ${drag?"drag":""}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);choose(e.dataTransfer.files?.[0])}}>
    <div className="upload-icon">↑</div><h2>Chọn video để nhận diện cá</h2><p>Kéo thả video vào đây hoặc chọn tệp từ thiết bị.</p>
    <input ref={input} hidden type="file" accept="video/*,.mkv,.avi" onChange={e=>choose(e.target.files?.[0])}/>
    <button className="button secondary" onClick={()=>input.current?.click()} disabled={busy}>Chọn video</button>
    {file && <div className="file-chip"><span>▣</span><div><b>{file.name}</b><small>{(file.size/1024/1024).toFixed(1)} MB</small></div><button className="icon-button" onClick={()=>setFile(null)} aria-label="Bỏ chọn">×</button></div>}
    {error && <p className="error">{error}</p>}
    <button className="button primary" disabled={!file||busy} onClick={()=>onSubmit(file)}>{busy?"Đang tải video lên…":"Bắt đầu nhận diện"}</button>
  </section>
}
