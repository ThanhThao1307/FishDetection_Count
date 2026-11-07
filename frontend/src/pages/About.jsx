const TARGET_SPECIES = [
  {
    name: "Diplodus sargus",
    traits: "Thân màu bạc, thường có các sọc sẫm và mảng đen gần đuôi."
  },
  {
    name: "Dentex dentex",
    traits: "Thân bầu dục; cá trưởng thành thường có răng nanh lớn phía trước."
  },
  {
    name: "Diplodus vulgaris",
    traits: "Thân bạc hơi xám, thường có hai dải đen gần đầu và cuống đuôi."
  },
  {
    name: "Loài khác / chưa xác định",
    traits: "Dành cho loài mới lạ không nằm trong danh sách mục tiêu hoặc hình ảnh chưa đủ căn cứ để nhận diện."
  }
];

export default function About({ onStart }) {
  return <div className="about-page">
    <section className="panel about-intro">
      <span className="eyebrow">GIỚI THIỆU</span>
      <h2>Khái quát các loài cá xuất hiện trong video</h2>
      <p>Tải video lên để phần mềm tự động tìm và phân loại cá. Kết quả giúp bạn xem video có ghi nhận ba loài cá mục tiêu hay không, số lượng ước tính của từng loài và các cá thể được đánh dấu trực tiếp trên video.</p>
      <button className="button primary" onClick={onStart}>Bắt đầu nhận diện video</button>
    </section>

    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">BA LOÀI MỤC TIÊU</span><h2>Phần mềm tìm những loài nào?</h2></div>
      </div>
      <div className="species-info-grid">
        {TARGET_SPECIES.map(species => <article className="species-info-card" key={species.name}>
          <h3>{species.name}</h3>
          <p>{species.traits}</p>
        </article>)}
      </div>
    </section>

    <section className="panel">
      <div className="section-heading">
        <div><span className="eyebrow">CÁCH ĐỌC KẾT QUẢ</span><h2>Video cho bạn biết điều gì?</h2></div>
      </div>
      <div className="about-result-grid">
        <article><strong>Loài có xuất hiện</strong><p>Xem loài nào được phần mềm nhận diện trong video và số cá ước tính theo từng nhóm.</p></article>
        <article><strong>Số cá ước tính</strong><p>Tổng số và số theo loài là kết quả phần mềm ghi nhận khi theo dõi cá qua các khung hình, giúp bạn hình dung khái quát về video.</p></article>
        <article><strong>Video có đánh dấu</strong><p>Xem lại video để kiểm tra vị trí các cá thể mà phần mềm nhận diện được.</p></article>
      </div>
    </section>
  </div>;
}
