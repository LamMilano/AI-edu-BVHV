import React, { useMemo, useState } from "react";
import { Student } from "../../types";
import { MigrateReport } from "../../lib/migrate";
import { LEVEL_RAMP, LEVEL_LABEL } from "../../lib/levels";
import { RefreshCw, Search, AlertTriangle, Users } from "lucide-react";

interface Props {
  students: Student[];
  loading: boolean;
  migrating: boolean;
  report: MigrateReport | null;
  onMigrate: () => void;
}

export default function StudentProfileList({
  students, loading, migrating, report, onMigrate,
}: Props) {
  const [needle, setNeedle] = useState("");

  const filtered = useMemo(() => {
    const q = needle.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.fullName || "").toLowerCase().includes(q) ||
      (s.department || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  }, [students, needle]);

  return (
    <div className="surface p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input
            id="student-profile-search"
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Tìm theo tên, khoa/phòng hoặc email"
            className="field w-full pl-9 pr-3.5 py-2.5 text-[13.5px]"
          />
        </div>
        <button
          id="btn-migrate-students"
          onClick={onMigrate}
          disabled={migrating}
          className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 text-[13.5px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${migrating ? "animate-spin" : ""}`} />
          {migrating ? "Đang dựng hồ sơ…" : "Dựng lại hồ sơ từ phiếu"}
        </button>
      </div>

      {report && (
        <div className="rounded-field border border-line-soft bg-[#F6FAFD] px-4 py-3 text-[13px] text-ink-2 space-y-1.5">
          <p className="tnum">
            Đã đọc {report.totalSubmissions} phiếu · tạo mới{" "}
            <strong>{report.created}</strong> hồ sơ · cập nhật{" "}
            <strong>{report.updated}</strong> hồ sơ.
          </p>
          {report.skipped.length > 0 && (
            <div className="flex items-start gap-2 text-danger-deep">
              <AlertTriangle className="w-4 h-4 flex-none mt-0.5" />
              <div>
                <span className="font-semibold">
                  Bỏ qua {report.skipped.length} phiếu vì thiếu email hợp lệ:
                </span>
                <span className="text-ink-3">
                  {" "}{report.skipped.map(s => s.studentName).join(", ")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto border border-line-soft rounded-field">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gradient-to-b from-[#F4F8FC] to-[#EAF1F8] text-[10px] font-bold text-ink-3 uppercase tracking-wider border-b border-line-soft">
              <th className="px-4 py-3 w-12">STT</th>
              <th className="px-4 py-3">Học viên</th>
              <th className="px-4 py-3">Khoa / Phòng</th>
              <th className="px-4 py-3">Cấp độ</th>
              <th className="px-4 py-3">Lịch rảnh</th>
              <th className="px-4 py-3">Liên hệ</th>
              <th className="px-4 py-3">Số phiếu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft text-xs">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-ink-4 italic">Đang tải hồ sơ…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-ink-4">
                  {students.length === 0 ? (
                    <span className="inline-flex items-center gap-2 italic">
                      <Users className="w-4 h-4" />
                      Chưa có hồ sơ nào. Bấm “Dựng lại hồ sơ từ phiếu” để tạo từ dữ liệu khảo sát.
                    </span>
                  ) : (
                    <span className="italic">Không có hồ sơ nào khớp từ khóa.</span>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={s.id} className="hover:bg-[#F6FAFD] transition-colors">
                  <td className="px-4 py-4 tnum text-ink-4">{i + 1}</td>
                  <td className="px-4 py-4 font-bold text-ink">{s.fullName}</td>
                  <td className="px-4 py-4 text-ink-3">{s.department}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-[5px] text-[11.5px] font-bold bg-gradient-to-br ${LEVEL_RAMP[s.currentLevel].pill}`}>
                      {LEVEL_LABEL[s.currentLevel]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-3">
                    {s.availability?.days?.length
                      ? `${s.availability.days.join(", ")} · ${s.availability.timeframes.join(", ")}`
                      : <span className="italic text-ink-4">Chưa có</span>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-0.5">
                      <span className="block text-ink-3 tnum">{s.phone}</span>
                      <span className="block text-[10px] text-ink-4">{s.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 tnum text-ink-3">
                    {s.submissionCount}
                    {s.submissionCount > 1 && (
                      <span className="ml-1.5 text-[10px] text-ink-4">(đã làm lại)</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
