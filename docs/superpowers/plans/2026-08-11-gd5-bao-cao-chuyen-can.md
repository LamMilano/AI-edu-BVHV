# GĐ5 — Báo cáo chuyên cần: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo vụ nhìn một bảng là biết ai đang bỏ học, và xuất được file mở đúng trong Excel tiếng Việt.

**Architecture:** Toàn bộ phép tính chuyên cần nằm ở `lib/report.ts` dạng hàm thuần — đây là chỗ sai một dòng thì con số sai mà không ai phát hiện, nên phải test được không cần Firestore. Sinh CSV tách riêng ở `lib/csv.ts`. Giao diện chỉ hiển thị.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Firebase 12, Tailwind 4, Vitest.

## Global Constraints

- Chuỗi hiển thị bằng **tiếng Việt có dấu**; comment tiếng Việt giải thích **vì sao**.
- Commit message **không dấu**, tiền tố `feat:` / `fix:` / `refactor:`.
- Không thêm thư viện mới. Không thêm token màu mới.
- `npm run lint && npm test` phải sạch trước mỗi commit.
- CSV phải mở đúng dấu tiếng Việt trong Excel trên Windows → **UTF-8 kèm BOM**.
- Báo cáo **chỉ đọc**. Không có nút nào ở GĐ5 ghi vào Firestore.

## Quy tắc tính chuyên cần — chốt trước khi code

Spec chỉ nói "mẫu số = số buổi `done` kể từ ngày học viên ghi danh". Bốn chi tiết spec không nói, tôi chốt như sau và ghi vào giao diện để người đọc báo cáo biết mình đang nhìn con số gì:

| Chi tiết | Quyết định | Lý do |
|---|---|---|
| Buổi `scheduled` (chưa diễn ra) | Không vào mẫu số | Chưa xảy ra thì không thể vắng |
| Buổi `cancelled` (hoãn) | Không vào mẫu số | Lớp không học thì không phải lỗi của học viên |
| "Vắng có phép" (`excused`) | **Không vào mẫu số, cũng không vào tử số** | Tỉ lệ trả lời câu "trong những buổi bắt buộc có mặt, đi được bao nhiêu". Tính vắng có phép như vắng không phép là phạt người xin phép đúng quy trình |
| "Muộn" (`late`) | Tính là **có tham gia** | Đi muộn vẫn là có mặt; muốn phạt đi muộn thì đó là chính sách khác, không phải phép đo chuyên cần |

Học viên ghi danh muộn tự động có mẫu số nhỏ hơn mà **không cần so ngày**: `buildAttendanceRecords` (GĐ4) chỉ đưa người đang ghi danh vào `records`, nên buổi trước khi họ vào lớp đơn giản là không có tên họ. Mẫu số = số buổi `done` **có tên học viên trong `records`**.

**Cảnh báo vắng liên tiếp:** chỉ `absent` nối chuỗi. `present`, `late`, `excused` đều làm đứt chuỗi. Buổi không có tên học viên (chưa ghi danh) bị bỏ qua, không làm đứt.

---

### Task 1: Sinh CSV

**Files:**
- Create: `src/lib/csv.ts`
- Test: `src/lib/csv.test.ts`

