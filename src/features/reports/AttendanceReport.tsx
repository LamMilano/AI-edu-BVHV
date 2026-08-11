import React, { useMemo, useState } from "react";
import { ClassRecord, Student, Enrollment, Session, AttendanceStatus } from "../../types";
import { buildClassReport } from "../../lib/report";
import { toCsv, downloadCsv } from "../../lib/csv";
import { ATTENDANCE_LABELS } from "../../lib/attendance";
import { Download, AlertTriangle, BarChart3 } from "lucide-react";

interface Props {
  classes: ClassRecord[];
  students: Student[];
  enrollments: Enrollment[];
  sessions: Session[];
}

const ABSENT_STREAK_ALERT = 2;

/* Ô trong bảng chéo. Ký hiệu một chữ để ba mươi cột vẫn vừa màn hình; nhãn
   đầy đủ nằm ở thuộc tính title và ở chú giải dưới bảng. */
const CELL: Record<AttendanceStatus, { short: string; cls: string }> = {
  present: { short: "C", cls: "bg-[#E6F7F0] text-ok-deep" },
  late:    { short: "M", cls: "bg-[#E4F4FD] text-brand-navy" },
  excused: { short: "P", cls: "bg-[#EEF3F8] text-ink-3" },
  absent:  { short: "V", cls: "bg-[#FDECEC] text-danger-deep" },
};

const rateClass = (rate: number) =>
  rate >= 80 ? "text-ok-deep" : rate >= 50 ? "text-ink-2" : "text-danger-deep";

export default function AttendanceReport({ classes, students, enrollments, sessions }: Props) {
  const [classId, setClassId] = useState<string>(() => classes[0]?.id || "");

  const cls = classes.find(c => c.id === classId) || null;
  const report = useMemo(
    () => buildClassReport({ classId, sessions, enrollments, students }),
    [classId, sessions, enrollments, students]
  );

  const alerts = report.rows.filter(r => r.maxAbsentStreak >= ABSENT_STREAK_ALERT);

  const handleExport = () => {
    const header = [
      "STT", "Họ tên", "Khoa/Phòng",
      ...report.sessions.map(s => `${s.date} ${s.startTime}`),
      "Số buổi tham gia", "Số buổi tính", "Tỉ lệ (%)", "Vắng liên tiếp",
    ];
    const rows = report.rows.map((r, i) => [
      i + 1, r.fullName, r.department,
      ...r.cells.map(c => (c ? ATTENDANCE_LABELS[c] : "")),
      r.attended, r.counted, r.rate, r.maxAbsentStreak,
    ]);
    const name = (cls?.name || "lop").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
    downloadCsv(`chuyen-can-${name}.csv`, toCsv(header, rows));
  };

  return (
    <div className="space-y-4">
      <div className="surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="report-class" className="block text-[13.5px] font-bold text-ink-2 mb-2">
              Lớp học
            </label>
            <select
              id="report-class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="field w-full px-3.5 py-2.5 text-[14px]"
            >
              {classes.length === 0 && <option value="">Chưa có lớp nào</option>}
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <button
            id="btn-export-csv"
            onClick={handleExport}
            disabled={report.rows.length === 0}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 text-[13.5px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Xuất CSV
          </button>
        </div>

        {/* Người đọc báo cáo phải biết con số này được tính thế nào, nếu
            không họ sẽ tự suy ra một quy tắc khác rồi tranh cãi với nó. */}
        <p className="text-[12.5px] text-ink-3 leading-relaxed">
          Tỉ lệ chuyên cần tính trên <strong>số buổi đã điểm danh</strong>. Buổi chưa diễn ra
          và buổi hoãn không vào mẫu số. <strong>Vắng có phép</strong> không tính vào tử số
          lẫn mẫu số; <strong>đi muộn</strong> tính là có tham gia.
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="surface p-5 space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-deep flex-none" />
            <h4 className="text-[14px] font-extrabold tracking-tight text-danger-deep">
              {alerts.length} học viên vắng từ {ABSENT_STREAK_ALERT} buổi liên tiếp
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map(r => (
              <span
                key={r.studentId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[12px] font-semibold bg-[#FDECEC] text-danger-deep"
              >
                {r.fullName}
                <span className="tnum font-extrabold">{r.maxAbsentStreak}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {report.rows.length === 0 ? (
        <div className="surface p-8 flex flex-col items-center text-center gap-3">
          <BarChart3 className="w-8 h-8 text-ink-4" />
          <p className="text-[13.5px] text-ink-3">
            Lớp này chưa có học viên ghi danh. Xếp lớp ở tab Phân lớp trước.
          </p>
        </div>
      ) : report.sessions.length === 0 ? (
        <div className="surface p-8 flex flex-col items-center text-center gap-3">
          <BarChart3 className="w-8 h-8 text-ink-4" />
          <p className="text-[13.5px] text-ink-3">
            Lớp này chưa có buổi nào được điểm danh. Điểm danh ở tab Điểm danh trước.
          </p>
        </div>
      ) : (
        <div className="surface p-5 space-y-3">
          <div className="overflow-x-auto border border-line-soft rounded-field">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-b from-[#F4F8FC] to-[#EAF1F8] text-[10px] font-bold text-ink-3 uppercase tracking-wider border-b border-line-soft">
                  <th className="px-3 py-3 w-10">STT</th>
                  <th className="px-3 py-3 min-w-[160px]">Học viên</th>
                  {report.sessions.map((s, i) => (
                    <th
                      key={s.id}
                      className="px-2 py-3 text-center w-10"
                      title={`${s.date} · ${s.topic || "Buổi học"}`}
                    >
                      {i + 1}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right whitespace-nowrap">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft text-xs">
                {report.rows.map((r, i) => (
                  <tr key={r.studentId} className="hover:bg-[#F6FAFD] transition-colors">
                    <td className="px-3 py-3 tnum text-ink-4">{i + 1}</td>
                    <td className="px-3 py-3">
                      <span className="block font-bold text-ink truncate">{r.fullName}</span>
                      <span className="block text-[10.5px] text-ink-4 truncate">{r.department}</span>
                    </td>
                    {r.cells.map((c, ci) => (
                      <td key={ci} className="px-1 py-3 text-center">
                        {c ? (
                          <span
                            title={ATTENDANCE_LABELS[c]}
                            className={`inline-flex w-6 h-6 items-center justify-center rounded-[5px] text-[11px] font-extrabold ${CELL[c].cls}`}
                          >
                            {CELL[c].short}
                          </span>
                        ) : (
                          <span className="text-ink-4" title="Chưa ghi danh khi buổi này diễn ra">–</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className={`font-extrabold tnum ${rateClass(r.rate)}`}>{r.rate}%</span>
                      <span className="block text-[10.5px] text-ink-4 tnum">
                        {r.attended}/{r.counted}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chú giải: bảng dùng ký hiệu một chữ để vừa màn hình */}
          <div className="flex flex-wrap gap-3 text-[11.5px] text-ink-3">
            {(Object.keys(CELL) as AttendanceStatus[]).map(st => (
              <span key={st} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex w-5 h-5 items-center justify-center rounded-[4px] text-[10px] font-extrabold ${CELL[st].cls}`}>
                  {CELL[st].short}
                </span>
                {ATTENDANCE_LABELS[st]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex w-5 h-5 items-center justify-center text-ink-4">–</span>
              Chưa ghi danh
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
