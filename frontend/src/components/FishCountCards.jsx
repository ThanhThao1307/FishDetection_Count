const SPECIES = [
  ["Diplodus sargus", "#34d399"],
  ["Dentex dentex", "#60a5fa"],
  ["Diplodus vulgaris", "#fbbf24"],
  ["Loài khác / chưa xác định", "#fb7185", "Other_Unidentified"]
];
const fmt = value => Number(value || 0).toLocaleString("vi-VN");

export default function FishCountCards({ item }) {
  const tracks = item?.trackCounts || {};
  const trackBy = tracks.bySpecies || {};

  return <section className="results-section">
    <div className="section-heading">
      <div>
        <span className="eyebrow">KẾT QUẢ TRONG VIDEO</span>
        <h2>Số cá trong video</h2>
        <p>Số cá được phần mềm ghi nhận, chia theo nhóm loài bên dưới.</p>
      </div>
    </div>
    <div className="summary-grid">
      <article className="summary-card">
        <span>Tổng số cá được ghi nhận</span>
        <strong>{fmt(tracks.totalTracks)}</strong>
      </article>
    </div>
    <div className="count-grid">
      {SPECIES.map(([name, color, key = name]) => <article className="count-card" key={key}>
        <div className="count-top"><span className="dot" style={{ background: color }}/><span>{name}</span></div>
        <strong className="count-number">{fmt(trackBy[key])}</strong>
        <small className="count-description">cá được ghi nhận</small>
      </article>)}
    </div>
    <p className="note">Đây là số lượng ước tính. Một con cá có thể bị tính nhiều lần nếu bị che khuất hoặc phần mềm mất dấu rồi nhận diện lại; cá xuất hiện quá ngắn có thể không được tính.</p>
  </section>;
}
