import React from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";
import { PublicStatsData } from "../types";
import { LEVEL_RAMP, LEVEL_LABEL, LEVEL_IDS, LevelId } from "../lib/levels";

interface StudentStatsProps {
  stats: PublicStatsData;
  /* Biểu đồ chỉ có ý nghĩa khi đang xem danh sách học viên; ở các tab khác
     của Quản trị thì chỉ giữ lại bốn ô số. */
  showCharts?: boolean;
}

/* Khối "Thông tin học viên": bốn ô số + donut phân bố cấp độ + cột khoa/phòng.
   Nhận số liệu đã tổng hợp sẵn thay vì tự đếm từ dữ liệu thô, vì trang chủ
   (khách vãng lai) không có quyền đọc survey_submissions sau khi siết rules.
   Bảng Quản trị truyền vào computePublicStats(submissions); trang chủ truyền
   vào document public_stats/summary — hai nơi luôn hiện đúng một con số. */
export default function StudentStats({ stats, showCharts = true }: StudentStatsProps) {
  const totalSubmissions = stats.totalStudents;
  const levelCount: Record<LevelId, number> = stats.byLevel;

  const distributionData = LEVEL_IDS
    .map((id) => ({
      id,
      name: `${LEVEL_LABEL[id]} · ${LEVEL_RAMP[id].name}`,
      value: levelCount[id],
      color: LEVEL_RAMP[id].solid,
    }))
    .filter(d => d.value > 0);

  // Năm khoa/phòng đông nhất — đã được computePublicStats lọc và sắp sẵn.
  const departmentData = stats.topDepartments.map(d => ({
    name: d.name,
    students: d.count
  }));

  return (
    <>
      {/* ══ BỐN Ô SỐ — màu theo đúng dải cấp độ, nên nối được với biểu đồ và bảng ══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="surface-tile p-4">
          <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">Tổng học viên</span>
          <div className="text-[29px] font-extrabold tracking-[-0.035em] leading-none tnum mt-2 text-grad">
            {totalSubmissions}
          </div>
        </div>

        {LEVEL_IDS.map((id) => {
          const n = levelCount[id];
          return (
            <div key={id} className="surface-tile p-4 relative overflow-hidden">
              <span className={`absolute top-0 left-0 bottom-0 w-[4px] bg-gradient-to-b ${LEVEL_RAMP[id].rail}`} />
              <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">{LEVEL_LABEL[id]}</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-[29px] font-extrabold tracking-[-0.035em] leading-none tnum" style={{ color: LEVEL_RAMP[id].solid }}>
                  {n}
                </span>
                <span className="text-[12.5px] text-ink-3 tnum">
                  {totalSubmissions > 0 ? Math.round((n / totalSubmissions) * 100) : 0}%
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* RECHARTS PLOTS */}
      {totalSubmissions > 0 && showCharts && (
        <section className="grid md:grid-cols-3 gap-6">
          {/* Donut phân bố cấp độ — chú giải hình thoi đặt cạnh, không chồng lên */}
          <div className="surface p-5">
            <h4 className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em]">Phân bố cấp độ</h4>
            <div className="h-44 relative mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {distributionData.map((d) => (
                      <linearGradient key={d.id} id={`grad-${d.id}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={LEVEL_RAMP[d.id].from} />
                        <stop offset="100%" stopColor={LEVEL_RAMP[d.id].to} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {distributionData.map((entry) => (
                      <Cell key={entry.id} fill={`url(#grad-${entry.id})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} học viên`, ""]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #D8E4F2",
                      boxShadow: "0 14px 30px -14px rgb(20 51 110 / 0.4)",
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[26px] font-extrabold text-ink tnum leading-none">{totalSubmissions}</span>
                <span className="text-[11px] text-ink-4 mt-0.5">học viên</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {distributionData.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className="w-2.5 h-2.5 rotate-45 rounded-[2px] flex-none"
                    style={{ background: `linear-gradient(135deg, ${LEVEL_RAMP[d.id].from}, ${LEVEL_RAMP[d.id].to})` }}
                  />
                  <span className="text-ink-3 truncate">{d.name}</span>
                  <span className="ml-auto font-bold text-ink tnum">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cột theo khoa phòng — đổ màu dọc thay vì bệt */}
          <div className="surface p-5 md:col-span-2">
            <h4 className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em]">
              Năm khoa/phòng tham gia nhiều nhất
            </h4>
            {departmentData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-ink-4 text-[13.5px]">Chưa có dữ liệu</div>
            ) : (
              <div className="h-44 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7CD0F5" />
                        <stop offset="100%" stopColor="#2E86C8" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#6B7E95" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7E95" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgb(79 195 240 / 0.08)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #D8E4F2",
                        boxShadow: "0 14px 30px -14px rgb(20 51 110 / 0.4)",
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="students" name="Học viên" fill="url(#grad-bar)" radius={[5, 5, 2, 2]} barSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
