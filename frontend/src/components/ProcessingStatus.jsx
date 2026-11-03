export default function ProcessingStatus({ item, uploadProgress }) {
  const progress = item
    ? (item.status === "completed" ? 100 : item.progress || 0)
    : uploadProgress || 0;
  const labels = {pending:"Đang chờ xử lý",processing:"Đang nhận diện cá trong video",completed:"Đã xử lý xong",failed:"Không xử lý được video"};
  const stages = {queued:"Đang chờ",inference:"Đang xem và nhận diện cá",encoding_video:"Đang chuẩn bị video để phát",writing_results:"Đang lưu kết quả",completed:"Hoàn tất",failed:"Đã xảy ra lỗi",uploading:"Đang tải video lên"};
  return <section className="panel status-panel"><div className="section-heading"><div><span className="eyebrow">TIẾN ĐỘ VIDEO</span><h2>{labels[item?.status] || "Đang tải video lên"}</h2></div><strong>{Math.round(progress)}%</strong></div><div className="progress-track"><div className="progress-fill" style={{width:`${progress}%`}}/></div><div className="status-meta"><span>{stages[item?.stage] || item?.stage || "Đang tải video lên"}</span><span>{item?.originalName || ""}</span></div>{item?.errorMessage && <p className="error">{item.errorMessage}</p>}</section>
}
