# GĐ4 — Buổi học & điểm danh: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giảng viên mở buổi học trên điện thoại, tick ngoại lệ, lưu một lượt — không mất thao tác khi mạng chập chờn, không âm thầm đè lên người khác.

**Architecture:** Điểm danh nhúng thẳng trong document buổi học (`sessions.records`), nên lưu cả lớp là **một lượt ghi nguyên tử**. Ghi bằng `runTransaction` có so mốc `takenAt` để phát hiện hai người cùng điểm danh một buổi. Logic dựng và tổng hợp bảng điểm danh nằm ở `lib/attendance.ts` dạng hàm thuần.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Firebase 12, Tailwind 4, Vitest.

## Global Constraints

- Chuỗi hiển thị bằng **tiếng Việt có dấu**; comment tiếng Việt giải thích **vì sao**.
- Commit message **không dấu**, tiền tố `feat:` / `fix:` / `refactor:`.
- Không thêm thư viện mới.
- `npm run lint && npm test` phải sạch trước mỗi commit.
- Không thêm token màu mới — `index.css` chỉ có `ok` và `danger`.
- **Màn điểm danh dùng trên điện thoại khi đang đứng lớp**: vùng chạm tối thiểu 44px, chữ tối thiểu 13px, không có thao tác cần hai tay.
- **Không bao giờ xóa thao tác của người dùng khi gặp lỗi.** Lưu thất bại thì giữ nguyên trạng thái đã tick và hiện nút thử lại.

## Quyết định phạm vi GĐ4

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Nơi đặt màn hình | Một tab **Điểm danh** duy nhất: chọn lớp → danh sách buổi → bảng điểm danh | Giảng viên làm ba việc này liền mạch trong một lần đứng lớp; tách ra hai tab bắt họ nhảy qua lại |
| Tab Lớp học | Giữ nguyên, chỉ định nghĩa lớp | Định nghĩa lớp là việc của giáo vụ, không phải của giảng viên |
| Buổi bị hoãn | Đánh dấu `cancelled`, không xóa | Báo cáo chuyên cần ở GĐ5 phải loại buổi hoãn khỏi mẫu số; xóa đi là mất dấu vết |
| Học viên ghi danh muộn | Không tính vắng các buổi trước | `records` chỉ chứa người đang `enrolled` lúc điểm danh — đúng ràng buộc "không hồi tố" trong spec |
| Ghi chú | Một ô ghi chú chung cho cả buổi | Ghi chú từng người là thứ chưa ai yêu cầu; thêm vào chỉ làm màn hình chật trên điện thoại |
| % chuyên cần, báo cáo, CSV | Ngoài phạm vi — GĐ5 | Cần dữ liệu điểm danh có thật trước đã |
| Nợ GĐ4 đã ghi ở `repo/students.ts` | Trả trong Task 5: gộp hồ sơ đổi luôn khóa trong `sessions.records` | Không trả thì gộp hồ sơ làm mất lịch sử điểm danh |

---

### Task 1: Kiểu `Session` + logic dựng bảng điểm danh

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/attendance.ts`
- Test: `src/lib/attendance.test.ts`

**Interfaces:**
- Produces:
  - `AttendanceStatus = "present" | "late" | "excused" | "absent"`
  - `Session`, `AttendanceSummary`
  - `ATTENDANCE_LABELS: Record<AttendanceStatus, string>`
  - `buildAttendanceRecords(enrolledIds: string[], existing?: Record<string, AttendanceStatus>): Record<string, AttendanceStatus>`
  - `summarizeAttendance(records: Record<string, AttendanceStatus>): AttendanceSummary`

- [ ] **Step 1: Thêm kiểu vào `src/types.ts`**

```ts
export type AttendanceStatus = "present" | "late" | "excused" | "absent";

/* Một buổi học. records nhúng thẳng trong document buổi: cả lớp lưu được
   trong MỘT lượt ghi, nên không có trạng thái "lưu dở nửa lớp". Đánh đổi:
   báo cáo chuyên cần của một học viên phải đọc hết các buổi — chấp nhận
   được ở quy mô vài chục buổi mỗi lớp. */
