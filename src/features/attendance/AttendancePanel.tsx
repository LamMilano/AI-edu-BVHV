import React, { useMemo, useState } from "react";
import { ClassRecord, Student, Enrollment, Session, AttendanceStatus } from "../../types";
import AttendanceSheet, { SaveOutcome } from "./AttendanceSheet";
import {
  createSession, updateSessionStatus, deleteSession, saveAttendance, AttendanceConflictError,
} from "../../lib/repo/sessions";
import { summarizeAttendance } from "../../lib/attendance";
import { Plus, CalendarDays, Ban, Trash2, ClipboardCheck } from "lucide-react";

interface Props {
  classes: ClassRecord[];
  students: Student[];
  enrollments: Enrollment[];
  sessions: Session[];
  currentUid: string;
  onRefresh: () => Promise<void> | void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AttendancePanel({
  classes, students, enrollments, sessions, currentUid, onRefresh,
}: Props) {
  const openClasses = useMemo(() => classes.filter(c => c.status !== "closed"), [classes]);

  const [classId, setClassId] = useState<string>(() => openClasses[0]?.id || "");
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState({
    date: todayISO(), startTime: "18:00", durationMin: 120, topic: "",
  });

  const classSessions = useMemo(
    () => sessions.filter(s => s.classId === classId), [sessions, classId]
  );

  const enrolledIds = useMemo(
    () => enrollments
      .filter(e => e.classId === classId && e.status === "enrolled")
      .map(e => e.studentId),
    [enrollments, classId]
  );

  const openSession = classSessions.find(s => s.id === openSessionId) || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    if (!draft.date) { alert("Vui lòng chọn ngày học!"); return; }

    setSaving(true);
    try {
      await createSession({ classId, ...draft });
      setShowForm(false);
      setDraft({ date: todayISO(), startTime: "18:00", durationMin: 120, topic: "" });
      await onRefresh();
    } catch (err) {
      console.error("Lỗi khi tạo buổi học: ", err);
      alert("Không tạo được buổi học. Kiểm tra quyền tài khoản và thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttendance = async (
    records: Record<string, AttendanceStatus>,
    note: string,
    expectedTakenAtMs: number | null
  ): Promise<SaveOutcome> => {
    if (!openSession?.id) return { ok: false, message: "Buổi học không còn tồn tại." };

    setSaving(true);
    try {
      await saveAttendance({
        sessionId: openSession.id, records, note,
        takenBy: currentUid, expectedTakenAtMs,
      });
      await onRefresh();
      setOpenSessionId(null);
      return { ok: true };
    } catch (err) {
      /* Không đóng màn hình và không xóa gì: mọi thao tác đã tick vẫn nằm
         nguyên trong state của AttendanceSheet để giảng viên bấm lưu lại. */
      if (err instanceof AttendanceConflictError) {
        const when = err.takenAtMs
          ? new Date(err.takenAtMs).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : "vừa xong";
        return {
          ok: false,
          isConflict: true,
          conflictTakenAtMs: err.takenAtMs,
          message:
            `Buổi này vừa được người khác lưu lúc ${when}. Tải lại trang để xem bản của họ, ` +
            `hoặc bấm Lưu điểm danh lần nữa để ghi đè bằng bản của bạn.`,
        };
      }
      console.error("Lỗi khi lưu điểm danh: ", err);
      return {
        ok: false,
        message: "Không lưu được. Kiểm tra kết nối mạng rồi bấm Lưu điểm danh lần nữa — thao tác của bạn vẫn còn nguyên.",
      };
    } finally {
      setSaving(false);
    }
  };

  if (openSession) {
    return (
      <AttendanceSheet
        session={openSession}
        students={students}
        enrolledIds={enrolledIds}
        saving={saving}
        onSave={handleSaveAttendance}
        onBack={() => setOpenSessionId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="attendance-class" className="block text-[13.5px] font-bold text-ink-2 mb-2">
              Lớp học
            </label>
            <select
              id="attendance-class"
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setOpenSessionId(null); }}
              className="field w-full px-3.5 py-2.5 text-[14px]"
            >
              {openClasses.length === 0 && <option value="">Chưa có lớp nào</option>}
              {openClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <button
            id="btn-toggle-session-form"
            onClick={() => setShowForm(v => !v)}
            disabled={!classId}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 text-[13.5px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {showForm ? "Đóng" : "Thêm buổi"}
          </button>
        </div>

        {classId && (
          <p className="text-[12.5px] text-ink-3">
            {enrolledIds.length} học viên đang ghi danh lớp này.
          </p>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-line-soft">
            <div>
              <label htmlFor="session-date" className="block text-[13px] font-bold text-ink-2 mb-1.5">Ngày</label>
              <input
                id="session-date" type="date" required
                value={draft.date}
                onChange={(e) => setDraft(p => ({ ...p, date: e.target.value }))}
                className="field w-full px-3.5 py-2.5 text-[14px]"
              />
            </div>
            <div>
              <label htmlFor="session-time" className="block text-[13px] font-bold text-ink-2 mb-1.5">Giờ bắt đầu</label>
              <input
                id="session-time" type="time" required
                value={draft.startTime}
                onChange={(e) => setDraft(p => ({ ...p, startTime: e.target.value }))}
                className="field w-full px-3.5 py-2.5 text-[14px]"
              />
            </div>
            <div>
              <label htmlFor="session-duration" className="block text-[13px] font-bold text-ink-2 mb-1.5">Thời lượng (phút)</label>
              <input
                id="session-duration" type="number" min={15} step={15}
                value={draft.durationMin}
                onChange={(e) => setDraft(p => ({ ...p, durationMin: parseInt(e.target.value) || 0 }))}
                className="field w-full px-3.5 py-2.5 text-[14px] tnum"
              />
            </div>
            <div>
              <label htmlFor="session-topic" className="block text-[13px] font-bold text-ink-2 mb-1.5">Chủ đề</label>
              <input
                id="session-topic" type="text"
                value={draft.topic}
                onChange={(e) => setDraft(p => ({ ...p, topic: e.target.value }))}
                placeholder="Buổi 1: Nhập môn Prompt"
                className="field w-full px-3.5 py-2.5 text-[14px]"
              />
            </div>
            <button
              id="btn-create-session" type="submit" disabled={saving}
              className="btn-primary sm:col-span-2 py-2.5 text-[14px] cursor-pointer disabled:opacity-60"
            >
              {saving ? "Đang tạo…" : "Tạo buổi học"}
            </button>
          </form>
        )}
      </div>

      {classSessions.length === 0 ? (
        <div className="surface p-8 flex flex-col items-center text-center gap-3">
          <CalendarDays className="w-8 h-8 text-ink-4" />
          <p className="text-[13.5px] text-ink-3">
            Lớp này chưa có buổi học nào. Bấm “Thêm buổi” để tạo buổi đầu tiên.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {classSessions.map(s => {
            const summary = summarizeAttendance(s.records || {});
            const cancelled = s.status === "cancelled";
            return (
              <div
                key={s.id}
                className={`surface p-4 flex flex-wrap items-center gap-3 ${cancelled ? "opacity-60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink truncate">
                    {s.topic || "Buổi học"}
                  </span>
                  <span className="block text-[12px] text-ink-3 tnum">
                    {s.date} · {s.startTime} · {s.durationMin} phút
                  </span>
                  {s.status === "done" && (
                    <span className="block text-[11.5px] text-ink-4 tnum mt-0.5">
                      Đã điểm danh · {summary.present} có mặt / {summary.total}
                      {summary.absent > 0 && ` · ${summary.absent} vắng`}
                    </span>
                  )}
                  {cancelled && (
                    <span className="block text-[11.5px] text-danger-deep mt-0.5">Đã hoãn</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-none">
                  {!cancelled && (
                    <button
                      id={`btn-open-attendance-${s.id}`}
                      onClick={() => setOpenSessionId(s.id!)}
                      className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      {s.status === "done" ? "Sửa điểm danh" : "Điểm danh"}
                    </button>
                  )}
                  <button
                    id={`btn-cancel-session-${s.id}`}
                    title={cancelled ? "Mở lại buổi" : "Đánh dấu hoãn"}
                    onClick={async () => {
                      await updateSessionStatus(s.id!, cancelled ? "scheduled" : "cancelled");
                      await onRefresh();
                    }}
                    className="text-ink-4 hover:text-brand-navy transition-colors p-1 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                  <button
                    id={`btn-delete-session-${s.id}`}
                    title="Xóa buổi"
                    onClick={async () => {
                      if (!confirm("Xóa hẳn buổi học này? Dữ liệu điểm danh của buổi sẽ mất. Muốn giữ dấu vết thì dùng nút Hoãn.")) return;
                      await deleteSession(s.id!);
                      await onRefresh();
                    }}
                    className="text-danger hover:text-danger-deep transition-colors p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
