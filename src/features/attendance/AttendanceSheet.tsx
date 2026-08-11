import React, { useMemo, useState } from "react";
import { Session, Student, AttendanceStatus } from "../../types";
import {
  buildAttendanceRecords, summarizeAttendance, ATTENDANCE_ORDER, ATTENDANCE_LABELS,
} from "../../lib/attendance";
import { takenAtMillis } from "../../lib/repo/sessions";
import { ArrowLeft, Save, AlertCircle, CheckCircle2 } from "lucide-react";

/* onSave trả kết quả chứ không ném lỗi: ném lỗi qua ranh giới component buộc
   mỗi bên phải biết kiểu lỗi của bên kia.

   Dùng một hình dạng phẳng thay vì kiểu hợp phân biệt (discriminated union):
   tsconfig của dự án không bật `strict`, nên TypeScript không thu hẹp được
   `ok: true | false` và mọi lần đọc `message` sẽ báo lỗi. */
export interface SaveOutcome {
  ok: boolean;
  message?: string;
  /* Có mặt (kể cả giá trị null) nghĩa là lỗi do xung đột, và đây là mốc
     takenAt mới trên máy chủ. Vắng mặt nghĩa là lỗi vì lý do khác. */
  conflictTakenAtMs?: number | null;
  isConflict?: boolean;
}

interface Props {
  session: Session;
  students: Student[];
  enrolledIds: string[];
  saving: boolean;
  onSave: (
    records: Record<string, AttendanceStatus>,
    note: string,
    expectedTakenAtMs: number | null
  ) => Promise<SaveOutcome>;
  onBack: () => void;
}

/* Màu từng trạng thái — chỉ dùng token có sẵn trong index.css, không thêm
   màu mới chỉ vì bảng này. */
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "border-ok bg-[#E6F7F0] text-ok-deep",
  late: "border-brand-sky-deep bg-[#E4F4FD] text-brand-navy",
  excused: "border-line bg-[#EEF3F8] text-ink-2",
  absent: "border-danger bg-[#FDECEC] text-danger-deep",
};

