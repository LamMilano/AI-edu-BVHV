# GĐ2 — Hồ sơ học viên: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng thực thể "học viên" tách khỏi phiếu khảo sát — khóa là email chuẩn hóa, chống trùng, có màn duyệt các ca nghi trùng — làm nền cho ghi danh và điểm danh ở GĐ3–4.

**Architecture:** Toàn bộ logic dựng hồ sơ và phát hiện trùng nằm trong `lib/students.ts` dưới dạng hàm thuần, test được không cần Firestore. `lib/migrate.ts` chỉ là lớp mỏng đọc phiếu → gọi hàm thuần → ghi Firestore, chạy lại nhiều lần không nhân đôi. Giao diện thêm hai component trong `features/students/`, gắn vào tab Học viên hiện có dưới dạng hai chế độ xem.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Firebase 12, Tailwind 4, Vitest.

## Global Constraints

- Chuỗi hiển thị bằng **tiếng Việt có dấu**; comment tiếng Việt giải thích **vì sao**.
- Commit message **không dấu**, tiền tố `feat:` / `refactor:` / `chore:`.
- Không thêm thư viện mới.
- Không dùng `orderBy` trên trường mà document cũ có thể thiếu.
- `npm run lint && npm test` phải sạch trước mỗi commit.
- Giữ nguyên bảng màu và các class Tailwind tùy biến đang dùng (`surface`, `surface-tile`, `field`, `btn-primary`, `cut-corner`, `tnum`).

## Quyết định phạm vi GĐ2

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Bảng phiếu khảo sát hiện có | Giữ nguyên, chuyển thành chế độ xem thứ hai trong tab Học viên | Dữ liệu thô vẫn dùng được; bỏ đi là mất công cụ đang chạy |
| Gộp hồ sơ trùng | Chỉ đụng collection `students` | `enrollments`/`sessions` chưa tồn tại ở GĐ2 |
| Phiếu thiếu email | Bỏ qua, không tạo hồ sơ, báo cáo trong kết quả migrate | Email là khóa định danh; không có thì không dựng được hồ sơ |
| Sửa hồ sơ bằng tay | Ngoài phạm vi GĐ2 | Hồ sơ là bản chiếu của phiếu; nhu cầu sửa tay chưa rõ, để GĐ3 khi phân lớp phát sinh thực tế |
| Phiếu chi tiết hồ sơ (lớp đang học, lịch sử ghi danh, % chuyên cần) | Ngoài phạm vi GĐ2 | Spec mô tả ở mục "Học viên", nhưng ba thứ đó đọc từ `enrollments` và `sessions` — chưa tồn tại. Làm ở GĐ3–4 cùng lúc với dữ liệu nguồn |

**Nợ kỹ thuật cố ý, phải xử lý ở GĐ3:** thao tác Gộp hiện chỉ xóa hồ sơ bị gộp và ghi vết vào `mergedFrom`. Khi `enrollments` xuất hiện, Gộp phải trỏ lại mọi enrollment của hồ sơ bị gộp sang hồ sơ giữ lại trước khi xóa. Ghi rõ trong plan GĐ3.

---

### Task 1: Kiểu dữ liệu + chuẩn hóa email/tên

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/students.ts`
- Test: `src/lib/students.test.ts`

**Interfaces:**
- Consumes: `SurveySubmission` từ `src/types.ts`
- Produces:
  - `normalizeEmail(raw: string): string | null` — null khi không dùng được làm Document ID
  - `normalizeName(raw: string): string`
  - `Student`, `StudentDraft`, `StudentAvailability`, `SkippedSubmission`, `DuplicateGroup`

- [ ] **Step 1: Thêm kiểu vào `src/types.ts`**

```ts
export interface StudentAvailability {
  timeframes: string[];   // từ q10_timeframe
  days: string[];         // từ q11_days
  duration: string;       // từ q12_duration
}

/* Hồ sơ học viên: BẢN CHIẾU của phiếu khảo sát, không phải bản gốc.
   survey_submissions vẫn là nguồn sự thật cho câu trả lời; hồ sơ chỉ giữ
   phần cần cho vận hành (xếp lớp, điểm danh). Document ID = email chuẩn hóa. */
