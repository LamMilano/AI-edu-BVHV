import React, { useMemo, useState } from "react";
import { Student, ClassRecord, Enrollment } from "../../types";
import { rankClassesForStudent, scoreClassForStudent } from "../../lib/matching";
import { addStudentsToClass, filterStudents } from "../../lib/bulkAssign";
import { poolForLevel } from "../../lib/assignPool";
import { NewEnrollment } from "../../lib/repo/enrollments";
import { LEVEL_IDS, LEVEL_LABEL, LEVEL_RAMP, LevelId } from "../../lib/levels";
import { Wand2, Save, X, Trash2, Users, Plus, Check, Search, Inbox } from "lucide-react";

interface Props {
  students: Student[];
  classes: ClassRecord[];
  enrollments: Enrollment[];
  saving: boolean;
  onSave: (rows: NewEnrollment[]) => Promise<void>;
  onUnenroll: (classId: string, studentId: string) => Promise<void>;
}

export default function AssignmentBoard({
  students, classes, enrollments, saving, onSave, onUnenroll,
}: Props) {
  const [level, setLevel] = useState<LevelId>("L1");

  /* Đề xuất chưa lưu: studentId → classId. Sống trong bộ nhớ cho tới khi bấm
     "Lưu tất cả" — tải lại trang là mất hết, và đó chính là ý muốn: xếp sai
     thì chỉ cần bỏ đi, không phải đi sửa dữ liệu đã ghi. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /* Lớp "đang nhận": chọn lớp đích trước, rồi bấm từng học viên cho nhanh —
     xếp một lớp 20 người bằng dropdown là 40+ lần click, kiểu này chỉ còn 20. */
  const [targetClassId, setTargetClassId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const levelClasses = useMemo(
    () => classes.filter(c => c.level === level && c.status !== "closed"),
    [classes, level]
  );

  /* Ai còn phải xếp vào cấp độ này — kể cả người khảo sát xếp C2/C3, vì cấp
     khảo sát chỉ là đích lộ trình. Quy tắc nằm trong poolForLevel; giữ ở tầng
     ứng dụng vì Firestore Rules không biểu diễn được ràng buộc chéo-document. */
  const unassigned = useMemo(
    () => poolForLevel(students, enrollments, classes, level),
    [students, enrollments, classes, level]
  );

  // Số chỗ còn lại, đã trừ cả đề xuất chưa lưu.
  const remainingOf = (cls: ClassRecord) => {
    const drafted = Object.values(drafts).filter(cid => cid === cls.id).length;
    return cls.capacity - cls.enrolledCount - drafted;
  };

  /* Lớp đích lấy từ levelClasses, nên đổi cấp độ là tự rơi về null — không thể
     lỡ tay nhận học viên L1 vào một lớp L3 còn sót lại trong state. */
  const targetClass = levelClasses.find(c => c.id === targetClassId) || null;
  const targetRemaining = targetClass ? remainingOf(targetClass) : 0;

  // Điểm khớp với lớp đích, chấm sẵn một lượt để vừa sắp xếp vừa hiển thị.
  const targetScores = useMemo(() => {
    const map = new Map<string, number>();
    if (targetClass) {
      for (const s of unassigned) map.set(s.id!, scoreClassForStudent(s, targetClass).score);
    }
    return map;
  }, [unassigned, targetClass]);

  /* Danh sách đang hiển thị bên trái: lọc theo từ khoá, và khi đã chọn lớp đích
     thì đẩy người khớp lịch nhất lên đầu để bấm từ trên xuống là xong. */
  const visible = useMemo(() => {
    const list = filterStudents(unassigned, query);
    if (!targetClass) return list;
    return [...list].sort((a, b) => (targetScores.get(b.id!) ?? 0) - (targetScores.get(a.id!) ?? 0));
  }, [unassigned, query, targetClass, targetScores]);

  const addToTarget = (ids: string[]) => {
    if (!targetClass) return;
    const r = addStudentsToClass(drafts, ids, targetClass.id!, targetRemaining);
    setDrafts(r.drafts);
    setNotice(
      r.skipped > 0
        ? `${targetClass.name} đã đầy — thêm được ${r.added} người, còn ${r.skipped} người chưa xếp.`
        : ""
    );
  };

  const removeFromDrafts = (studentId: string) => {
    setDrafts(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    setNotice("");
  };

  const pickTarget = (classId: string) => {
    setTargetClassId(prev => (prev === classId ? null : classId));
    setNotice("");
  };

  const autoAssign = () => {
    const next: Record<string, string> = {};
    // Bản sao sức chứa để không xếp quá chỗ trong cùng một lượt.
    const room = new Map<string, number>(
      levelClasses.map(c => [c.id!, c.capacity - c.enrolledCount] as [string, number])
    );

    for (const s of unassigned) {
      const ranked = rankClassesForStudent(s, levelClasses);
      const pick = ranked.find(r => (room.get(r.classId) || 0) > 0);
      if (!pick) continue;
      next[s.id!] = pick.classId;
      room.set(pick.classId, (room.get(pick.classId) || 0) - 1);
    }
    setDrafts(next);
  };

  const draftCount = Object.keys(drafts).length;

  const handleSave = async () => {
    const rows: NewEnrollment[] = [];
    for (const [studentId, classId] of Object.entries(drafts) as [string, string][]) {
      const s = students.find(x => x.id === studentId);
      const c = levelClasses.find(x => x.id === classId);
      if (!s || !c) continue;
      // Chấm lại đúng lớp giáo vụ chốt, không phải lớp hệ thống đề xuất ban đầu.
      const scored = rankClassesForStudent(s, [c])[0];
      rows.push({
        classId, studentId, level,
        matchScore: scored?.score ?? null,
        matchReason: scored?.reason ?? null,
      });
    }
    await onSave(rows);
    setDrafts({});
  };

  return (
    <div className="space-y-4">
      <div className="surface p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#E8F0F9] to-[#DCE8F4]">
            {LEVEL_IDS.map(id => (
              <button
                key={id}
                id={`assign-level-${id}`}
                onClick={() => {
                  setLevel(id); setDrafts({});
                  setTargetClassId(null); setQuery(""); setNotice("");
                }}
                className={`px-3.5 py-1.5 text-[12.5px] font-bold rounded-[7px] transition-all cursor-pointer ${
                  level === id
                    ? "bg-gradient-to-b from-white to-[#F6FAFD] text-brand-navy shadow-[0_2px_6px_-2px_rgb(20_51_110/0.3)]"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {LEVEL_LABEL[id]}
              </button>
            ))}
          </div>

          <button
            id="btn-auto-assign"
            onClick={autoAssign}
            disabled={unassigned.length === 0 || levelClasses.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-bold text-brand-navy border border-line-soft rounded-field hover:bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Xếp tự động
          </button>

          {draftCount > 0 && (
            <>
              <button
                id="btn-save-assignments"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Đang lưu…" : `Lưu tất cả (${draftCount})`}
              </button>
              <button
                id="btn-clear-drafts"
                onClick={() => { setDrafts({}); setNotice(""); }}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-ink-3 hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Bỏ đề xuất
              </button>
            </>
          )}
        </div>

        {draftCount > 0 && (
          <p className="text-[12.5px] text-ink-3">
            {draftCount} đề xuất chưa lưu (viền đứt). Tải lại trang là mất hết — chưa có gì được ghi.
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ══ CỘT TRÁI — học viên chưa xếp ══ */}
        <div className="surface p-5 space-y-3">
          <h4 className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em]">
            Chưa xếp lớp · {unassigned.length} học viên
            {query.trim() && ` · đang hiện ${visible.length}`}
          </h4>

          {unassigned.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-4 italic">
              Không còn ai chờ xếp {LEVEL_LABEL[level]} — đã có lớp hoặc đang học lớp khác.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ink-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="assign-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên hoặc khoa/phòng — gõ không dấu cũng được"
                  className="field w-full pl-9 pr-9 py-2 text-[12.5px]"
                />
                {query && (
                  <button
                    id="btn-clear-search"
                    onClick={() => setQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink transition-colors cursor-pointer"
                    aria-label="Xoá từ khoá"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Thanh chỉ hiện khi đã chọn lớp đích bên phải. */}
              {targetClass && (
                <div className="rounded-field border border-brand-sky-deep bg-[#F2F9FE] px-3.5 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-ink-2 min-w-0 truncate">
                      Đang nhận vào <b className="text-brand-navy">{targetClass.name}</b>
                      <span className="text-ink-3"> · còn {Math.max(0, targetRemaining)} chỗ</span>
                    </span>
                    <button
                      id="btn-exit-target"
                      onClick={() => pickTarget(targetClass.id!)}
                      className="text-[12px] font-semibold text-ink-3 hover:text-ink transition-colors cursor-pointer flex-none"
                    >
                      Thoát
                    </button>
                  </div>
                  <button
                    id="btn-add-all-visible"
                    onClick={() => addToTarget(visible.map(s => s.id!))}
                    disabled={targetRemaining <= 0 || visible.length === 0}
                    className="btn-primary w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Inbox className="w-3.5 h-3.5" />
                    {targetRemaining <= 0
                      ? "Lớp đã đầy"
                      : `Thêm hết ${visible.length} người đang hiện vào lớp này`}
                  </button>
                </div>
              )}

              {notice && <p className="text-[12.5px] font-semibold text-danger">{notice}</p>}

              {visible.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-ink-4 italic">
                  Không có ai khớp “{query}”.
                </p>
              ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto">
                {visible.map(s => {
                const draftClassId = drafts[s.id!];
                const ranked = rankClassesForStudent(s, levelClasses);
                const suggestion = ranked.find(r => r.classId === draftClassId);
                const inTarget = !!targetClass && draftClassId === targetClass.id;

                return (
                  <div
                    key={s.id}
                    className={`rounded-field px-3.5 py-3 border transition-colors ${
                      draftClassId
                        ? "border-dashed border-brand-sky-deep bg-[#F2F9FE]"
                        : "border-line-soft"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[13.5px] font-bold text-ink truncate">{s.fullName}</span>
                          {/* Cấp khảo sát khác tab đang xem: người này học xong lớp
                              này rồi vẫn còn lộ trình phía trước — giáo vụ cần thấy. */}
                          {s.currentLevel !== level && (
                            <span
                              title={`Khảo sát xếp ${LEVEL_LABEL[s.currentLevel]} — sau lớp này còn học tiếp`}
                              className={`flex-none px-1.5 py-0.5 rounded-[4px] text-[10px] font-extrabold tracking-[0.06em] bg-gradient-to-br ${LEVEL_RAMP[s.currentLevel].pill}`}
                            >
                              đích {s.currentLevel.replace("L", "C")}
                            </span>
                          )}
                        </div>
                        <span className="block text-[11.5px] text-ink-4 truncate">{s.department}</span>
                        <span className="block text-[11.5px] text-ink-3 mt-1">
                          {s.availability?.days?.length
                            ? `Rảnh ${s.availability.days.join(", ")} · ${s.availability.timeframes.join(", ")}`
                            : "Chưa có dữ liệu lịch rảnh"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        {/* Chưa chọn lớp đích thì chỉ hiện % của lớp đang nháp;
                            đã chọn thì hiện % so với chính lớp đích. */}
                        {targetClass ? (
                          <span className="text-[11px] font-extrabold tnum text-brand-sky-deep">
                            {targetScores.get(s.id!) ?? 0}%
                          </span>
                        ) : suggestion && (
                          <span className="text-[11px] font-extrabold tnum text-brand-sky-deep">
                            {suggestion.score}%
                          </span>
                        )}

                        {targetClass && (
                          inTarget ? (
                            <button
                              id={`btn-remove-${s.id}`}
                              onClick={() => removeFromDrafts(s.id!)}
                              title="Bỏ khỏi lớp đang nhận"
                              className="w-8 h-8 grid place-items-center rounded-field bg-brand-sky-deep text-white hover:bg-brand-navy transition-colors cursor-pointer"
                              aria-label={`Bỏ ${s.fullName} khỏi ${targetClass.name}`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              id={`btn-add-${s.id}`}
                              onClick={() => addToTarget([s.id!])}
                              disabled={targetRemaining <= 0}
                              title={targetRemaining <= 0 ? "Lớp đã đầy" : `Thêm vào ${targetClass.name}`}
                              className="w-8 h-8 grid place-items-center rounded-field border border-brand-sky-deep text-brand-sky-deep hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={`Thêm ${s.fullName} vào ${targetClass.name}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <select
                      id={`assign-select-${s.id}`}
                      value={draftClassId || ""}
                      onChange={(e) => setDrafts(prev => {
                        const next = { ...prev };
                        if (e.target.value) next[s.id!] = e.target.value;
                        else delete next[s.id!];
                        return next;
                      })}
                      className="field w-full mt-2.5 px-3 py-2 text-[12.5px]"
                    >
                      <option value="">— Chưa xếp —</option>
                      {levelClasses.map(c => (
                        <option
                          key={c.id}
                          value={c.id}
                          disabled={remainingOf(c) <= 0 && draftClassId !== c.id}
                        >
                          {c.name} ({remainingOf(c)} chỗ)
                        </option>
                      ))}
                    </select>

                    {suggestion && (
                      <p className="text-[11.5px] text-ink-4 mt-1.5">{suggestion.reason}</p>
                    )}
                  </div>
                );
                })}
              </div>
              )}
            </>
          )}
        </div>

        {/* ══ CỘT PHẢI — các lớp và người đã ghi danh ══ */}
        <div className="space-y-3">
          {levelClasses.length === 0 ? (
            <div className="surface p-8 text-center text-[13px] text-ink-4 italic">
              Chưa có lớp {LEVEL_LABEL[level]} nào. Tạo lớp ở tab Lớp học trước.
            </div>
          ) : (
            levelClasses.map(c => {
              const members = enrollments.filter(e => e.classId === c.id && e.status === "enrolled");
              const drafted = Object.entries(drafts).filter(([, cid]) => cid === c.id);
              const isTarget = targetClassId === c.id;
              const full = remainingOf(c) <= 0;

              return (
                <div
                  key={c.id}
                  className={`surface p-5 space-y-3 transition-shadow ${
                    isTarget ? "ring-2 ring-brand-sky-deep" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-extrabold tracking-tight truncate">{c.name}</h4>
                      <p className="text-[12px] text-ink-3">
                        {c.plannedSchedule.days.length > 0
                          ? [c.plannedSchedule.days.join(", "), c.plannedSchedule.timeframe]
                              .filter(Boolean).join(" · ")
                          : "Chưa khai lịch"}
                      </p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-[5px] text-[11.5px] font-bold tnum flex-none bg-gradient-to-br ${LEVEL_RAMP[c.level].pill}`}>
                      {members.length + drafted.length} / {c.capacity}
                    </span>
                  </div>

                  {/* Bật/tắt chế độ bấm-để-thêm cho đúng lớp này. */}
                  <button
                    id={`btn-target-${c.id}`}
                    onClick={() => pickTarget(c.id!)}
                    disabled={full && !isTarget}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] font-bold rounded-field transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isTarget
                        ? "bg-brand-sky-deep text-white hover:bg-brand-navy"
                        : "border border-line-soft text-brand-navy hover:bg-white"
                    }`}
                  >
                    {isTarget ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {isTarget
                      ? "Đang nhận — bấm để thoát"
                      : full ? "Lớp đã đầy" : "Nhận học viên vào lớp này"}
                  </button>

                  {members.length === 0 && drafted.length === 0 ? (
                    <p className="text-[12.5px] text-ink-4 italic flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Chưa có học viên nào.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {members.map(e => {
                        const s = students.find(x => x.id === e.studentId);
                        return (
                          <div key={e.id} className="flex items-center gap-2 text-[12.5px]">
                            <span className="flex-1 truncate text-ink-2">{s?.fullName || e.studentId}</span>
                            {e.matchScore !== null && e.matchScore !== undefined && (
                              <span className="tnum text-ink-4 text-[11px] flex-none">{e.matchScore}%</span>
                            )}
                            <button
                              id={`btn-unenroll-${e.id}`}
                              onClick={() => {
                                if (!confirm(`Bỏ ${s?.fullName || e.studentId} khỏi lớp ${c.name}?`)) return;
                                onUnenroll(c.id!, e.studentId);
                              }}
                              className="text-danger hover:text-danger-deep transition-colors cursor-pointer flex-none"
                              aria-label="Bỏ khỏi lớp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      {drafted.map(([studentId]) => {
                        const s = students.find(x => x.id === studentId);
                        return (
                          <div key={`d-${studentId}`} className="flex items-center gap-2 text-[12.5px]">
                            <span className="flex-1 truncate text-brand-sky-deep font-semibold">
                              {s?.fullName || studentId}
                            </span>
                            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-brand-sky-deep flex-none">
                              nháp
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