export interface Session {
  id?: string;
  classId: string;
  date: string;          // "2026-08-20" — ISO nên sắp xếp được bằng chuỗi
  startTime: string;     // "18:00"
  durationMin: number;
  topic: string;
  status: "scheduled" | "done" | "cancelled";
  records: Record<string, AttendanceStatus>;   // studentId → trạng thái
  note: string;
  takenBy: string | null;   // uid người điểm danh
  takenAt: any;             // Firestore Timestamp | null
  createdAt: any;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  excused: number;
  absent: number;
  total: number;
}
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/lib/attendance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildAttendanceRecords, summarizeAttendance } from "./attendance";

describe("buildAttendanceRecords", () => {
  it("mặc định cả lớp có mặt, vì vắng mới là ngoại lệ", () => {
    expect(buildAttendanceRecords(["a@x.vn", "b@x.vn"])).toEqual({
      "a@x.vn": "present",
      "b@x.vn": "present",
    });
  });

  it("giữ nguyên trạng thái đã điểm danh trước đó", () => {
    expect(buildAttendanceRecords(["a@x.vn", "b@x.vn"], { "a@x.vn": "absent" })).toEqual({
      "a@x.vn": "absent",
      "b@x.vn": "present",
    });
  });

  it("học viên ghi danh sau buổi đó được thêm vào với trạng thái có mặt", () => {
    const r = buildAttendanceRecords(["a@x.vn", "moi@x.vn"], { "a@x.vn": "late" });
    expect(r["moi@x.vn"]).toBe("present");
  });

  it("bỏ khỏi bảng người không còn ghi danh, để không đếm nhầm mẫu số", () => {
    const r = buildAttendanceRecords(["a@x.vn"], { "a@x.vn": "present", "da-nghi@x.vn": "absent" });
    expect(r).toEqual({ "a@x.vn": "present" });
  });

  it("lớp chưa có ai thì bảng rỗng", () => {
    expect(buildAttendanceRecords([])).toEqual({});
  });

  it("trạng thái lạ trong dữ liệu cũ bị thay bằng có mặt thay vì giữ nguyên", () => {
    const r = buildAttendanceRecords(["a@x.vn"], { "a@x.vn": "khong-biet" as any });
    expect(r["a@x.vn"]).toBe("present");
  });
});

