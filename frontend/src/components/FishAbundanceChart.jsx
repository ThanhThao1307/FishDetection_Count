import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
const series = [
  ["Diplodus sargus","Diplodus sargus","#10b981"],
  ["Dentex dentex","Dentex dentex","#3b82f6"],
  ["Diplodus vulgaris","Diplodus vulgaris","#f59e0b"],
  ["Other_Unidentified","Loài khác / chưa xác định","#f43f5e"]
];
export default function FishAbundanceChart({ data=[] }) {
  const normalized = data.map(d => ({...d, timeLabel:`${Math.floor(Number(d.second||0)/60)}:${String(Number(d.second||0)%60).padStart(2,"0")}`}));
  return <section className="panel chart-panel"><div className="section-heading"><div><span className="eyebrow">DIỄN BIẾN TRONG VIDEO</span><h2>Số cá nhìn thấy theo thời gian</h2><p>Mỗi điểm cho biết số cá nhìn thấy cùng lúc nhiều nhất trong giây đó.</p></div></div>
    {normalized.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={normalized} margin={{top:10,right:18,left:0,bottom:8}}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="timeLabel" minTickGap={28} label={{ value: "Thời gian trong video", position: "insideBottom", offset: -4 }}/><YAxis allowDecimals={false} width={36} label={{ value: "Số cá", angle: -90, position: "insideLeft" }}/><Tooltip labelFormatter={value => `Thời điểm ${value}`} formatter={(value, name) => [`${value} con`, name]}/><Legend/>{series.map(([key,name,color])=><Line key={key} name={name} type="monotone" dataKey={key} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div> : <div className="empty-chart">Biểu đồ sẽ xuất hiện khi video được xử lý xong.</div>}
  </section>
}
