import React, { useMemo, useState } from "react";
import { Student } from "../../types";
import { findDuplicateGroups } from "../../lib/students";
import { CheckCircle2, GitMerge, ShieldQuestion } from "lucide-react";

interface Props {
  students: Student[];
  busy: boolean;
  onMerge: (keepId: string, dropId: string) => Promise<void>;
  onDismiss: (idA: string, idB: string) => Promise<void>;
}

export default function DuplicateReview({ students, busy, onMerge, onDismiss }: Props) {
  const groups = useMemo(() => findDuplicateGroups(students), [students]);
  // Hồ sơ được chọn giữ lại, theo từng nhóm.
  const [keepBy, setKeepBy] = useState<Record<string, string>>({});

  if (groups.length === 0) {
    return (
      <div className="surface p-8 flex flex-col items-center text-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-ok" />
        <div>
          <h4 className="text-[15px] font-extrabold tracking-tight">Không có hồ sơ nghi trùng</h4>
          <p className="text-[13px] text-ink-3 mt-1">
            Mọi hồ sơ đều có tên hoặc khoa/phòng khác nhau, hoặc đã được xử lý.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Không có token màu cảnh báo trong index.css (chỉ có ok/danger), nên
          hộp lưu ý dùng đúng nền xanh nhạt của hệ thay vì thêm màu mới. */}
      <div className="flex items-start gap-2.5 rounded-field border border-line-soft bg-[#F6FAFD] px-4 py-3">
        <ShieldQuestion className="w-4 h-4 flex-none mt-0.5 text-brand-navy" />
        <p className="text-[13px] text-ink-2 leading-relaxed">
          Các hồ sơ dưới đây <strong>cùng tên và cùng khoa/phòng nhưng khác email</strong>.
          Hệ thống không tự gộp — hai người trùng tên trong một khoa là chuyện có thật.
          Chọn hồ sơ giữ lại rồi bấm Gộp, hoặc đánh dấu không trùng để lần sau không hỏi lại.
        </p>
      </div>

      {groups.map((g) => {
        const keepId = keepBy[g.key] || g.students[0].id!;
        const others = g.students.filter(s => s.id !== keepId);

        return (
          <div key={g.key} className="surface p-5 space-y-4">
            <div>
              <h4 className="text-[15px] font-extrabold tracking-tight">{g.fullName}</h4>
              <p className="text-[12.5px] text-ink-3">{g.department} · {g.students.length} hồ sơ</p>
            </div>

            <div className="space-y-2">
              {g.students.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 rounded-field border px-3.5 py-3 cursor-pointer transition-colors ${
                    keepId === s.id
                      ? "border-brand-sky-deep bg-[#F2F9FE]"
                      : "border-line-soft hover:bg-[#F8FBFE]"
                  }`}
                >
                  <input
                    type="radio"
                    name={`keep-${g.key}`}
                    checked={keepId === s.id}
                    onChange={() => setKeepBy((prev) => ({ ...prev, [g.key]: s.id! }))}
                    className="accent-[#2E86C8]"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink truncate">{s.email}</span>
                    <span className="block text-[11.5px] text-ink-4 tnum">
                      {s.phone || "chưa có số điện thoại"} · {s.submissionCount} phiếu · {s.currentLevel}
                    </span>
                  </div>
                  {keepId === s.id && (
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-brand-sky-deep flex-none">
                      Giữ lại
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {others.map((s) => (
                <button
                  key={`merge-${s.id}`}
                  id={`btn-merge-${s.id}`}
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`Gộp ${s.email} vào ${keepId}? Hồ sơ ${s.email} sẽ bị xóa.`)) return;
                    onMerge(keepId, s.id!);
                  }}
                  className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  Gộp {s.email}
                </button>
              ))}
              {others.map((s) => (
                <button
                  key={`dismiss-${s.id}`}
                  id={`btn-dismiss-${s.id}`}
                  disabled={busy}
                  onClick={() => onDismiss(keepId, s.id!)}
                  className="px-3.5 py-2 text-[12.5px] font-semibold text-ink-3 border border-line-soft rounded-field hover:bg-white transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Không trùng với {s.email}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
