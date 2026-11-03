import { useEffect, useState } from "react";
import { getProcessedVideoUrl } from "../services/api.js";
export default function ResultVideo({ id, ready }) {
  const [src,setSrc]=useState(""); const [error,setError]=useState("");
  const downloadUrl=src?`${src}&download=1`:"";
  useEffect(()=>{
    let active=true;
    setSrc("");setError("");
    if(ready)getProcessedVideoUrl(id).then(url=>{if(active)setSrc(url)}).catch(e=>{if(active)setError(e.response?.data?.message||"Không tải được video kết quả.")});
    return()=>{active=false};
  },[id,ready]);
  return <section className="panel video-panel">
    <div className="section-heading"><div><span className="eyebrow">VIDEO ĐÃ XỬ LÝ</span><h2>Xem video có đánh dấu cá</h2></div>{src&&<a className="text-link" href={downloadUrl}>Tải video xuống ↓</a>}</div>
    {error?<p className="error">{error}</p>:src?<><video controls playsInline preload="metadata" src={src} onError={()=>setError("Trình duyệt không phát được video này. Bạn có thể tải video xuống để xem.")}/><p className="note">Bấm nút phát để xem; video được tải dần khi xem.</p></>:<div className="video-placeholder">{ready?"Đang chuẩn bị video để phát…":"Video có đánh dấu cá sẽ xuất hiện tại đây sau khi phân tích xong."}</div>}
  </section>
}