describe("summarizeAttendance", () => {
  it("đếm đúng từng trạng thái và tổng", () => {
    expect(summarizeAttendance({
      a: "present", b: "present", c: "late", d: "excused", e: "absent",
    })).toEqual({ present: 2, late: 1, excused: 1, absent: 1, total: 5 });
  });

  it("bảng rỗng cho ra toàn số 0", () => {
    expect(summarizeAttendance({}))
      .toEqual({ present: 0, late: 0, excused: 0, absent: 0, total: 0 });
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./attendance"`

- [ ] **Step 4: Viết `src/lib/attendance.ts`**

```ts
import { AttendanceStatus, AttendanceSummary } from "../types";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  late: "Muộn",
  excused: "Vắng có phép",
  absent: "Vắng",
};

/* Thứ tự này quyết định thứ tự nút trên màn điểm danh: trạng thái hay dùng
   nhất đứng trước, để giảng viên chạm ít nhất khi đang đứng lớp. */
export const ATTENDANCE_ORDER: AttendanceStatus[] = ["present", "late", "excused", "absent"];

const isValidStatus = (v: unknown): v is AttendanceStatus =>
  typeof v === "string" && (ATTENDANCE_ORDER as string[]).includes(v);

/* Dựng bảng điểm danh cho một buổi.

   Mặc định CẢ LỚP có mặt: vắng mới là ngoại lệ, nên giảng viên chỉ phải
   chạm vào vài người thay vì cả ba mươi.

   Bảng chỉ chứa người ĐANG ghi danh. Người ghi danh muộn được thêm vào với
   trạng thái có mặt chứ không bị tính vắng ngược; người đã nghỉ bị loại khỏi
   bảng để không làm phồng mẫu số của báo cáo chuyên cần. */
export function buildAttendanceRecords(
  enrolledIds: string[],
  existing?: Record<string, AttendanceStatus>
): Record<string, AttendanceStatus> {
  const out: Record<string, AttendanceStatus> = {};
  for (const id of enrolledIds) {
    const prev = existing?.[id];
    out[id] = isValidStatus(prev) ? prev : "present";
  }
  return out;
}

export function summarizeAttendance(
  records: Record<string, AttendanceStatus>
): AttendanceSummary {
  const out: AttendanceSummary = { present: 0, late: 0, excused: 0, absent: 0, total: 0 };
  for (const status of Object.values(records)) {
    if (!isValidStatus(status)) continue;
    out[status]++;
    out.total++;
  }
  return out;
}
```

- [ ] **Step 5: Chạy test và kiểm tra kiểu**

Run: `npm test && npm run lint`
Expected: PASS — 8 test mới (tổng 64), lint sạch

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/attendance.ts src/lib/attendance.test.ts
git commit -m "feat: them kieu Session va logic dung bang diem danh

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Repo `sessions` — ghi bằng transaction có phát hiện xung đột

**Files:**
- Create: `src/lib/repo/sessions.ts`

**Interfaces:**
- Produces:
  - `fetchSessions(): Promise<Session[]>`
  - `createSession(input: NewSession): Promise<void>` với
    `NewSession = { classId: string; date: string; startTime: string; durationMin: number; topic: string }`
  - `updateSessionStatus(sessionId: string, status: Session["status"]): Promise<void>`
  - `deleteSession(sessionId: string): Promise<void>`
  - `saveAttendance(args): Promise<void>` — ném `AttendanceConflictError`
  - `class AttendanceConflictError extends Error { takenAtMs: number | null }`

- [ ] **Step 1: Viết `src/lib/repo/sessions.ts`**

```ts
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Session, AttendanceStatus } from "../../types";

const COL = "sessions";

export interface NewSession {
  classId: string;
  date: string;
  startTime: string;
  durationMin: number;
  topic: string;
}

/* Ném khi buổi học đã bị người khác lưu kể từ lúc màn hình này mở lên.
   Mang theo mốc thời gian để thông báo nói được "vừa được lưu lúc mấy giờ". */
export class AttendanceConflictError extends Error {
  takenAtMs: number | null;
  constructor(takenAtMs: number | null) {
    super("attendance-conflict");
    this.name = "AttendanceConflictError";
    this.takenAtMs = takenAtMs;
  }
}

/* KHÔNG dùng orderBy: buổi cũ có thể thiếu createdAt và sẽ bị Firestore loại
   khỏi kết quả. Sắp bằng chuỗi ngày ISO trong bộ nhớ. */
export async function fetchSessions(): Promise<Session[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Session[];
  return list.sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") ||
    (a.startTime || "").localeCompare(b.startTime || "")
  );
}

export async function createSession(input: NewSession): Promise<void> {
  await addDoc(collection(db, COL), {
    ...input,
    status: "scheduled",
    records: {},
    note: "",
    takenBy: null,
    takenAt: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateSessionStatus(
  sessionId: string, status: Session["status"]
): Promise<void> {
  await updateDoc(doc(db, COL, sessionId), { status });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, COL, sessionId));
}

const toMillis = (ts: unknown): number | null =>
  ts instanceof Timestamp ? ts.toMillis() : null;

/* Lưu điểm danh trong một transaction, so mốc takenAt đọc được lúc mở màn
   hình với mốc hiện tại trên máy chủ. Lệch nghĩa là người khác vừa lưu buổi
   này — ném lỗi để giao diện hỏi lại, thay vì âm thầm đè mất công của họ. */
export async function saveAttendance(args: {
  sessionId: string;
  records: Record<string, AttendanceStatus>;
  note: string;
  takenBy: string;
  expectedTakenAtMs: number | null;
}): Promise<void> {
  const ref = doc(db, COL, args.sessionId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Buổi học không còn tồn tại.");

    const currentMs = toMillis(snap.data().takenAt);
    if (currentMs !== args.expectedTakenAtMs) {
      throw new AttendanceConflictError(currentMs);
    }

    tx.update(ref, {
      records: args.records,
      note: args.note,
      status: "done",
      takenBy: args.takenBy,
      takenAt: serverTimestamp(),
    });
  });
}
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npm run lint && npm test`
Expected: sạch lỗi, 64 test pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/repo/sessions.ts
git commit -m "feat: repo sessions ghi diem danh bang transaction co phat hien xung dot

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Trả nợ — gộp hồ sơ đổi khóa trong `sessions.records`

**Files:**
- Modify: `src/lib/repo/students.ts`

**Interfaces:**
- Consumes: collection `sessions`
- Produces: `mergeStudents` giữ nguyên chữ ký, thêm hành vi

- [ ] **Step 1: Mở rộng `mergeStudents`**

Sau khối xử lý `enrollments` (trước `batch.update` cho `keepId`), thêm:

```ts
  /* Điểm danh nhúng trong sessions.records với KHÓA là studentId, nên gộp hồ
     sơ mà không đổi khóa là lịch sử điểm danh của người bị gộp biến mất.
     Chỉ quét những buổi thuộc lớp mà người đó từng ghi danh — quét toàn bộ
     là thừa. */
  const dropClassIds = Array.from(new Set(
    dropEnrollments.docs.map(d => (d.data() as { classId: string }).classId)
  ));

  if (dropClassIds.length > 0) {
    const sessionsSnap = await getDocs(collection(db, "sessions"));
    for (const ses of sessionsSnap.docs) {
      const data = ses.data() as { classId?: string; records?: Record<string, string> };
      if (!data.classId || !dropClassIds.includes(data.classId)) continue;

      const records = data.records || {};
      if (!(dropId in records)) continue;

      const next = { ...records };
      /* Người giữ lại đã có trạng thái ở buổi này thì giữ của họ: đó là bản
         ghi giảng viên nhìn thấy và xác nhận trên màn hình. */
      if (!(keepId in next)) next[keepId] = records[dropId];
      delete next[dropId];

      batch.update(ses.ref, { records: next });
    }
  }
```

- [ ] **Step 2: Cập nhật comment nợ kỹ thuật**

Xóa dòng `GĐ4: khi có collection sessions, ...` trong docblock của `mergeStudents` — nợ đã trả.

- [ ] **Step 3: Kiểm tra kiểu**

Run: `npm run lint && npm test`
Expected: sạch lỗi, 64 test pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/repo/students.ts
git commit -m "fix: gop ho so doi luon khoa trong sessions.records

Tra no ky thuat ghi nhan o GD3.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Bảng điểm danh

**Files:**
- Create: `src/features/attendance/AttendanceSheet.tsx`

**Interfaces:**
- Consumes: `buildAttendanceRecords`, `summarizeAttendance`, `ATTENDANCE_ORDER`, `ATTENDANCE_LABELS` (Task 1)
- Produces:
  - `SaveOutcome = { ok: true } | { ok: false; message: string; conflictTakenAtMs?: number | null }`
  - `AttendanceSheet` với props
    `{ session: Session; students: Student[]; enrolledIds: string[]; saving: boolean; onSave: (records, note, expectedTakenAtMs) => Promise<SaveOutcome>; onBack: () => void }`

Hai nguyên tắc:

1. **State cục bộ không bị xóa khi lưu lỗi.** Lưu hỏng thì mọi thứ đã tick vẫn nguyên.
2. **`onSave` trả kết quả chứ không ném lỗi.** Ném lỗi qua ranh giới component buộc mỗi bên phải biết kiểu lỗi của bên kia; trả về một giá trị có kiểu rõ ràng thì `AttendanceSheet` tự xử lý được.

`AttendanceSheet` giữ mốc `expectedTakenAtMs` trong state và **cập nhật lại khi nhận `conflictTakenAtMs`**. Không có bước này thì lời nhắc "bấm Lưu lần nữa để ghi đè" là lời nói dối: lần bấm thứ hai vẫn gửi mốc cũ nên xung đột lặp lại vô hạn.

- [ ] **Step 1: Viết `src/features/attendance/AttendanceSheet.tsx`**

```tsx
import React, { useMemo, useState } from "react";
import { Session, Student, AttendanceStatus } from "../../types";
import {
  buildAttendanceRecords, summarizeAttendance, ATTENDANCE_ORDER, ATTENDANCE_LABELS,
} from "../../lib/attendance";
import { ArrowLeft, Save, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  session: Session;
  students: Student[];
  enrolledIds: string[];
  saving: boolean;
  conflict: string | null;
  onSave: (
    records: Record<string, AttendanceStatus>, note: string, expectedTakenAtMs: number | null
  ) => Promise<void>;
  onBack: () => void;
}

/* Màu của từng trạng thái. Chỉ dùng token có sẵn trong index.css — không
   thêm màu mới chỉ vì bảng này. */
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "border-ok bg-[#E6F7F0] text-ok-deep",
  late: "border-brand-sky-deep bg-[#E4F4FD] text-brand-navy",
  excused: "border-line bg-[#EEF3F8] text-ink-2",
  absent: "border-danger bg-[#FDECEC] text-danger-deep",
};

export default function AttendanceSheet({
  session, students, enrolledIds, saving, conflict, onSave, onBack,
}: Props) {
  /* Khởi tạo một lần từ ghi danh hiện tại + bản đã lưu (nếu có). Không đồng
     bộ lại theo props: nếu đồng bộ, một lần nạp dữ liệu nền sẽ xóa sạch
     những gì giảng viên vừa tick. */
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(
    () => buildAttendanceRecords(enrolledIds, session.records)
  );
  const [note, setNote] = useState(session.note || "");

  // Mốc lúc mở màn hình, dùng để phát hiện người khác lưu chen ngang.
  const [expectedTakenAtMs] = useState<number | null>(
    () => (session.takenAt?.toMillis?.() ?? null)
  );

  const summary = useMemo(() => summarizeAttendance(records), [records]);

  const rows = useMemo(() => enrolledIds.map(id => ({
    id,
    name: students.find(s => s.id === id)?.fullName || id,
    department: students.find(s => s.id === id)?.department || "",
  })).sort((a, b) => a.name.localeCompare(b.name, "vi")), [enrolledIds, students]);

  const setAll = (status: AttendanceStatus) => {
    setRecords(Object.fromEntries(enrolledIds.map(id => [id, status])));
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

        <div className="flex flex-wrap gap-2">
          <button
            id="btn-mark-all-present"
            onClick={() => setAll("present")}
            className="px-3 py-2 text-[12.5px] font-semibold text-ink-3 border border-line-soft rounded-field hover:bg-white transition-colors cursor-pointer"
          >
            Đánh dấu cả lớp có mặt
          </button>
        </div>

        {conflict && (
          <div className="flex items-start gap-2 rounded-field border border-danger bg-[#FDECEC] px-3.5 py-3">
            <AlertCircle className="w-4 h-4 flex-none mt-0.5 text-danger-deep" />
            <p className="text-[13px] text-danger-deep leading-relaxed">{conflict}</p>
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
          onClick={() => onSave(records, note, expectedTakenAtMs)}
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
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npm run lint`
Expected: sạch lỗi

- [ ] **Step 3: Commit**

```bash
git add src/features/attendance/AttendanceSheet.tsx
git commit -m "feat: bang diem danh toi uu cho dien thoai

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Panel điểm danh — chọn lớp, danh sách buổi, thêm buổi

**Files:**
- Create: `src/features/attendance/AttendancePanel.tsx`

**Interfaces:**
- Consumes: `AttendanceSheet` (Task 4); `createSession`, `updateSessionStatus`, `deleteSession`, `saveAttendance`, `AttendanceConflictError` (Task 2); `summarizeAttendance` (Task 1)
- Produces: `AttendancePanel` với props
  `{ classes: ClassRecord[]; students: Student[]; enrollments: Enrollment[]; sessions: Session[]; currentUid: string; onRefresh: () => Promise<void> | void }`

- [ ] **Step 1: Viết `src/features/attendance/AttendancePanel.tsx`**

```tsx
import React, { useMemo, useState } from "react";
import {
  ClassRecord, Student, Enrollment, Session, AttendanceStatus,
} from "../../types";
import AttendanceSheet from "./AttendanceSheet";
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
  const openClasses = useMemo(
    () => classes.filter(c => c.status !== "closed"),
    [classes]
  );

  const [classId, setClassId] = useState<string>(() => openClasses[0]?.id || "");
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    date: todayISO(), startTime: "18:00", durationMin: 120, topic: "",
  });

  const classSessions = useMemo(
    () => sessions.filter(s => s.classId === classId),
    [sessions, classId]
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
    records: Record<string, AttendanceStatus>, note: string, expectedTakenAtMs: number | null
  ) => {
    if (!openSession?.id) return;
    setSaving(true);
    setConflict(null);
    try {
      await saveAttendance({
        sessionId: openSession.id, records, note,
        takenBy: currentUid, expectedTakenAtMs,
      });
      await onRefresh();
      setOpenSessionId(null);
    } catch (err) {
      /* Không đóng màn hình và không xóa gì: mọi thao tác đã tick vẫn nằm
         nguyên trong state của AttendanceSheet để giảng viên bấm lưu lại. */
      if (err instanceof AttendanceConflictError) {
        const when = err.takenAtMs
          ? new Date(err.takenAtMs).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : "vừa xong";
        setConflict(
          `Buổi này vừa được người khác lưu lúc ${when}. Tải lại trang để xem bản mới nhất, ` +
          `hoặc bấm Lưu điểm danh lần nữa để ghi đè bằng bản của bạn.`
        );
      } else {
        console.error("Lỗi khi lưu điểm danh: ", err);
        setConflict("Không lưu được. Kiểm tra kết nối mạng rồi bấm Lưu điểm danh lần nữa — thao tác của bạn vẫn còn nguyên.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (openSession) {
    return (
      <AttendanceSheet
        key={openSession.id}
        session={openSession}
        students={students}
        enrolledIds={enrolledIds}
        saving={saving}
        conflict={conflict}
        onSave={handleSaveAttendance}
        onBack={() => { setOpenSessionId(null); setConflict(null); }}
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
              {openClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
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
                      onClick={() => { setConflict(null); setOpenSessionId(s.id!); }}
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
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npm run lint`
Expected: sạch lỗi

- [ ] **Step 3: Commit**

```bash
git add src/features/attendance/AttendancePanel.tsx
git commit -m "feat: panel diem danh gom chon lop, danh sach buoi va tao buoi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Gắn tab Điểm danh vào bảng Quản trị

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Nạp `sessions` trong `src/App.tsx`**

Thêm `Session` vào import kiểu, `fetchSessions` vào import repo, state `sessions`, thêm vào `Promise.all` của `loadAdminData`, xóa trong `handleLogout`, truyền `sessions={sessions}` xuống `AdminDashboard`.

- [ ] **Step 2: Thêm tab trong `src/components/AdminDashboard.tsx`**

Mở rộng props: `sessions: Session[];`
Mở rộng `adminSubTab`: thêm `"attendance"`.
Thêm vào mảng tab, sau "Phân lớp":

```ts
{ id: "attendance", label: "Điểm danh", icon: Calendar },
```

Render:

```tsx
{adminSubTab === "attendance" && (
  <AttendancePanel
    classes={classes}
    students={students}
    enrollments={enrollments}
    sessions={sessions}
    currentUid={currentUid}
    onRefresh={onRefreshData}
  />
)}
```

- [ ] **Step 3: Cổng kiểm tra đầy đủ**

Run: `npm run lint && npm test && npm run build`
Expected: sạch lỗi, 64 test pass, build thành công

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AdminDashboard.tsx
git commit -m "feat: them tab Diem danh vao bang Quan tri

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Kiểm thử tay trước khi deploy

Cần một lớp đã có học viên ghi danh (làm ở GĐ3).

1. Tab **Điểm danh** → chọn lớp → hiện "N học viên đang ghi danh lớp này".
2. **Thêm buổi** → điền ngày/giờ/thời lượng/chủ đề → tạo. Buổi hiện trong danh sách với trạng thái chưa điểm danh.
3. Bấm **Điểm danh** → cả lớp mặc định "Có mặt", bốn ô số phía trên khớp.
4. Tick vài người sang Vắng/Muộn → bốn ô số cập nhật ngay.
5. **Ngắt mạng** rồi bấm Lưu → hiện lỗi, **mọi thao tác đã tick vẫn còn nguyên**. Bật mạng, bấm Lưu lại → thành công.
6. Quay lại danh sách → buổi hiện "Đã điểm danh · X có mặt / Y".
7. Mở lại buổi đó → thấy đúng trạng thái đã lưu, sửa được, lưu lại được.
8. **Xung đột:** mở cùng một buổi trên hai tab trình duyệt, lưu ở tab A trước rồi lưu ở tab B → tab B hiện cảnh báo "vừa được người khác lưu lúc HH:MM", không âm thầm đè.
9. Nút **Hoãn** → buổi mờ đi, mất nút Điểm danh, bấm lại thì mở lại được.
10. Tab Học viên → Nghi trùng → gộp một hồ sơ **đã có điểm danh** → mở lại buổi đó: người giữ lại có trạng thái của người bị gộp, không mất.
11. Đăng nhập `teacher`: điểm danh được, nhưng nút xóa buổi báo lỗi quyền (rules chỉ cho admin xóa).

## Deploy

```bash
npm run lint && npm test && npm run build
git push origin main
```

Rules đã khai báo `sessions` từ GĐ1 — **không cần publish lại rules**.
