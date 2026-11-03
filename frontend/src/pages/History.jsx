import { useEffect, useState } from "react";
import { getHistory, deleteAnalysis } from "../services/api.js";
export default function History({ onOpen, title = "Lịch sử", eyebrow = "CÁC LẦN PHÂN TÍCH" }) {
  const [data,setData] = useState({items:[],page:1,pages:1,total:0}); const [error,setError]=useState("");
  async function load(page=1){try{setError("");setData(await getHistory(page));}catch(e){setError(e.response?.data?.message||e.message);}}
  useEffect(()=>{load(1)},[]);
  async function remove(id){if(!window.confirm("Xóa tác vụ và các tệp liên quan?"))return;try{await deleteAnalysis(id);load(data.page)}catch(e){setError(e.response?.data?.message||e.message)}}
  return <section className="panel history-panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>{error&&<p className="error">{error}</p>}
  {!data.items.length?<p className="muted">Chưa có lịch sử phân tích.</p>:<div className="table-scroll"><table><thead><tr><th>Tên video</th><th>Ngày tạo</th><th>Trạng thái</th><th>Số cá được ghi nhận</th><th></th></tr></thead><tbody>{data.items.map(x=><tr key={x.id}><td>{x.originalName}</td><td>{new Date(x.createdAt).toLocaleString("vi-VN")}</td><td><span className={`pill ${x.status}`}>{({pending:"Đang chờ",processing:"Đang xử lý",completed:"Hoàn tất",failed:"Thất bại"})[x.status]||x.status}</span></td><td>{x.trackCounts?.totalTracks??0}</td><td><button className="text-link" onClick={()=>onOpen(x.id)}>Xem</button> <button className="danger-link" onClick={()=>remove(x.id)}>Xóa</button></td></tr>)}</tbody></table></div>}
  <div className="pagination"><button className="button secondary" disabled={data.page<=1} onClick={()=>load(data.page-1)}>Trước</button><span>Trang {data.page}/{Math.max(data.pages,1)} · {data.total} tác vụ</span><button className="button secondary" disabled={data.page>=data.pages} onClick={()=>load(data.page+1)}>Sau</button></div></section>
}