export interface Student {
  id?: string;
  email: string;              // bản gốc như học viên gõ
  fullName: string;
  department: string;
  phone: string;
  currentLevel: "L1" | "L2" | "L3";
  latestSubmissionId: string;
  submissionCount: number;    // >1 nghĩa là đã làm lại khảo sát
  availability: StudentAvailability;
  notDuplicateOf: string[];   // id các hồ sơ đã xác nhận "không phải trùng"
  mergedFrom: string[];       // id các hồ sơ đã gộp vào đây
  createdAt: any;
  updatedAt: any;
}

/* Hồ sơ dựng từ phiếu, chưa có mốc thời gian của Firestore. */
export type StudentDraft = Omit<Student, "createdAt" | "updatedAt" | "notDuplicateOf" | "mergedFrom"> & {
  id: string;
};

export interface SkippedSubmission {
  submissionId: string;
  studentName: string;
  reason: string;
}

export interface DuplicateGroup {
  key: string;
  fullName: string;
  department: string;
  students: Student[];   // luôn ≥ 2
}
```

- [ ] **Step 2: Viết test thất bại**

Tạo `src/lib/students.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeEmail, normalizeName } from "./students";

describe("normalizeEmail", () => {
  it("bỏ khoảng trắng thừa và đưa về chữ thường", () => {
    expect(normalizeEmail("  Nguyen.Van.A@BvHV.vn ")).toBe("nguyen.van.a@bvhv.vn");
  });

  it("trả null khi rỗng hoặc toàn khoảng trắng", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("trả null khi có dấu gạch chéo, vì Firestore không cho phép trong Document ID", () => {
    expect(normalizeEmail("a/b@bvhv.vn")).toBeNull();
  });

  it("trả null với '.' và '..', là hai Document ID bị Firestore cấm", () => {
    expect(normalizeEmail(".")).toBeNull();
    expect(normalizeEmail("..")).toBeNull();
  });

  it("trả null khi thiếu ký tự @, vì đó không phải email", () => {
    expect(normalizeEmail("nguyenvana")).toBeNull();
  });

  it("trả null khi dài quá giới hạn 1500 byte của Document ID", () => {
    expect(normalizeEmail("a".repeat(1500) + "@bvhv.vn")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("gộp khoảng trắng thừa và đưa về chữ thường, giữ nguyên dấu tiếng Việt", () => {
    expect(normalizeName("  Nguyễn   Văn  A ")).toBe("nguyễn văn a");
  });

  it("trả chuỗi rỗng cho đầu vào rỗng", () => {
    expect(normalizeName("")).toBe("");
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./students"`

- [ ] **Step 4: Viết `src/lib/students.ts`**

```ts
import { SurveySubmission, StudentDraft, SkippedSubmission } from "../types";

/* Giới hạn của Firestore Document ID: không chứa '/', không phải '.' hay '..',
   tối đa 1500 byte UTF-8. Email hợp lệ không vi phạm những điều này, nhưng dữ
   liệu người dùng gõ tay thì có thể, nên phải chặn trước khi ghi. */
const MAX_DOC_ID_BYTES = 1500;

export function normalizeEmail(raw: string): string | null {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "." || value === "..") return null;
  if (value.includes("/")) return null;
  if (!value.includes("@")) return null;
  if (new TextEncoder().encode(value).length > MAX_DOC_ID_BYTES) return null;
  return value;
}

/* Dùng để phát hiện trùng tên. GIỮ NGUYÊN dấu tiếng Việt: bỏ dấu sẽ gộp nhầm
   những cái tên khác hẳn nhau (Lê Hồng vs Lê Hòng), mà mục đích ở đây chỉ là
   gợi ý cho giáo vụ xem lại chứ không phải tự động gộp. */
export function normalizeName(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npm test`
Expected: PASS — 8 test mới (tổng 19)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/students.ts src/lib/students.test.ts
git commit -m "feat: them kieu Student va ham chuan hoa email/ten

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Dựng hồ sơ từ phiếu khảo sát

**Files:**
- Modify: `src/lib/students.ts`
- Modify: `src/lib/students.test.ts`

**Interfaces:**
- Consumes: `normalizeEmail` (Task 1)
- Produces: `buildStudentsFromSubmissions(subs: SurveySubmission[]): { drafts: StudentDraft[]; skipped: SkippedSubmission[] }`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/students.test.ts`:

```ts
import { buildStudentsFromSubmissions } from "./students";
import { SurveySubmission } from "../types";

const sub = (over: Partial<SurveySubmission> & { id: string }): SurveySubmission => ({
  studentName: "Nguyễn Văn A",
  department: "Khoa Nội",
  email: "a@bvhv.vn",
  phone: "0900000000",
  score: 50,
  assignedLevel: "L1",
  answers: {
    q1_tools: [], q2_paid: [], q3_frequency: "", q4_past_tasks: [], q5_concepts: [],
    q7_goals: [], q8_orientation: "", q9_repetitive_tasks: "",
    q10_timeframe: ["Tối"], q11_days: ["T3"], q12_duration: "90 phút",
  },
  submittedAt: { seconds: 1000, nanoseconds: 0 },
  ...over,
} as SurveySubmission);

describe("buildStudentsFromSubmissions", () => {
  it("mỗi email một hồ sơ, id là email đã chuẩn hóa", () => {
    const { drafts, skipped } = buildStudentsFromSubmissions([
      sub({ id: "s1", email: "A@BvHV.vn" }),
      sub({ id: "s2", email: "b@bvhv.vn", studentName: "Trần Thị B" }),
    ]);
    expect(skipped).toEqual([]);
    expect(drafts.map(d => d.id).sort()).toEqual(["a@bvhv.vn", "b@bvhv.vn"]);
  });

  it("giữ email bản gốc người dùng gõ, không phải bản chuẩn hóa", () => {
    const { drafts } = buildStudentsFromSubmissions([sub({ id: "s1", email: "A@BvHV.vn" })]);
    expect(drafts[0].email).toBe("A@BvHV.vn");
    expect(drafts[0].id).toBe("a@bvhv.vn");
  });

  it("trùng email thì giữ phiếu mới nhất và đếm số phiếu", () => {
    const { drafts } = buildStudentsFromSubmissions([
      sub({ id: "cu", department: "Khoa cũ", submittedAt: { seconds: 100, nanoseconds: 0 } }),
      sub({ id: "moi", department: "Khoa mới", submittedAt: { seconds: 900, nanoseconds: 0 } }),
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].department).toBe("Khoa mới");
    expect(drafts[0].latestSubmissionId).toBe("moi");
    expect(drafts[0].submissionCount).toBe(2);
  });

  it("phiếu thiếu submittedAt không được coi là mới hơn phiếu có ngày", () => {
    const { drafts } = buildStudentsFromSubmissions([
      sub({ id: "co-ngay", department: "Có ngày", submittedAt: { seconds: 100, nanoseconds: 0 } }),
      sub({ id: "khong-ngay", department: "Không ngày", submittedAt: undefined }),
    ]);
    expect(drafts[0].latestSubmissionId).toBe("co-ngay");
  });

  it("bỏ qua phiếu thiếu email và nói rõ lý do", () => {
    const { drafts, skipped } = buildStudentsFromSubmissions([
      sub({ id: "s1", email: "  ", studentName: "Không Email" }),
    ]);
    expect(drafts).toEqual([]);
    expect(skipped).toEqual([
      { submissionId: "s1", studentName: "Không Email", reason: "Thiếu email hợp lệ" },
    ]);
  });

  it("chép lịch rảnh từ phiếu mới nhất để xếp lớp dùng", () => {
    const { drafts } = buildStudentsFromSubmissions([sub({ id: "s1" })]);
    expect(drafts[0].availability).toEqual({
      timeframes: ["Tối"], days: ["T3"], duration: "90 phút",
    });
  });

  it("currentLevel khởi tạo bằng assignedLevel của phiếu mới nhất", () => {
    const { drafts } = buildStudentsFromSubmissions([
      sub({ id: "cu", assignedLevel: "L1", submittedAt: { seconds: 100, nanoseconds: 0 } }),
      sub({ id: "moi", assignedLevel: "L3", submittedAt: { seconds: 900, nanoseconds: 0 } }),
    ]);
    expect(drafts[0].currentLevel).toBe("L3");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `buildStudentsFromSubmissions is not a function`

- [ ] **Step 3: Bổ sung vào `src/lib/students.ts`**

```ts
/* Phiếu thiếu submittedAt (dữ liệu cũ) coi như mốc 0 để không bao giờ
   thắng phiếu có ngày thật khi chọn "phiếu mới nhất". */
const submittedSeconds = (s: SurveySubmission): number => s.submittedAt?.seconds || 0;

export function buildStudentsFromSubmissions(
  subs: SurveySubmission[]
): { drafts: StudentDraft[]; skipped: SkippedSubmission[] } {
  const byEmail = new Map<string, { latest: SurveySubmission; count: number }>();
  const skipped: SkippedSubmission[] = [];

  for (const s of subs) {
    const key = normalizeEmail(s.email);
    if (!key) {
      skipped.push({
        submissionId: s.id || "",
        studentName: s.studentName || "(không tên)",
        reason: "Thiếu email hợp lệ",
      });
      continue;
    }

    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, { latest: s, count: 1 });
    } else {
      byEmail.set(key, {
        latest: submittedSeconds(s) > submittedSeconds(existing.latest) ? s : existing.latest,
        count: existing.count + 1,
      });
    }
  }

  const drafts: StudentDraft[] = Array.from(byEmail.entries()).map(([id, { latest, count }]) => ({
    id,
    email: latest.email,
    fullName: latest.studentName,
    department: latest.department,
    phone: latest.phone,
    currentLevel: latest.assignedLevel,
    latestSubmissionId: latest.id || "",
    submissionCount: count,
    availability: {
      timeframes: latest.answers?.q10_timeframe || [],
      days: latest.answers?.q11_days || [],
      duration: latest.answers?.q12_duration || "",
    },
  }));

  return { drafts, skipped };
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test && npm run lint`
Expected: PASS — 7 test mới (tổng 26), lint sạch

- [ ] **Step 5: Commit**

```bash
git add src/lib/students.ts src/lib/students.test.ts
git commit -m "feat: dung ho so hoc vien tu phieu khao sat, khu trung theo email

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Phát hiện hồ sơ nghi trùng

**Files:**
- Modify: `src/lib/students.ts`
- Modify: `src/lib/students.test.ts`

**Interfaces:**
- Consumes: `normalizeName` (Task 1), `Student`, `DuplicateGroup`
- Produces: `findDuplicateGroups(students: Student[]): DuplicateGroup[]`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `src/lib/students.test.ts`:

```ts
import { findDuplicateGroups } from "./students";
import { Student } from "../types";

const stu = (over: Partial<Student> & { id: string }): Student => ({
  email: over.id, fullName: "Nguyễn Văn A", department: "Khoa Nội", phone: "",
  currentLevel: "L1", latestSubmissionId: "", submissionCount: 1,
  availability: { timeframes: [], days: [], duration: "" },
  notDuplicateOf: [], mergedFrom: [], createdAt: null, updatedAt: null,
  ...over,
} as Student);

describe("findDuplicateGroups", () => {
  it("gom hai hồ sơ cùng tên cùng khoa nhưng khác email", () => {
    const groups = findDuplicateGroups([stu({ id: "a@x.vn" }), stu({ id: "b@x.vn" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].students.map(s => s.id).sort()).toEqual(["a@x.vn", "b@x.vn"]);
  });

  it("không gom khi khác khoa, vì trùng tên giữa hai khoa là chuyện bình thường", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", department: "Khoa Nội" }),
      stu({ id: "b@x.vn", department: "Khoa Ngoại" }),
    ])).toEqual([]);
  });

  it("không gom khi khác tên", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", fullName: "Nguyễn Văn A" }),
      stu({ id: "b@x.vn", fullName: "Trần Thị B" }),
    ])).toEqual([]);
  });

  it("bỏ qua khác biệt hoa/thường và khoảng trắng thừa khi so tên", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", fullName: "Nguyễn Văn A" }),
      stu({ id: "b@x.vn", fullName: "  nguyễn   văn a " }),
    ])).toHaveLength(1);
  });

  it("không báo lại cặp đã được đánh dấu không trùng", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", notDuplicateOf: ["b@x.vn"] }),
      stu({ id: "b@x.vn", notDuplicateOf: ["a@x.vn"] }),
    ])).toEqual([]);
  });

  it("đánh dấu một chiều cũng đủ để im lặng, vì giáo vụ đã quyết một lần", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", notDuplicateOf: ["b@x.vn"] }),
      stu({ id: "b@x.vn" }),
    ])).toEqual([]);
  });

  it("nhóm ba người còn một cặp chưa xử lý thì vẫn báo", () => {
    const groups = findDuplicateGroups([
      stu({ id: "a@x.vn", notDuplicateOf: ["b@x.vn"] }),
      stu({ id: "b@x.vn", notDuplicateOf: ["a@x.vn"] }),
      stu({ id: "c@x.vn" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].students).toHaveLength(3);
  });

  it("hồ sơ lẻ loi không tạo nhóm", () => {
    expect(findDuplicateGroups([stu({ id: "a@x.vn" })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `findDuplicateGroups is not a function`

- [ ] **Step 3: Bổ sung vào `src/lib/students.ts`**

Thêm import `Student`, `DuplicateGroup` vào dòng import đầu file, rồi:

```ts
/* Một cặp coi như đã xử lý nếu BẤT KỲ bên nào đánh dấu bên kia là không trùng —
   giáo vụ đã quyết một lần rồi thì đừng hỏi lại từ phía còn lại. */
function pairDismissed(a: Student, b: Student): boolean {
  return (a.notDuplicateOf || []).includes(b.id || "")
    || (b.notDuplicateOf || []).includes(a.id || "");
}

/* Nghi trùng = cùng tên + cùng khoa/phòng nhưng khác email. Chỉ gợi ý cho
   giáo vụ xem lại, không bao giờ tự gộp: hai người trùng tên trong cùng khoa
   là chuyện có thật. */
export function findDuplicateGroups(students: Student[]): DuplicateGroup[] {
  const buckets = new Map<string, Student[]>();

  for (const s of students) {
    const name = normalizeName(s.fullName);
    const dept = normalizeName(s.department);
    if (!name || !dept) continue;   // thiếu một trong hai thì không đủ căn cứ
    const key = `${name}|${dept}`;
    buckets.set(key, [...(buckets.get(key) || []), s]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;

    // Còn ít nhất một cặp chưa được giáo vụ xử lý thì mới đáng báo.
    let hasOpenPair = false;
    for (let i = 0; i < members.length && !hasOpenPair; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (!pairDismissed(members[i], members[j])) { hasOpenPair = true; break; }
      }
    }
    if (!hasOpenPair) continue;

    groups.push({
      key,
      fullName: members[0].fullName,
      department: members[0].department,
      students: members,
    });
  }

  return groups.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test && npm run lint`
Expected: PASS — 8 test mới (tổng 34), lint sạch

- [ ] **Step 5: Commit**

```bash
git add src/lib/students.ts src/lib/students.test.ts
git commit -m "feat: phat hien ho so nghi trung theo ten va khoa phong

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Repo `students` + script chuyển đổi dữ liệu

**Files:**
- Create: `src/lib/repo/students.ts`
- Create: `src/lib/migrate.ts`

**Interfaces:**
- Consumes: `buildStudentsFromSubmissions` (Task 2), `fetchSubmissions` từ `repo/submissions.ts`
- Produces:
  - `fetchStudents(): Promise<Student[]>`
  - `upsertStudentDrafts(drafts: StudentDraft[]): Promise<{ created: number; updated: number }>`
  - `markNotDuplicate(idA: string, idB: string): Promise<void>`
  - `mergeStudents(keepId: string, dropId: string): Promise<void>`
  - `migrateStudents(): Promise<MigrateReport>` với `MigrateReport = { created: number; updated: number; skipped: SkippedSubmission[] }`

- [ ] **Step 1: Viết `src/lib/repo/students.ts`**

```ts
import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc,
  arrayUnion, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Student, StudentDraft } from "../../types";

const COL = "students";

export async function fetchStudents(): Promise<Student[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
  return list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "vi"));
}

/* Ghi hàng loạt hồ sơ. Chạy lại nhiều lần không nhân đôi vì Document ID là
   email: lần sau chỉ ghi đè. Đọc trước để giữ nguyên createdAt và những
   trường do giáo vụ quyết định (notDuplicateOf, mergedFrom) — nếu ghi đè
   thẳng thì mỗi lần migrate lại làm sống dậy các nhóm nghi trùng đã xử lý. */
export async function upsertStudentDrafts(
  drafts: StudentDraft[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Firestore giới hạn 500 thao tác mỗi batch.
  const CHUNK = 400;
  for (let i = 0; i < drafts.length; i += CHUNK) {
    const slice = drafts.slice(i, i + CHUNK);
    const existing = await Promise.all(
      slice.map(d => getDoc(doc(db, COL, d.id)))
    );

    const batch = writeBatch(db);
    slice.forEach((draft, idx) => {
      const snap = existing[idx];
      const prev = snap.exists() ? (snap.data() as Student) : null;
      if (prev) updated++; else created++;

      // Bỏ id ra khỏi phần thân: nó đã là Document ID rồi. Ghi cả hai chỗ thì
      // fetchStudents (trải data() lên sau {id: d.id}) sẽ lấy bản trong thân,
      // và hai giá trị này có thể lệch nhau sau một lần gộp hồ sơ.
      const { id: _id, ...body } = draft;
      batch.set(doc(db, COL, draft.id), {
        ...body,
        notDuplicateOf: prev?.notDuplicateOf || [],
        mergedFrom: prev?.mergedFrom || [],
        createdAt: prev?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { created, updated };
}

/* Đánh dấu hai chiều: nếu chỉ ghi một chiều, xóa rồi tạo lại hồ sơ kia là
   nhóm nghi trùng hiện lại. */
export async function markNotDuplicate(idA: string, idB: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, idA), { notDuplicateOf: arrayUnion(idB), updatedAt: serverTimestamp() });
  batch.update(doc(db, COL, idB), { notDuplicateOf: arrayUnion(idA), updatedAt: serverTimestamp() });
  await batch.commit();
}

/* Gộp: giữ keepId, xóa dropId, ghi vết vào mergedFrom.
   NỢ KỸ THUẬT GĐ3: khi có enrollments/sessions, hàm này phải trỏ lại mọi
   ghi danh và bản ghi điểm danh của dropId sang keepId TRƯỚC khi xóa. */
export async function mergeStudents(keepId: string, dropId: string): Promise<void> {
  const dropSnap = await getDoc(doc(db, COL, dropId));
  const dropData = dropSnap.exists() ? (dropSnap.data() as Student) : null;

  await updateDoc(doc(db, COL, keepId), {
    mergedFrom: arrayUnion(dropId, ...(dropData?.mergedFrom || [])),
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, COL, dropId));
}
```

- [ ] **Step 2: Viết `src/lib/migrate.ts`**

```ts
import { fetchSubmissions } from "./repo/submissions";
import { upsertStudentDrafts } from "./repo/students";
import { buildStudentsFromSubmissions } from "./students";
import { SkippedSubmission } from "../types";

export interface MigrateReport {
  created: number;
  updated: number;
  skipped: SkippedSubmission[];
  totalSubmissions: number;
}

/* Dựng lại toàn bộ hồ sơ học viên từ phiếu khảo sát. Chạy được nhiều lần:
   Document ID là email nên lần sau chỉ cập nhật, không nhân đôi. Gọi tay từ
   màn Quản trị chứ không tự chạy khi tải trang — tự chạy là kiểu lỗi đã gặp
   với seedInitialData trước đây (xem chú thích cũ ở src/App.tsx). */
export async function migrateStudents(): Promise<MigrateReport> {
  const submissions = await fetchSubmissions();
  const { drafts, skipped } = buildStudentsFromSubmissions(submissions);
  const { created, updated } = await upsertStudentDrafts(drafts);
  return { created, updated, skipped, totalSubmissions: submissions.length };
}
```

- [ ] **Step 3: Kiểm tra kiểu**

Run: `npm run lint && npm test`
Expected: sạch lỗi, 34 test pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/repo/students.ts src/lib/migrate.ts
git commit -m "feat: them repo students va script dung ho so tu phieu khao sat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Màn danh sách hồ sơ học viên

**Files:**
- Create: `src/features/students/StudentProfileList.tsx`

**Interfaces:**
- Consumes: `Student` từ `src/types.ts`; `LEVEL_RAMP`, `LEVEL_LABEL` từ `src/lib/levels.ts`
- Produces: `StudentProfileList` với props
  `{ students: Student[]; loading: boolean; onMigrate: () => void; migrating: boolean; report: MigrateReport | null }`

- [ ] **Step 1: Viết `src/features/students/StudentProfileList.tsx`**

```tsx
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
    <div className="space-y-4">
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
                        Chưa có hồ sơ nào. Bấm "Dựng lại hồ sơ từ phiếu" để tạo từ dữ liệu khảo sát.
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
    </div>
  );
}
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npm run lint`
Expected: sạch lỗi

- [ ] **Step 3: Commit**

```bash
git add src/features/students/StudentProfileList.tsx
git commit -m "feat: man danh sach ho so hoc vien kem nut dung lai tu phieu

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Màn duyệt hồ sơ nghi trùng

**Files:**
- Create: `src/features/students/DuplicateReview.tsx`

**Interfaces:**
- Consumes: `findDuplicateGroups` (Task 3); `Student`, `DuplicateGroup`
- Produces: `DuplicateReview` với props
  `{ students: Student[]; onMerge: (keepId: string, dropId: string) => Promise<void>; onDismiss: (idA: string, idB: string) => Promise<void>; busy: boolean }`

- [ ] **Step 1: Viết `src/features/students/DuplicateReview.tsx`**

```tsx
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
              {g.students.filter(s => s.id !== keepId).map((s) => (
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
              {g.students.filter(s => s.id !== keepId).map((s) => (
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
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npm run lint`
Expected: sạch lỗi

- [ ] **Step 3: Commit**

```bash
git add src/features/students/DuplicateReview.tsx
git commit -m "feat: man duyet ho so nghi trung voi thao tac gop va bo qua

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Gắn vào bảng Quản trị

**Files:**
- Modify: `src/App.tsx` (nạp `students`, truyền xuống)
- Modify: `src/components/AdminDashboard.tsx` (ba chế độ xem trong tab Học viên)

**Interfaces:**
- Consumes: `fetchStudents`, `markNotDuplicate`, `mergeStudents` (Task 4); `migrateStudents` (Task 4); `StudentProfileList` (Task 5); `DuplicateReview` (Task 6)
- Produces: `AdminDashboard` nhận thêm props
  `{ students: Student[]; studentsLoading: boolean; onRefreshStudents: () => Promise<void> }`

- [ ] **Step 1: Nạp `students` trong `src/App.tsx`**

Thêm import:

```ts
import { Student } from "./types";
import { fetchStudents } from "./lib/repo/students";
```

Thêm state cạnh `submissions`:

```ts
const [students, setStudents] = useState<Student[]>([]);
```

Trong `loadAdminData`, đổi `Promise.all` thành ba lệnh và nhận thêm hồ sơ:

```ts
const [subs, cls, stu] = await Promise.all([
  fetchSubmissions(), fetchClasses(), fetchStudents(),
]);
setSubmissions(subs);
setClasses(cls);
setStudents(stu);
```

Trong `handleLogout`, thêm `setStudents([]);`.

Truyền xuống `AdminDashboard`:

```tsx
<AdminDashboard
  submissions={submissions}
  announcements={announcements}
  classes={classes}
  students={students}
  studentsLoading={adminLoading}
  onRefreshData={loadAdminData}
/>
```

- [ ] **Step 2: Thêm ba chế độ xem trong `src/components/AdminDashboard.tsx`**

Thêm import:

```ts
import StudentProfileList from "../features/students/StudentProfileList";
import DuplicateReview from "../features/students/DuplicateReview";
import { migrateStudents, MigrateReport } from "../lib/migrate";
import { markNotDuplicate, mergeStudents } from "../lib/repo/students";
import { Student } from "../types";
```

Mở rộng props interface:

```ts
interface AdminDashboardProps {
  submissions: SurveySubmission[];
  announcements: Announcement[];
  classes: ClassSession[];
  students: Student[];
  studentsLoading: boolean;
  onRefreshData: () => void;
}
```

Thêm state:

```ts
/* Ba chế độ xem trong tab Học viên. Hồ sơ là mặc định vì đó là đơn vị vận
   hành (một dòng một người); bảng phiếu giữ lại làm dữ liệu thô để đối chiếu. */
const [studentView, setStudentView] = useState<"profiles" | "duplicates" | "submissions">("profiles");
const [migrating, setMigrating] = useState(false);
const [migrateReport, setMigrateReport] = useState<MigrateReport | null>(null);
const [studentActionBusy, setStudentActionBusy] = useState(false);

const handleMigrate = async () => {
  if (!confirm("Dựng lại hồ sơ học viên từ toàn bộ phiếu khảo sát? Thao tác này an toàn khi chạy nhiều lần.")) return;
  setMigrating(true);
  try {
    const report = await migrateStudents();
    setMigrateReport(report);
    onRefreshData();
  } catch (err) {
    console.error("Lỗi khi dựng hồ sơ học viên: ", err);
    alert("Không dựng được hồ sơ. Kiểm tra quyền tài khoản và kết nối mạng.");
  } finally {
    setMigrating(false);
  }
};

const handleMergeStudents = async (keepId: string, dropId: string) => {
  setStudentActionBusy(true);
  try {
    await mergeStudents(keepId, dropId);
    onRefreshData();
  } catch (err) {
    console.error("Lỗi khi gộp hồ sơ: ", err);
    alert("Không gộp được hồ sơ. Vui lòng thử lại.");
  } finally {
    setStudentActionBusy(false);
  }
};

const handleDismissDuplicate = async (idA: string, idB: string) => {
  setStudentActionBusy(true);
  try {
    await markNotDuplicate(idA, idB);
    onRefreshData();
  } catch (err) {
    console.error("Lỗi khi đánh dấu không trùng: ", err);
    alert("Không lưu được đánh dấu. Vui lòng thử lại.");
  } finally {
    setStudentActionBusy(false);
  }
};
```

- [ ] **Step 3: Bọc nội dung tab Học viên bằng thanh chuyển chế độ xem**

Ngay sau `{adminSubTab === "students" && (` và trước `<div className="space-y-4">` hiện có, chèn thanh chọn; sau đó bọc bảng phiếu hiện có trong điều kiện `studentView === "submissions"`:

```tsx
{adminSubTab === "students" && (
  <div className="space-y-4">
    <div className="inline-flex rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#E8F0F9] to-[#DCE8F4]">
      {[
        { id: "profiles", label: `Hồ sơ (${students.length})` },
        { id: "duplicates", label: "Nghi trùng" },
        { id: "submissions", label: `Phiếu khảo sát (${submissions.length})` },
      ].map(v => (
        <button
          key={v.id}
          id={`student-view-${v.id}`}
          onClick={() => setStudentView(v.id as any)}
          className={`px-3.5 py-1.5 text-[12.5px] font-bold rounded-[7px] transition-all cursor-pointer ${
            studentView === v.id
              ? "bg-gradient-to-b from-white to-[#F6FAFD] text-brand-navy shadow-[0_2px_6px_-2px_rgb(20_51_110/0.3)]"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>

    {studentView === "profiles" && (
      <StudentProfileList
        students={students}
        loading={studentsLoading}
        migrating={migrating}
        report={migrateReport}
        onMigrate={handleMigrate}
      />
    )}

    {studentView === "duplicates" && (
      <DuplicateReview
        students={students}
        busy={studentActionBusy}
        onMerge={handleMergeStudents}
        onDismiss={handleDismissDuplicate}
      />
    )}

    {studentView === "submissions" && (
      /* ... toàn bộ khối bảng phiếu khảo sát hiện có, không sửa nội dung ... */
    )}
  </div>
)}
```

Phần phiếu chi tiết (`selectedSubmission`) giữ nguyên vị trí bên ngoài, để mở được từ bảng phiếu.

- [ ] **Step 4: Kiểm tra kiểu, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: sạch lỗi, 34 test pass, build thành công

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/AdminDashboard.tsx
git commit -m "feat: gan ho so hoc vien va man nghi trung vao bang Quan tri

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Kiểm thử tay trước khi deploy

Cần một tài khoản `admin` đã cấp trên Firebase Console (xem `docs/van-hanh-firebase.md`).

1. Đăng nhập admin → tab Học viên → chế độ **Hồ sơ**: lần đầu bảng rỗng kèm lời nhắc bấm nút dựng.
2. Bấm **Dựng lại hồ sơ từ phiếu** → hiện báo cáo "đọc N phiếu · tạo mới X · cập nhật Y". Bảng hiện đủ hồ sơ, mỗi email một dòng.
3. Bấm lần thứ hai → báo cáo phải cho thấy **tạo mới 0, cập nhật X** — chạy lại không nhân đôi.
4. Nếu có phiếu thiếu email → báo cáo liệt kê tên những người bị bỏ qua.
5. Chế độ **Nghi trùng**: nếu có hai hồ sơ cùng tên cùng khoa khác email, nhóm hiện ra. Bấm "Không trùng" → nhóm biến mất; dựng lại hồ sơ rồi vào lại → **vẫn không hiện lại** (đánh dấu được giữ).
6. Gộp một hồ sơ → hồ sơ bị gộp biến mất khỏi danh sách, hồ sơ giữ lại còn nguyên.
7. Chế độ **Phiếu khảo sát**: bảng cũ, bộ lọc, "Xem chi tiết" đều hoạt động như trước.
8. Đăng xuất → đăng nhập lại bằng tài khoản `teacher`: xem được hồ sơ, nhưng bấm dựng/gộp báo lỗi quyền (rules chỉ cho admin ghi `students`).

## Deploy

```bash
npm run lint && npm test && npm run build
git push origin main
```

Rules đã khai báo `students` từ GĐ1 nên **không cần publish lại rules** cho giai đoạn này.
