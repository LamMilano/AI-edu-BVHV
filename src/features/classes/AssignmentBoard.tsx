import React, { useMemo, useState } from "react";
import { Student, ClassRecord, Enrollment } from "../../types";
import { rankClassesForStudent } from "../../lib/matching";
import { NewEnrollment } from "../../lib/repo/enrollments";
import { LEVEL_IDS, LEVEL_LABEL, LEVEL_RAMP, LevelId } from "../../lib/levels";
import { Wand2, Save, X, Trash2, Users } from "lucide-react";

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

  // Ghi danh đang hiệu lực, tra ngược theo học viên.
  const enrolledByStudent = useMemo(() => {
    const map = new Map<string, Enrollment>();
    for (const e of enrollments) {
      if (e.status === "enrolled") map.set(e.studentId, e);
    }
    return map;
  }, [enrollments]);

  const levelClasses = useMemo(
    () => classes.filter(c => c.level === level && c.status !== "closed"),
    [classes, level]
  );

  /* Chỉ hiện học viên chưa có ghi danh đang hiệu lực ở cấp độ này. Ràng buộc
     "một cấp độ một lớp" được giữ ở đây, vì Firestore Rules không biểu diễn
     được ràng buộc chéo-document. */
  const unassigned = useMemo(() => students.filter(s => {
    if (s.currentLevel !== level) return false;
    const current = enrolledByStudent.get(s.id!);
    return !current || current.level !== level;
  }), [students, level, enrolledByStudent]);

  // Số chỗ còn lại, đã trừ cả đề xuất chưa lưu.
  const remainingOf = (cls: ClassRecord) => {
    const drafted = Object.values(drafts).filter(cid => cid === cls.id).length;
    return cls.capacity - cls.enrolledCount - drafted;
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
                onClick={() => { setLevel(id); setDrafts({}); }}
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
                onClick={() => setDrafts({})}
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
          </h4>

          {unassigned.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-4 italic">
              Mọi học viên {LEVEL_LABEL[level]} đều đã có lớp.
            </p>
          ) : (
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {unassigned.map(s => {
                const draftClassId = drafts[s.id!];
                const ranked = rankClassesForStudent(s, levelClasses);
                const suggestion = ranked.find(r => r.classId === draftClassId);

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
                        <span className="block text-[13.5px] font-bold text-ink truncate">{s.fullName}</span>
                        <span className="block text-[11.5px] text-ink-4 truncate">{s.department}</span>
                        <span className="block text-[11.5px] text-ink-3 mt-1">
                          {s.availability?.days?.length
                            ? `Rảnh ${s.availability.days.join(", ")} · ${s.availability.timeframes.join(", ")}`
                            : "Chưa có dữ liệu lịch rảnh"}
                        </span>
                      </div>
                      {suggestion && (
                        <span className="text-[11px] font-extrabold tnum text-brand-sky-deep flex-none">
                          {suggestion.score}%
                        </span>
                      )}
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

              return (
                <div key={c.id} className="surface p-5 space-y-3">
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
