import React, { useMemo, useState } from "react";
import { Student, SurveySubmission, Enrollment, ClassRecord } from "../../types";
import { MigrateReport } from "../../lib/migrate";
import { LEVEL_RAMP, LEVEL_LABEL } from "../../lib/levels";
import {
  buildStudentExport, studentExportFileName, STUDENT_EXPORT_WIDTHS,
} from "../../lib/exportStudents";
import { downloadXlsx } from "../../lib/xlsx";
import { RefreshCw, Search, AlertTriangle, Users, Download } from "lucide-react";

interface Props {
  students: Student[];
  submissions: SurveySubmission[];
  enrollments: Enrollment[];
  classes: ClassRecord[];
  loading: boolean;
  migrating: boolean;
  report: MigrateReport | null;
  onMigrate: () => void;
}

/** Giá trị ô chọn phạm vi khi xuất toàn bộ hồ sơ (không lọc theo lớp). */
const SCOPE_ALL = "";

export default function StudentProfileList({
  students, submissions, enrollments, classes, loading, migrating, report, onMigrate,
}: Props) {
  const [needle, setNeedle] = useState("");
  const [scope, setScope] = useState<string>(SCOPE_ALL);
  const [exporting, setExporting] = useState(false);

  /* Sĩ số hiện trên ô chọn để giáo vụ biết trước file sẽ có bao nhiêu dòng,
     thay vì xuất ra rồi mới phát hiện lớp rỗng. */
  const enrolledCountOf = (classId: string) =>
    enrollments.filter(e => e.classId === classId && e.status === "enrolled").length;

  const table = useMemo(
    () => buildStudentExport({
      students, submissions, enrollments, classes,
      classId: scope || null,
    }),
    [students, submissions, enrollments, classes, scope]
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const scopeLabel = scope
        ? classes.find(c => c.id === scope)?.name || "lop"
        : "tat-ca";
      await downloadXlsx({
        fileName: studentExportFileName(scopeLabel, new Date()),
        sheetName: "Danh sách học viên",
        header: table.header,
        rows: table.rows,
        columnWidths: STUDENT_EXPORT_WIDTHS,
      });
    } catch (err) {
      console.error("Lỗi khi xuất danh sách học viên: ", err);
      alert("Không xuất được file. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

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

      {/* ── Xuất danh sách kèm toàn bộ câu trả lời khảo sát ── */}
      <div className="rounded-field border border-line-soft bg-[#F6FAFD] px-4 py-3.5 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="export-scope" className="block text-[12.5px] font-bold text-ink-2 mb-1.5">
            Phạm vi xuất
          </label>
          <select
            id="export-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="field w-full px-3.5 py-2.5 text-[13.5px]"
          >
            <option value={SCOPE_ALL}>Tất cả hồ sơ ({students.length})</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({enrolledCountOf(c.id || "")})
              </option>
            ))}
          </select>
        </div>

        <button
          id="btn-export-students"
          onClick={handleExport}
          disabled={exporting || table.rows.length === 0}
          className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 text-[13.5px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex-none"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Đang tạo file…" : `Xuất Excel (${table.rows.length})`}
        </button>
      </div>

      {/* Ô tìm kiếm chỉ lọc bảng bên dưới. Nói rõ ra, nếu không giáo vụ gõ tìm
          rồi bấm xuất và tưởng file đã được lọc theo từ khóa. */}
      <p className="text-[12px] text-ink-4 leading-relaxed">
        File xuất theo phạm vi đã chọn ở trên và luôn kèm đủ {table.header.length} cột thông tin
        khảo sát. Ô tìm kiếm không ảnh hưởng tới file.
      </p>

      {report && (
        <div className="rounded-field border border-line-soft bg-[#F6FAFD] px-4 py-3 text-[13px] text-ink-2 space-y-1.5">
          <p className="tnum">
            Đã đọc {report.totalSubmissions} phiếu · tạo mới{" "}
            <strong>{report.created}</strong> hồ sơ · cập nhật{" "}
            <strong>{report.updated}</strong> hồ sơ.
          </p>
          {report.classesConverted > 0 && (
            <p className="tnum">
              Đã chuyển <strong>{report.classesConverted}</strong> lớp sang khung lịch có cấu trúc.
            </p>
          )}
          {report.classesNeedReview.length > 0 && (
            <div className="flex items-start gap-2 text-danger-deep">
              <AlertTriangle className="w-4 h-4 flex-none mt-0.5" />
              <div>
                <span className="font-semibold">
                  Cần khai lại lịch cho {report.classesNeedReview.length} lớp:
                </span>
                <span className="text-ink-3"> {report.classesNeedReview.join(", ")}</span>
              </div>
            </div>
          )}
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