**Interfaces:**
- Produces:
  - `toCsv(header: string[], rows: (string | number)[][]): string`
  - `downloadCsv(filename: string, content: string): void`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("ghép tiêu đề và dòng, phân cách bằng dấu phẩy", () => {
    expect(toCsv(["Tên", "Điểm"], [["An", 10], ["Bình", 9]]))
      .toBe("Tên,Điểm\r\nAn,10\r\nBình,9");
  });

  it("bọc ô có dấu phẩy trong ngoặc kép, nếu không Excel tách nhầm cột", () => {
    expect(toCsv(["Khoa"], [["Nội, Tổng hợp"]]))
      .toBe('Khoa\r\n"Nội, Tổng hợp"');
  });

  it("nhân đôi dấu ngoặc kép bên trong ô", () => {
    expect(toCsv(["Ghi chú"], [['Lớp "đặc biệt"']]))
      .toBe('Ghi chú\r\n"Lớp ""đặc biệt"""');
  });

  it("bọc ô có xuống dòng", () => {
    expect(toCsv(["Ghi chú"], [["Dòng 1\nDòng 2"]]))
      .toBe('Ghi chú\r\n"Dòng 1\nDòng 2"');
  });

  it("không bọc số", () => {
    expect(toCsv(["Tỉ lệ"], [[85]])).toBe("Tỉ lệ\r\n85");
  });

  it("giữ nguyên dấu tiếng Việt", () => {
    expect(toCsv(["Họ tên"], [["Nguyễn Thị Hưởng"]]))
      .toBe("Họ tên\r\nNguyễn Thị Hưởng");
  });

  it("không có dòng nào thì chỉ còn tiêu đề", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./csv"`

- [ ] **Step 3: Viết `src/lib/csv.ts`**

```ts
/* Ô cần bọc khi chứa dấu phẩy (Excel sẽ tách nhầm cột), dấu ngoặc kép
   (phá cú pháp), hoặc xuống dòng (tách nhầm dòng). */
const needsQuote = (v: string) => /[",\n\r]/.test(v);

function escapeCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const s = value ?? "";
  return needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* Dùng CRLF: đó là dấu xuống dòng mà Excel trên Windows mong đợi. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\r\n");
}

/* BOM là thứ duy nhất khiến Excel trên Windows đọc đúng dấu tiếng Việt.
   Thiếu nó thì "Nguyễn" thành "Nguyá»…n" và cả file thành vô dụng. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Chạy test và kiểm tra kiểu**

Run: `npm test && npm run lint`
Expected: PASS — 7 test mới (tổng 71), lint sạch

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat: sinh CSV co escape va BOM cho Excel tieng Viet

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Tính báo cáo chuyên cần

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/report.ts`
- Test: `src/lib/report.test.ts`

**Interfaces:**
- Consumes: `Session`, `Enrollment`, `Student`, `AttendanceStatus`
- Produces:
  - `StudentAttendanceRow`, `ClassAttendanceReport`
  - `buildClassReport(args: { classId, sessions, enrollments, students }): ClassAttendanceReport`
  - `maxAbsentStreak(statuses: (AttendanceStatus | null)[]): number`

- [ ] **Step 1: Thêm kiểu vào `src/types.ts`**

```ts
export interface StudentAttendanceRow {
  studentId: string;
  fullName: string;
  department: string;
  /* Cùng thứ tự với ClassAttendanceReport.sessions.
     null = buổi đó học viên chưa ghi danh, không tính vào đâu cả. */
  cells: (AttendanceStatus | null)[];
  attended: number;    // present + late
  counted: number;     // mẫu số: buổi done có tên học viên, trừ vắng có phép
  rate: number;        // 0..100, đã làm tròn
  maxAbsentStreak: number;
}

export interface ClassAttendanceReport {
  sessions: Session[];             // chỉ buổi đã điểm danh, sắp theo ngày
  rows: StudentAttendanceRow[];
  totalDoneSessions: number;
}
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/lib/report.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildClassReport, maxAbsentStreak } from "./report";
import { Session, Enrollment, Student, AttendanceStatus } from "../types";

const ses = (
  id: string, date: string, status: Session["status"],
  records: Record<string, AttendanceStatus>
): Session => ({
  id, classId: "c1", date, startTime: "18:00", durationMin: 120, topic: id,
  status, records, note: "", takenBy: null, takenAt: null, createdAt: null,
});

const enr = (studentId: string): Enrollment => ({
  id: `c1_${studentId}`, classId: "c1", studentId, level: "L1",
  status: "enrolled", matchScore: null, matchReason: null,
  enrolledAt: null, enrolledBy: "",
});

const stu = (id: string, fullName: string): Student => ({
  id, email: id, fullName, department: "Khoa Nội", phone: "",
  currentLevel: "L1", latestSubmissionId: "", submissionCount: 1,
  availability: { timeframes: [], days: [], duration: "" },
  notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
});

const build = (sessions: Session[]) => buildClassReport({
  classId: "c1", sessions,
  enrollments: [enr("a@x.vn")],
  students: [stu("a@x.vn", "Nguyễn Văn A")],
});

describe("buildClassReport", () => {
  it("chỉ tính buổi đã điểm danh, bỏ buổi chưa diễn ra và buổi hoãn", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "cancelled", { "a@x.vn": "absent" }),
      ses("s3", "2026-08-03", "scheduled", {}),
    ]);
    expect(r.sessions.map(s => s.id)).toEqual(["s1"]);
    expect(r.rows[0].counted).toBe(1);
    expect(r.rows[0].rate).toBe(100);
  });

  it("sắp buổi theo ngày, không theo thứ tự đầu vào", () => {
    const r = build([
      ses("muon", "2026-08-09", "done", { "a@x.vn": "present" }),
      ses("som", "2026-08-01", "done", { "a@x.vn": "present" }),
    ]);
    expect(r.sessions.map(s => s.id)).toEqual(["som", "muon"]);
  });

  it("đi muộn vẫn tính là có tham gia", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "late" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "present" }),
    ]);
    expect(r.rows[0].attended).toBe(2);
    expect(r.rows[0].rate).toBe(100);
  });

  it("vắng có phép không vào tử số lẫn mẫu số", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "excused" }),
    ]);
    expect(r.rows[0].attended).toBe(1);
    expect(r.rows[0].counted).toBe(1);
    expect(r.rows[0].rate).toBe(100);
  });

  it("vắng không phép vào mẫu số nhưng không vào tử số", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "absent" }),
    ]);
    expect(r.rows[0].attended).toBe(1);
    expect(r.rows[0].counted).toBe(2);
    expect(r.rows[0].rate).toBe(50);
  });

  it("học viên ghi danh muộn có mẫu số nhỏ hơn, không bị tính vắng ngược", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", {}),                        // chưa có tên
      ses("s2", "2026-08-02", "done", { "a@x.vn": "present" }),
    ]);
    expect(r.rows[0].cells).toEqual([null, "present"]);
    expect(r.rows[0].counted).toBe(1);
    expect(r.rows[0].rate).toBe(100);
  });

  it("chưa có buổi nào tính được thì tỉ lệ bằng 0 chứ không chia cho 0", () => {
    const r = build([ses("s1", "2026-08-01", "scheduled", {})]);
    expect(r.rows[0].counted).toBe(0);
    expect(r.rows[0].rate).toBe(0);
  });

  it("làm tròn tỉ lệ đến số nguyên", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      ses("s2", "2026-08-02", "done", { "a@x.vn": "present" }),
      ses("s3", "2026-08-03", "done", { "a@x.vn": "absent" }),
    ]);
    expect(r.rows[0].rate).toBe(67);
  });

  it("chỉ lấy học viên đang ghi danh lớp này", () => {
    const r = buildClassReport({
      classId: "c1",
      sessions: [ses("s1", "2026-08-01", "done", { "a@x.vn": "present" })],
      enrollments: [
        enr("a@x.vn"),
        { ...enr("cu@x.vn"), status: "dropped" },
        { ...enr("lop-khac@x.vn"), classId: "c2" },
      ],
      students: [stu("a@x.vn", "A"), stu("cu@x.vn", "Cũ"), stu("lop-khac@x.vn", "Khác")],
    });
    expect(r.rows.map(x => x.studentId)).toEqual(["a@x.vn"]);
  });

  it("bỏ qua buổi của lớp khác", () => {
    const r = build([
      ses("s1", "2026-08-01", "done", { "a@x.vn": "present" }),
      { ...ses("khac", "2026-08-02", "done", { "a@x.vn": "absent" }), classId: "c2" },
    ]);
    expect(r.sessions.map(s => s.id)).toEqual(["s1"]);
  });

  it("sắp học viên theo tên để bảng đọc được", () => {
    const r = buildClassReport({
      classId: "c1",
      sessions: [ses("s1", "2026-08-01", "done", {})],
      enrollments: [enr("b@x.vn"), enr("a@x.vn")],
      students: [stu("b@x.vn", "Trần Bình"), stu("a@x.vn", "Nguyễn An")],
    });
    expect(r.rows.map(x => x.fullName)).toEqual(["Nguyễn An", "Trần Bình"]);
  });
});

describe("maxAbsentStreak", () => {
  it("đếm chuỗi vắng liên tiếp dài nhất", () => {
    expect(maxAbsentStreak(["absent", "absent", "present", "absent"])).toBe(2);
  });

  it("có mặt làm đứt chuỗi", () => {
    expect(maxAbsentStreak(["absent", "present", "absent"])).toBe(1);
  });

  it("vắng có phép làm đứt chuỗi, vì đó không phải dấu hiệu bỏ học", () => {
    expect(maxAbsentStreak(["absent", "excused", "absent"])).toBe(1);
  });

  it("buổi chưa ghi danh bị bỏ qua, không làm đứt chuỗi", () => {
    expect(maxAbsentStreak(["absent", null, "absent"])).toBe(2);
  });

  it("không vắng buổi nào thì bằng 0", () => {
    expect(maxAbsentStreak(["present", "late"])).toBe(0);
  });

  it("danh sách rỗng bằng 0", () => {
    expect(maxAbsentStreak([])).toBe(0);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./report"`

- [ ] **Step 4: Viết `src/lib/report.ts`**

```ts
import {
  Session, Enrollment, Student, AttendanceStatus,
  StudentAttendanceRow, ClassAttendanceReport,
} from "../types";

/* Chỉ "absent" nối chuỗi. "excused" làm đứt vì xin phép không phải dấu hiệu
   bỏ học — đây là cảnh báo để giáo vụ gọi điện hỏi thăm, không phải hình phạt.
   Buổi học viên chưa ghi danh (null) bị bỏ qua hẳn, không làm đứt chuỗi. */
export function maxAbsentStreak(statuses: (AttendanceStatus | null)[]): number {
  let best = 0;
  let run = 0;
  for (const s of statuses) {
    if (s === null || s === undefined) continue;
    if (s === "absent") {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export function buildClassReport(args: {
  classId: string;
  sessions: Session[];
  enrollments: Enrollment[];
  students: Student[];
}): ClassAttendanceReport {
  const { classId, sessions, enrollments, students } = args;

  /* Chỉ buổi ĐÃ điểm danh mới vào báo cáo: buổi chưa diễn ra thì không thể
     vắng, buổi hoãn thì không phải lỗi của học viên. */
  const counted = sessions
    .filter(s => s.classId === classId && s.status === "done")
    .sort((a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      (a.startTime || "").localeCompare(b.startTime || "")
    );

  const members = enrollments.filter(e => e.classId === classId && e.status === "enrolled");

  const rows: StudentAttendanceRow[] = members.map(e => {
    const student = students.find(s => s.id === e.studentId);

    /* null nghĩa là buổi đó chưa có tên học viên trong records — họ ghi danh
       sau. Không tính vào mẫu số, nên người vào muộn không bị phạt ngược. */
    const cells: (AttendanceStatus | null)[] = counted.map(
      s => (s.records || {})[e.studentId] ?? null
    );

    let attended = 0;
    let denominator = 0;
    for (const c of cells) {
      if (c === null) continue;
      // Vắng có phép nằm ngoài cả tử lẫn mẫu: không thưởng, cũng không phạt.
      if (c === "excused") continue;
      denominator++;
      if (c === "present" || c === "late") attended++;
    }

    return {
      studentId: e.studentId,
      fullName: student?.fullName || e.studentId,
      department: student?.department || "",
      cells,
      attended,
      counted: denominator,
      rate: denominator > 0 ? Math.round((attended / denominator) * 100) : 0,
      maxAbsentStreak: maxAbsentStreak(cells),
    };
  });

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

  return { sessions: counted, rows, totalDoneSessions: counted.length };
}
```

- [ ] **Step 5: Chạy test và kiểm tra kiểu**

Run: `npm test && npm run lint`
Expected: PASS — 17 test mới (tổng 88), lint sạch

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/report.ts src/lib/report.test.ts
git commit -m "feat: tinh bao cao chuyen can theo lop

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Màn báo cáo

**Files:**
- Create: `src/features/reports/AttendanceReport.tsx`

**Interfaces:**
- Consumes: `buildClassReport` (Task 2); `toCsv`, `downloadCsv` (Task 1); `ATTENDANCE_LABELS` (GĐ4)
- Produces: `AttendanceReport` với props
  `{ classes: ClassRecord[]; students: Student[]; enrollments: Enrollment[]; sessions: Session[] }`

Ngưỡng cảnh báo: **vắng ≥ 2 buổi liên tiếp**, đúng như spec.

- [ ] **Step 1: Viết `src/features/reports/AttendanceReport.tsx`**

```tsx
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

/* Ô trong bảng chéo. Ký hiệu ngắn để ba mươi cột vẫn vừa màn hình; nhãn đầy
   đủ nằm ở thuộc tính title và ở chú giải phía dưới bảng. */
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

        <p className="text-[12.5px] text-ink-3 leading-relaxed">
          Tỉ lệ chuyên cần tính trên <strong>số buổi đã điểm danh</strong>. Buổi chưa diễn ra
          và buổi hoãn không vào mẫu số. <strong>Vắng có phép</strong> không tính vào tử số
          lẫn mẫu số; <strong>đi muộn</strong> tính là có tham gia.
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="surface p-5 space-y-2">
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
                    <th key={s.id} className="px-2 py-3 text-center w-10" title={`${s.date} · ${s.topic || ""}`}>
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
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npm run lint`
Expected: sạch lỗi

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/AttendanceReport.tsx
git commit -m "feat: man bao cao chuyen can voi bang cheo va xuat CSV

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Gắn tab Báo cáo

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Thêm tab**

Import `AttendanceReport`. Mở rộng `adminSubTab` thêm `"reports"`. Thêm vào mảng tab sau "Điểm danh":

```ts
{ id: "reports", label: "Báo cáo", icon: BarChart3 },
```

(Thêm `BarChart3` vào import từ `lucide-react`.)

Render:

```tsx
{adminSubTab === "reports" && (
  <AttendanceReport
    classes={classes}
    students={students}
    enrollments={enrollments}
    sessions={sessions}
  />
)}
```

- [ ] **Step 2: Cổng kiểm tra đầy đủ**

Run: `npm run lint && npm test && npm run build`
Expected: sạch lỗi, 88 test pass, build thành công

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "feat: them tab Bao cao vao bang Quan tri

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Kiểm thử tay trước khi deploy

Cần một lớp đã điểm danh ít nhất hai buổi (làm ở GĐ4).

1. Tab **Báo cáo** → chọn lớp → bảng chéo hiện đủ học viên × buổi, ký hiệu C/M/P/V đúng màu.
2. Học viên vắng một buổi trong hai → tỉ lệ 50%, hiển thị `1/2`.
3. Đánh dấu một buổi là **Vắng có phép** → mẫu số giảm, tỉ lệ tăng.
4. Đánh dấu một buổi thành **Hoãn** ở tab Điểm danh → buổi biến mất khỏi bảng, mẫu số giảm.
5. Học viên ghi danh sau khi đã có buổi điểm danh → ô buổi đó hiện `–`, không bị tính vắng.
6. Vắng hai buổi liên tiếp → tên hiện trong khối cảnh báo đỏ phía trên.
7. **Xuất CSV** → mở bằng Excel: dấu tiếng Việt đúng, tên khoa có dấu phẩy không bị tách cột.
8. Lớp chưa điểm danh buổi nào → hiện lời nhắc thay vì bảng rỗng.

## Deploy

```bash
npm run lint && npm test && npm run build
git push origin main
```

GĐ5 chỉ đọc dữ liệu, không thêm collection mới — **không cần đụng tới rules**.