export default function AttendanceSheet({
  session, students, enrolledIds, saving, onSave, onBack,
}: Props) {
  /* Khởi tạo một lần từ ghi danh hiện tại + bản đã lưu (nếu có). KHÔNG đồng
     bộ lại theo props: nếu đồng bộ, một lần nạp dữ liệu nền sẽ xóa sạch
     những gì giảng viên vừa tick. */
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(
    () => buildAttendanceRecords(enrolledIds, session.records)
  );
  const [note, setNote] = useState(session.note || "");
  const [error, setError] = useState<string | null>(null);

  /* Mốc lúc mở màn hình, dùng để phát hiện người khác lưu chen ngang. Khi có
     xung đột thì cập nhật lại bằng mốc mới, nếu không lần bấm Lưu thứ hai
     vẫn gửi mốc cũ và sẽ xung đột mãi mãi. */
  const [expectedTakenAtMs, setExpectedTakenAtMs] = useState<number | null>(
    () => takenAtMillis(session.takenAt)
  );

  /* Component này không bị tháo ra khi đổi buổi (chỉ đổi props), nên phải tự
     nạp lại state — nếu không, mở buổi B sẽ thấy nguyên những gì đã tick ở
     buổi A. Đặt state ngay trong lúc render là cách React khuyến nghị cho
     tình huống "state phụ thuộc props": React dừng render và chạy lại ngay,
     không có nhấp nháy và không cần useEffect. */
  const [renderedFor, setRenderedFor] = useState(session.id);
  if (renderedFor !== session.id) {
    setRenderedFor(session.id);
    setRecords(buildAttendanceRecords(enrolledIds, session.records));
    setNote(session.note || "");
    setExpectedTakenAtMs(takenAtMillis(session.takenAt));
    setError(null);
  }

  const summary = useMemo(() => summarizeAttendance(records), [records]);

  const rows = useMemo(() => enrolledIds
    .map(id => {
      const s = students.find(x => x.id === id);
      return { id, name: s?.fullName || id, department: s?.department || "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi")),
  [enrolledIds, students]);

  const handleSave = async () => {
    setError(null);
    const outcome = await onSave(records, note, expectedTakenAtMs);
    if (outcome.ok) return;

    setError(outcome.message || "Không lưu được. Vui lòng thử lại.");
    /* Xung đột: nhận mốc mới để lần bấm Lưu tiếp theo ghi đè được, đúng như
       thông báo đang hứa với người dùng. */
    if (outcome.isConflict) {
      setExpectedTakenAtMs(outcome.conflictTakenAtMs ?? null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface p-5 space-y-3">
        <button
          id="btn-attendance-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-3 hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Về danh sách buổi
        </button>

        <div>
          <h3 className="text-[17px] font-extrabold tracking-[-0.02em]">
            {session.topic || "Buổi học"}
          </h3>
          <p className="text-[13px] text-ink-3 tnum">
            {session.date} · {session.startTime} · {session.durationMin} phút
          </p>
        </div>

        {/* Bốn con số tổng hợp, cập nhật ngay khi tick */}
        <div className="grid grid-cols-4 gap-2">
          {ATTENDANCE_ORDER.map(st => (
            <div key={st} className="surface-tile p-2.5 text-center">
              <span className="block text-[10px] font-extrabold text-ink-4 uppercase tracking-[0.06em]">
                {ATTENDANCE_LABELS[st]}
              </span>
              <span className="block text-[20px] font-extrabold tnum leading-none mt-1">
                {summary[st]}
              </span>
            </div>
          ))}
        </div>

        <button
          id="btn-mark-all-present"
          onClick={() => setRecords(Object.fromEntries(enrolledIds.map(id => [id, "present"])))}
          className="px-3 py-2 text-[12.5px] font-semibold text-ink-3 border border-line-soft rounded-field hover:bg-white transition-colors cursor-pointer"
        >
          Đánh dấu cả lớp có mặt
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-field border border-danger bg-[#FDECEC] px-3.5 py-3" role="alert">
            <AlertCircle className="w-4 h-4 flex-none mt-0.5 text-danger-deep" />
            <p className="text-[13px] text-danger-deep leading-relaxed">{error}</p>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="surface p-8 text-center text-[13px] text-ink-4 italic">
          Lớp này chưa có học viên nào ghi danh. Xếp lớp ở tab Phân lớp trước.
        </div>
      ) : (
        <div className="surface divide-y divide-line-soft">
          {rows.map((r, i) => (
            <div key={r.id} className="p-3.5 space-y-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] tnum text-ink-4 w-6 flex-none">{i + 1}</span>
                <div className="min-w-0">
                  <span className="block text-[14px] font-bold text-ink truncate">{r.name}</span>
                  <span className="block text-[11.5px] text-ink-4 truncate">{r.department}</span>
                </div>
              </div>

              {/* Bốn nút thay cho ô chọn: chạm một lần là xong, không phải mở
                  danh sách rồi chọn — quan trọng khi đang đứng lớp. */}
              <div className="grid grid-cols-4 gap-1.5">
                {ATTENDANCE_ORDER.map(st => {
                  const on = records[r.id] === st;
                  return (
                    <button
                      key={st}
                      id={`att-${r.id}-${st}`}
                      onClick={() => setRecords(prev => ({ ...prev, [r.id]: st }))}
                      className={`min-h-[44px] px-1 rounded-field border text-[12px] font-bold transition-colors cursor-pointer ${
                        on ? STATUS_STYLE[st] : "border-line-soft text-ink-4 hover:bg-[#F8FBFE]"
                      }`}
                    >
                      {ATTENDANCE_LABELS[st]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="surface p-5 space-y-3">
        <label htmlFor="attendance-note" className="block text-[13.5px] font-bold text-ink-2">
          Ghi chú buổi học
        </label>
        <textarea
          id="attendance-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ví dụ: mất điện 15 phút đầu, lùi nội dung sang buổi sau."
          className="field w-full px-3.5 py-2.5 text-[13.5px]"
        />

        <button
          id="btn-save-attendance"
          onClick={handleSave}
          disabled={saving || rows.length === 0}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-[15px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Save className="w-4 h-4 animate-pulse" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? "Đang lưu…" : "Lưu điểm danh"}
        </button>
      </div>
    </div>
  );
}
