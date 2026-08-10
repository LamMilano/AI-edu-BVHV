# GĐ1 — Xác thực & phân quyền: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay cổng mật khẩu chung bằng Firebase Auth có vai trò, siết Firestore Security Rules, và gom mọi truy vấn Firestore vào một tầng `lib/repo/` — nền móng cho bốn giai đoạn sau.

**Architecture:** Firebase Auth email/mật khẩu; vai trò đọc từ document `users/{uid}.role` (không dùng custom claims vì cần Cloud Functions). Rules cho khách vãng lai **chỉ** tạo được phiếu khảo sát, nên trang chủ đổi sang đọc số liệu tổng hợp từ `public_stats/summary` thay vì đọc thô `survey_submissions`. Mọi lệnh đọc/ghi Firestore chuyển vào `lib/repo/*`, để giai đoạn sau chỉ phải thêm file mới thay vì sửa component.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Firebase 12 (Firestore + Auth), Tailwind 4, Vitest (thêm mới).

## Global Constraints

- Toàn bộ chuỗi hiển thị cho người dùng viết bằng **tiếng Việt có dấu**.
- Comment trong code viết bằng tiếng Việt, giải thích **vì sao** chứ không mô tả lại code — theo đúng lối viết đang có trong `src/App.tsx` và `src/lib/levels.ts`.
- Commit message viết **không dấu** (khớp lịch sử git hiện tại), tiền tố `feat:` / `refactor:` / `chore:`.
- Không đổi giao diện đang có ngoài những gì plan nêu. Bảng màu, class Tailwind tùy biến (`surface`, `field`, `btn-primary`, `cut-corner`, `tnum`, `text-grad`) giữ nguyên.
- Không thêm thư viện nào ngoài `vitest`.
- Không dùng `orderBy` trên trường mà document cũ có thể thiếu (Firestore loại bỏ khỏi kết quả mọi document thiếu trường được sắp xếp). Sắp xếp trong bộ nhớ sau khi đọc.
- Mọi thông báo lỗi đăng nhập **không được tiết lộ email nào có tồn tại**: sai email và sai mật khẩu trả về cùng một câu.
- Chạy `npm run lint` (tsc --noEmit) trước mỗi commit; phải sạch lỗi.

## Việc phải làm tay trên Firebase Console (người vận hành, không phải code)

**Thứ tự bắt buộc — làm ngược sẽ tự khóa mình ra khỏi dữ liệu:**

1. Firebase Console → Authentication → Sign-in method → bật **Email/Password**.
2. Authentication → Users → **Add user**, tạo tài khoản cho giáo vụ và từng giảng viên. Ghi lại `uid` của mỗi tài khoản.
3. Firestore → tạo collection `users`, mỗi tài khoản một document có **Document ID đúng bằng `uid`**:
   ```
   email: "giaovu@benhvienhungvuong.vn"
   displayName: "Nguyễn Văn A"
   role: "admin"        // hoặc "teacher"
   ```
4. **Chỉ sau khi bước 3 xong**, mới dán `firestore.rules` mới vào Firestore → Rules → Publish.

Bước 4 làm sau khi Task 7 đã merge và deploy.

---

### Task 1: Vitest + `computePublicStats`

Hàm thuần tính số liệu tổng hợp cho trang chủ. Đây là hàm đầu tiên có test, nên task này dựng luôn hạ tầng test.

**Files:**
- Modify: `package.json` (thêm devDependency `vitest`, thêm script `test`)
- Modify: `src/types.ts` (thêm `PublicStatsData`, `PublicStats`, `Role`, `AuthUser`)
- Create: `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

**Interfaces:**
- Consumes: `SurveySubmission` từ `src/types.ts` (đã có)
- Produces:
  - `PublicStatsData = { totalStudents: number; byLevel: { L1: number; L2: number; L3: number }; topDepartments: { name: string; count: number }[] }`
  - `computePublicStats(submissions: SurveySubmission[]): PublicStatsData`

- [ ] **Step 1: Cài Vitest và thêm script**

```bash
npm install --save-dev vitest@^3
```

Trong `package.json`, thêm vào `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Thêm kiểu dữ liệu vào `src/types.ts`**

Thêm vào cuối file:

```ts
/* Số liệu tổng hợp cho trang chủ. Khách vãng lai không có quyền đọc
   survey_submissions sau khi siết rules, nên trang chủ đọc document
   public_stats/summary thay vì tự đếm từ dữ liệu thô. */
export interface PublicStatsData {
  totalStudents: number;
  byLevel: { L1: number; L2: number; L3: number };
  topDepartments: { name: string; count: number }[];
}

export interface PublicStats extends PublicStatsData {
  updatedAt: any; // Firestore Timestamp
}

export type Role = "admin" | "teacher";

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
}
```

- [ ] **Step 3: Viết test thất bại**

Tạo `src/lib/stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computePublicStats } from "./stats";
import { SurveySubmission } from "../types";

// Chỉ dựng những trường mà computePublicStats thực sự đọc.
const sub = (level: string, department: string): SurveySubmission =>
  ({ assignedLevel: level, department } as unknown as SurveySubmission);

describe("computePublicStats", () => {
  it("trả về số 0 cho danh sách rỗng", () => {
    expect(computePublicStats([])).toEqual({
      totalStudents: 0,
      byLevel: { L1: 0, L2: 0, L3: 0 },
      topDepartments: [],
    });
  });

  it("đếm đúng số học viên theo từng cấp độ", () => {
    const result = computePublicStats([
      sub("L1", "Nội"), sub("L1", "Nội"), sub("L2", "Ngoại"), sub("L3", "Dược"),
    ]);
    expect(result.totalStudents).toBe(4);
    expect(result.byLevel).toEqual({ L1: 2, L2: 1, L3: 1 });
  });

  it("bỏ qua cấp độ lạ nhưng vẫn tính vào tổng", () => {
    const result = computePublicStats([sub("L9", "Nội"), sub("L1", "Nội")]);
    expect(result.totalStudents).toBe(2);
    expect(result.byLevel).toEqual({ L1: 1, L2: 0, L3: 0 });
  });

  it("gộp khoa/phòng rỗng hoặc toàn khoảng trắng vào 'Khác'", () => {
    const result = computePublicStats([sub("L1", ""), sub("L1", "   "), sub("L1", "Nội")]);
    expect(result.topDepartments).toEqual([
      { name: "Khác", count: 2 },
      { name: "Nội", count: 1 },
    ]);
  });

  it("chỉ giữ 5 khoa/phòng đông nhất, sắp giảm dần", () => {
    const subs = [
      ...Array(6).fill(0).map(() => sub("L1", "A")),
      ...Array(5).fill(0).map(() => sub("L1", "B")),
      ...Array(4).fill(0).map(() => sub("L1", "C")),
      ...Array(3).fill(0).map(() => sub("L1", "D")),
      ...Array(2).fill(0).map(() => sub("L1", "E")),
      sub("L1", "F"),
    ];
    const result = computePublicStats(subs);
    expect(result.topDepartments.map(d => d.name)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("hai khoa bằng điểm thì sắp theo tên, để kết quả ổn định giữa các lần chạy", () => {
    const result = computePublicStats([sub("L1", "Ngoại"), sub("L1", "Dược")]);
    expect(result.topDepartments.map(d => d.name)).toEqual(["Dược", "Ngoại"]);
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./stats"`

- [ ] **Step 5: Viết `src/lib/stats.ts`**

```ts
import { SurveySubmission, PublicStatsData } from "../types";

/* Tính số liệu tổng hợp từ danh sách phiếu khảo sát.
   Hàm thuần, không chạm Firestore — vừa test được, vừa dùng chung cho
   cả bảng quản trị (tính tại chỗ) lẫn trang chủ (đọc bản đã ghi sẵn). */
export function computePublicStats(submissions: SurveySubmission[]): PublicStatsData {
  const byLevel = { L1: 0, L2: 0, L3: 0 };
  const deptMap: Record<string, number> = {};

  for (const s of submissions) {
    if (s.assignedLevel in byLevel) {
      byLevel[s.assignedLevel]++;
    }
    // Phiếu cũ có thể thiếu khoa/phòng; gom hết về một nhóm thay vì tạo ô trống.
    const dept = (s.department || "").trim() || "Khác";
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  }

  const topDepartments = Object.entries(deptMap)
    .map(([name, count]) => ({ name, count }))
    // Khi bằng điểm thì sắp theo tên, nếu không thứ tự sẽ nhảy mỗi lần tải lại.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"))
    .slice(0, 5);

  return { totalStudents: submissions.length, byLevel, topDepartments };
}
```

- [ ] **Step 6: Chạy test, xác nhận pass**

Run: `npm test`
Expected: PASS — 6 tests

- [ ] **Step 7: Kiểm tra kiểu**

Run: `npm run lint`
Expected: không có output (sạch lỗi)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/types.ts src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat: them Vitest va ham thuan computePublicStats

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Tầng xác thực `lib/authz.ts`

**Files:**
- Create: `src/lib/authz.ts`
- Test: `src/lib/authz.test.ts`
- Modify: `src/lib/firebase.ts` (xuất thêm `auth`)

**Interfaces:**
- Consumes: `app`, `db` từ `src/lib/firebase.ts`; `AuthUser`, `Role` từ `src/types.ts` (Task 1)
- Produces:
  - `authErrorMessage(code: string): string`
  - `onAuthChange(cb: (user: AuthUser | null) => void): () => void` — trả về hàm hủy đăng ký
  - `signIn(email: string, password: string): Promise<void>` — ném lỗi có `.code`
  - `signOutUser(): Promise<void>`

- [ ] **Step 1: Viết test thất bại cho `authErrorMessage`**

Tạo `src/lib/authz.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authErrorMessage } from "./authz";

describe("authErrorMessage", () => {
  it("trả cùng một câu cho sai email và sai mật khẩu, để không lộ email nào có thật", () => {
    const a = authErrorMessage("auth/user-not-found");
    const b = authErrorMessage("auth/wrong-password");
    const c = authErrorMessage("auth/invalid-credential");
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("nói rõ khi bị chặn vì thử quá nhiều lần", () => {
    expect(authErrorMessage("auth/too-many-requests"))
      .toBe("Sai quá nhiều lần. Vui lòng thử lại sau ít phút.");
  });

  it("nói rõ khi mất mạng, vì đây là lỗi người dùng tự sửa được", () => {
    expect(authErrorMessage("auth/network-request-failed"))
      .toBe("Không có kết nối mạng. Kiểm tra lại đường truyền.");
  });

  it("nói rõ khi tài khoản đăng nhập được nhưng chưa được cấp vai trò", () => {
    expect(authErrorMessage("auth/no-role"))
      .toBe("Tài khoản chưa được cấp quyền. Liên hệ quản trị viên.");
  });

  it("có câu dự phòng cho mã lỗi lạ", () => {
    expect(authErrorMessage("auth/khong-ton-tai"))
      .toBe("Đăng nhập không thành công. Vui lòng thử lại.");
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./authz"`

- [ ] **Step 3: Xuất `auth` từ `src/lib/firebase.ts`**

Thay toàn bộ nội dung file:

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with the specific database ID if provided, or default
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");

const auth = getAuth(app);

export { app, db, auth };
```

- [ ] **Step 4: Viết `src/lib/authz.ts`**

```ts
/* Xác thực bằng Firebase Auth + vai trò đọc từ document users/{uid}.
   Không dùng custom claims: claims phải gán bằng Admin SDK hoặc Cloud
   Functions, quá nặng so với nhu cầu vài tài khoản của chương trình này.
   Đánh đổi: mỗi lần rules kiểm tra quyền phải đọc thêm một document. */
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { AuthUser, Role } from "../types";

/* Sai email và sai mật khẩu cố tình dùng chung một câu: nếu tách ra,
   người ngoài có thể dò xem email nào đã có tài khoản. */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Email không hợp lệ.",
  "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa.",
  "auth/user-not-found": "Email hoặc mật khẩu không đúng.",
  "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/too-many-requests": "Sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
  "auth/network-request-failed": "Không có kết nối mạng. Kiểm tra lại đường truyền.",
  "auth/no-role": "Tài khoản chưa được cấp quyền. Liên hệ quản trị viên.",
};

export function authErrorMessage(code: string): string {
  return MESSAGES[code] || "Đăng nhập không thành công. Vui lòng thử lại.";
}

/* Đọc vai trò. Trả null khi chưa có document users/{uid} hoặc vai trò
   không hợp lệ — tài khoản đăng nhập được nhưng chưa được cấp quyền. */
async function loadRole(user: User): Promise<AuthUser | null> {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;

  const data = snap.data() as { role?: string; displayName?: string; email?: string };
  if (data.role !== "admin" && data.role !== "teacher") return null;

  return {
    uid: user.uid,
    email: data.email || user.email || "",
    displayName: data.displayName || user.email || "",
    role: data.role as Role,
  };
}

/* Theo dõi trạng thái đăng nhập. Trả hàm hủy đăng ký để useEffect dọn dẹp. */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cb(null);
      return;
    }
    try {
      const authed = await loadRole(user);
      if (!authed) {
        // Có phiên Auth nhưng không có vai trò: đăng xuất để không kẹt ở
        // trạng thái nửa vời (đăng nhập rồi mà mọi lệnh đọc đều bị từ chối).
        await signOut(auth);
        cb(null);
        return;
      }
      cb(authed);
    } catch {
      cb(null);
    }
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  // Giữ phiên qua các lần đóng/mở trình duyệt, thay cho localStorage thủ công trước đây.
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

  const authed = await loadRole(cred.user);
  if (!authed) {
    await signOut(auth);
    const err = new Error("no-role") as Error & { code: string };
    err.code = "auth/no-role";
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npm test`
Expected: PASS — 11 tests (6 của Task 1 + 5 mới)

- [ ] **Step 6: Kiểm tra kiểu**

Run: `npm run lint`
Expected: sạch lỗi

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase.ts src/lib/authz.ts src/lib/authz.test.ts
git commit -m "feat: them tang xac thuc Firebase Auth kem vai tro

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Tầng truy cập dữ liệu `lib/repo/`

Gom mọi lệnh Firestore đang rải rác ở `App.tsx`, `AdminDashboard.tsx`, `SurveyForm.tsx` vào một chỗ. Đây là refactor thuần: không đổi hành vi.

**Files:**
- Create: `src/lib/repo/submissions.ts`
- Create: `src/lib/repo/announcements.ts`
- Create: `src/lib/repo/classes.ts`
- Create: `src/lib/repo/publicStats.ts`
- Modify: `src/components/SurveyForm.tsx:2` và `:449`
- Modify: `src/components/AdminDashboard.tsx:1-15`, `:150-152`, `:176`, `:203`

**Interfaces:**
- Consumes: `db` từ `src/lib/firebase.ts`; `SurveySubmission`, `Announcement`, `ClassSession`, `PublicStatsData` từ `src/types.ts`
- Produces:
  - `fetchSubmissions(): Promise<SurveySubmission[]>`
  - `createSubmission(data: Omit<SurveySubmission, "id" | "submittedAt">): Promise<string>`
  - `fetchAnnouncements(): Promise<Announcement[]>`
  - `createAnnouncement(input: { title: string; content: string; category: Announcement["category"] }): Promise<void>`
  - `deleteAnnouncement(id: string): Promise<void>`
  - `fetchClasses(): Promise<ClassSession[]>`
  - `saveClass(id: string | null, data: Omit<ClassSession, "id">): Promise<void>`
  - `deleteClass(id: string): Promise<void>`
  - `fetchPublicStats(): Promise<PublicStatsData | null>`
  - `writePublicStats(stats: PublicStatsData): Promise<void>`

- [ ] **Step 1: Tạo `src/lib/repo/submissions.ts`**

```ts
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SurveySubmission } from "../../types";

const COL = "survey_submissions";

/* KHÔNG dùng orderBy("submittedAt"): Firestore loại khỏi kết quả mọi
   document thiếu trường được sắp xếp, nên phiếu cũ sẽ biến mất. Sắp xếp
   trong bộ nhớ, phiếu thiếu ngày đẩy xuống cuối. */
export async function fetchSubmissions(): Promise<SurveySubmission[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SurveySubmission[];
  return list.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

export async function createSubmission(
  data: Omit<SurveySubmission, "id" | "submittedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), { ...data, submittedAt: serverTimestamp() });
  return ref.id;
}
```

- [ ] **Step 2: Tạo `src/lib/repo/announcements.ts`**

```ts
import {
  collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { Announcement } from "../../types";

const COL = "announcements";

/* Thông báo luôn được tạo qua createAnnouncement nên chắc chắn có createdAt;
   dùng orderBy ở đây an toàn, khác với survey_submissions. */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Announcement[];
}

export async function createAnnouncement(input: {
  title: string;
  content: string;
  category: Announcement["category"];
}): Promise<void> {
  await addDoc(collection(db, COL), {
    ...input,
    date: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
```

- [ ] **Step 3: Tạo `src/lib/repo/classes.ts`**

```ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { ClassSession } from "../../types";

const COL = "classes";

export async function fetchClasses(): Promise<ClassSession[]> {
  const snap = await getDocs(collection(db, COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClassSession[];
  return list.sort((a, b) => a.level.localeCompare(b.level));
}

/* id === null nghĩa là thêm mới. Gộp hai trường hợp vào một hàm để
   component không phải rẽ nhánh addDoc/updateDoc. */
export async function saveClass(
  id: string | null,
  data: Omit<ClassSession, "id">
): Promise<void> {
  if (id) {
    await updateDoc(doc(db, COL, id), data);
  } else {
    await addDoc(collection(db, COL), data);
  }
}

export async function deleteClass(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
```

- [ ] **Step 4: Tạo `src/lib/repo/publicStats.ts`**

```ts
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { PublicStatsData } from "../../types";

const DOC_PATH = ["public_stats", "summary"] as const;

/* Trả null khi chưa có document — trang chủ dựa vào đó để ẩn khối thống kê
   thay vì hiển thị một dãy số 0 trông như chương trình không có ai học. */
export async function fetchPublicStats(): Promise<PublicStatsData | null> {
  const snap = await getDoc(doc(db, ...DOC_PATH));
  if (!snap.exists()) return null;
  return snap.data() as PublicStatsData;
}

export async function writePublicStats(stats: PublicStatsData): Promise<void> {
  await setDoc(doc(db, ...DOC_PATH), { ...stats, updatedAt: serverTimestamp() });
}
```

- [ ] **Step 5: Chuyển `SurveyForm.tsx` sang dùng repo**

Ở dòng 2, thay import Firestore:

```ts
// XÓA: import { collection, addDoc, serverTimestamp } from "firebase/firestore";
// XÓA dòng import db nếu không còn dùng chỗ nào khác trong file.
import { createSubmission } from "../lib/repo/submissions";
```

Ở dòng ~449, thay lệnh ghi. Trước:

```ts
await addDoc(collection(db, "survey_submissions"), submission);
```

Sau — bỏ `submittedAt` khỏi object `submission` nếu đang tự gán ở đó, vì `createSubmission` đã tự thêm:

```ts
await createSubmission(submission);
```

- [ ] **Step 6: Chuyển `AdminDashboard.tsx` sang dùng repo**

Thay khối import Firestore ở dòng 2-5:

```ts
// XÓA: import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
// XÓA: import { db } from "../lib/firebase";
import { saveClass, deleteClass } from "../lib/repo/classes";
import { createAnnouncement, deleteAnnouncement } from "../lib/repo/announcements";
```

Trong `handleSaveClass` (dòng ~150), thay khối `if (editingClassId) ... else ...` bằng:

```ts
await saveClass(editingClassId, newClass);
```

Trong hàm tạo thông báo (dòng ~176), thay `addDoc(collection(db, "announcements"), {...})` bằng:

```ts
await createAnnouncement(newAnn);
```

Trong hàm xóa (dòng ~203) hiện dùng chung biến `coll`; tách thành hai nhánh rõ ràng:

```ts
if (coll === "classes") {
  await deleteClass(id);
} else {
  await deleteAnnouncement(id);
}
```

- [ ] **Step 7: Kiểm tra kiểu và build**

Run: `npm run lint && npm run build`
Expected: sạch lỗi, build thành công

- [ ] **Step 8: Commit**

```bash
git add src/lib/repo src/components/SurveyForm.tsx src/components/AdminDashboard.tsx
git commit -m "refactor: gom truy van Firestore vao tang lib/repo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `TeacherLogin` đổi sang form email/mật khẩu

**Files:**
- Modify: `src/components/TeacherLogin.tsx` (viết lại toàn bộ)

**Interfaces:**
- Consumes: `signIn`, `authErrorMessage` từ `src/lib/authz.ts` (Task 2)
- Produces: `TeacherLogin` với prop `onSuccess: () => void` (giữ nguyên chữ ký cũ, nên `App.tsx` chưa cần đổi ở task này)

- [ ] **Step 1: Viết lại `src/components/TeacherLogin.tsx`**

```tsx
import React, { useState } from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { signIn, authErrorMessage } from "../lib/authz";

interface TeacherLoginProps {
  onSuccess: () => void;
}

export default function TeacherLogin({ onSuccess }: TeacherLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      const code = (err as { code?: string }).code || "";
      setError(authErrorMessage(code));
      // Xóa mật khẩu nhưng GIỮ email: gõ lại email mỗi lần sai rất phiền.
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-14 px-4">
      <div className="w-full max-w-md surface cut-corner p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-field flex items-center justify-center flex-none bg-gradient-to-br from-brand-sky-deep to-brand-navy text-white shadow-[0_10px_22px_-8px_rgb(31_78_156/0.75)]">
            <Lock className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">Khu vực giảng viên</h2>
            <p className="text-[13.5px] text-ink-3 mt-0.5">
              Đăng nhập bằng tài khoản được cấp để mở trang quản trị.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teacher-email" className="block text-[13.5px] font-bold text-ink-2 mb-2">
              Email
            </label>
            <input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
              autoFocus
              autoComplete="username"
              required
              aria-invalid={!!error}
              className={`field w-full px-3.5 py-3 text-[14px] ${error ? "field-error" : ""}`}
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-[13.5px] font-bold text-ink-2 mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="teacher-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                aria-invalid={!!error}
                className={`field w-full px-3.5 py-3 pr-11 text-[14px] ${error ? "field-error" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-brand-navy transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-[13px] text-danger-deep font-semibold" role="alert">
              <AlertCircle className="w-4 h-4 flex-none" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 text-[15px] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShieldCheck className="w-4 h-4" />}
            {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <p className="text-[12.5px] text-ink-4 leading-relaxed pt-1 border-t border-line-soft">
          Chỉ dành cho giáo vụ và giảng viên phụ trách lớp. Học viên vui lòng quay lại trang khảo sát.
        </p>
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
git add src/components/TeacherLogin.tsx
git commit -m "feat: doi dang nhap giang vien sang email va mat khau

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `StudentStats` và `HomePortal` đọc số liệu tổng hợp

Sau khi siết rules, khách vãng lai không đọc được `survey_submissions`. Đổi `StudentStats` sang nhận `PublicStatsData` để hai nơi (trang chủ và bảng quản trị) dùng chung đúng một component và đúng một hình dạng dữ liệu.

**Files:**
- Modify: `src/components/StudentStats.tsx:1-46` (đổi props và bỏ phần tự tính)
- Modify: `src/components/HomePortal.tsx:4-8`, `:99`, `:150`
- Modify: `src/components/AdminDashboard.tsx` (chỗ render `<StudentStats submissions={...} />`)

**Interfaces:**
- Consumes: `PublicStatsData` từ `src/types.ts` (Task 1); `computePublicStats` từ `src/lib/stats.ts` (Task 1)
- Produces:
  - `StudentStats` với props `{ stats: PublicStatsData; showCharts?: boolean }`
  - `HomePortal` với props `{ onStartSurvey: () => void; stats: PublicStatsData | null }`

- [ ] **Step 1: Đổi phần đầu `StudentStats.tsx`**

Thay dòng 1-46 (từ `import React` tới hết khối tính `departmentData`) bằng:

```tsx
import React from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";
import { PublicStatsData } from "../types";
import { LEVEL_RAMP, LEVEL_LABEL, LEVEL_IDS, LevelId } from "../lib/levels";

interface StudentStatsProps {
  stats: PublicStatsData;
  /* Biểu đồ chỉ có ý nghĩa khi đang xem danh sách học viên; ở các tab khác
     của Quản trị thì chỉ giữ lại bốn ô số. */
  showCharts?: boolean;
}

/* Khối "Thông tin học viên": bốn ô số + donut phân bố cấp độ + cột khoa/phòng.
   Nhận số liệu đã tổng hợp sẵn thay vì tự đếm từ dữ liệu thô, vì trang chủ
   (khách vãng lai) không có quyền đọc survey_submissions sau khi siết rules.
   Bảng quản trị truyền vào computePublicStats(submissions); trang chủ truyền
   vào document public_stats/summary — hai nơi luôn hiện đúng một con số. */
export default function StudentStats({ stats, showCharts = true }: StudentStatsProps) {
  const totalSubmissions = stats.totalStudents;
  const levelCount: Record<LevelId, number> = stats.byLevel;

  const distributionData = LEVEL_IDS
    .map((id) => ({
      id,
      name: `${LEVEL_LABEL[id]} · ${LEVEL_RAMP[id].name}`,
      value: levelCount[id],
      color: LEVEL_RAMP[id].solid,
    }))
    .filter(d => d.value > 0);

  const departmentData = stats.topDepartments.map(d => ({
    name: d.name,
    students: d.count,
  }));
```

Phần JSX từ `return (` trở xuống **giữ nguyên không sửa** — nó vốn đã chỉ đọc `totalSubmissions`, `levelCount`, `distributionData`, `departmentData`.

- [ ] **Step 2: Đổi `HomePortal.tsx`**

Dòng 4-8, thay import và props:

```tsx
import StudentStats from "./StudentStats";
import { PublicStatsData } from "../types";

interface HomePortalProps {
  onStartSurvey: () => void;
  stats: PublicStatsData | null;
}
```

(Xóa import `SurveySubmission` nếu không còn dùng chỗ nào khác trong file.)

Dòng 99, đổi chữ ký:

```tsx
export default function HomePortal({ onStartSurvey, stats }: HomePortalProps) {
```

Dòng 150, bọc điều kiện — chưa có số liệu thì ẩn hẳn khối, đừng hiện một dãy số 0:

```tsx
{stats && <StudentStats stats={stats} />}
```

- [ ] **Step 3: Đổi chỗ gọi trong `AdminDashboard.tsx`**

Thêm import:

```ts
import { computePublicStats } from "../lib/stats";
```

Ngay sau dòng `const totalSubmissions = submissions.length;`, thêm:

```ts
// Số liệu tổng hợp: cùng một hàm với trang chủ, nên hai nơi không bao giờ lệch nhau.
const publicStats = computePublicStats(submissions);
```

Đổi mọi chỗ `<StudentStats submissions={...} .../>` thành `<StudentStats stats={publicStats} .../>` (giữ nguyên prop `showCharts` nếu đang truyền).

- [ ] **Step 4: Kiểm tra kiểu và build**

Run: `npm run lint && npm run build`
Expected: sạch lỗi, build thành công

- [ ] **Step 5: Commit**

```bash
git add src/components/StudentStats.tsx src/components/HomePortal.tsx src/components/AdminDashboard.tsx
git commit -m "refactor: StudentStats nhan so lieu tong hop thay vi du lieu tho

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `App.tsx` — trạng thái đăng nhập và nạp dữ liệu theo tab

**Files:**
- Modify: `src/App.tsx` (viết lại phần state và nạp dữ liệu, dòng 1-121)
- Delete: `src/lib/auth.ts`
- Modify: `.env.example` (xóa khối `VITE_TEACHER_PASSWORD`)
- Modify: `src/components/Navigation.tsx` (nếu đang hiện chữ liên quan tới mật khẩu)

**Interfaces:**
- Consumes: `onAuthChange`, `signOutUser` từ `src/lib/authz.ts` (Task 2); các hàm `repo/*` (Task 3); `computePublicStats` (Task 1); `HomePortal` với prop `stats` (Task 5)
- Produces: không có gì cho task sau trong giai đoạn này

- [ ] **Step 1: Thay khối import và state ở đầu `src/App.tsx`**

Thay dòng 1-30 bằng:

```tsx
import React, { useState, useEffect } from "react";
import { SurveySubmission, Announcement, ClassSession, PublicStatsData, AuthUser } from "./types";
import Navigation from "./components/Navigation";
import HomePortal from "./components/HomePortal";
import SurveyForm from "./components/SurveyForm";
import AdminDashboard from "./components/AdminDashboard";
import TeacherLogin from "./components/TeacherLogin";
import { onAuthChange, signOutUser } from "./lib/authz";
import { fetchSubmissions } from "./lib/repo/submissions";
import { fetchAnnouncements } from "./lib/repo/announcements";
import { fetchClasses } from "./lib/repo/classes";
import { fetchPublicStats, writePublicStats } from "./lib/repo/publicStats";
import { computePublicStats } from "./lib/stats";
import { CheckCircle2, ArrowRight } from "lucide-react";
import HungVuongLogo from "./components/HungVuongLogo";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "survey" | "admin">("home");

  // Phiên đăng nhập. authReady = false nghĩa là Firebase Auth chưa kịp khôi
  // phục phiên cũ — chưa biết được là khách hay giảng viên, nên chưa vẽ gì.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Dữ liệu công khai: ai cũng đọc được.
  const [stats, setStats] = useState<PublicStatsData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  // Dữ liệu quản trị: chỉ nạp sau khi đăng nhập và mở tab Quản trị.
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Hộp thoại xác nhận sau khi gửi khảo sát
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    name: string;
    level: "L1" | "L2" | "L3";
  } | null>(null);
```

- [ ] **Step 2: Thay khối `loadFirestoreData` và các effect (dòng cũ 32-121)**

```tsx
  // Theo dõi phiên đăng nhập suốt vòng đời app.
  useEffect(() => onAuthChange((u) => {
    setUser(u);
    setAuthReady(true);
  }), []);

  // Dữ liệu công khai nạp một lần khi mở trang. Trước đây App nạp cả
  // survey_submissions và classes ngay cả với khách chỉ vào điền khảo sát —
  // sau khi siết rules những lệnh đọc đó sẽ bị từ chối.
  useEffect(() => {
    (async () => {
      setPublicLoading(true);
      try {
        const [s, a] = await Promise.all([fetchPublicStats(), fetchAnnouncements()]);
        setStats(s);
        setAnnouncements(a);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu công khai: ", err);
      } finally {
        setPublicLoading(false);
      }
    })();
  }, []);

  const loadAdminData = async () => {
    if (!user) return;
    setAdminLoading(true);
    try {
      const [subs, cls] = await Promise.all([fetchSubmissions(), fetchClasses()]);
      setSubmissions(subs);
      setClasses(cls);

      // Làm mới số liệu trang chủ. Khách vãng lai không có quyền ghi, nên đây
      // là lần duy nhất public_stats được cập nhật — con số trên trang chủ trễ
      // tới lần quản trị viên đăng nhập gần nhất. Đánh đổi có ý thức để khỏi
      // phải dựng Cloud Functions cho một con số mang tính trưng bày.
      if (user.role === "admin") {
        const fresh = computePublicStats(subs);
        await writePublicStats(fresh);
        setStats(fresh);
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu quản trị: ", err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Nạp dữ liệu quản trị khi đã đăng nhập và đang ở tab Quản trị.
  useEffect(() => {
    if (activeTab === "admin" && user) {
      loadAdminData();
    }
  }, [activeTab, user?.uid]);

  const handleSurveySuccess = (name: string, level: "L1" | "L2" | "L3") => {
    setLastSubmissionResult({ name, level });
    setShowSuccessModal(true);
  };

  const handleLoginSuccess = () => {
    setActiveTab("admin");
  };

  const handleLogout = async () => {
    await signOutUser();
    setSubmissions([]);
    setClasses([]);
    setActiveTab("home");
  };
```

- [ ] **Step 3: Đổi `SurveyForm` để truyền tên và cấp độ ra ngoài**

Cách cũ đọc lại toàn bộ collection sau khi gửi chỉ để biết vừa gửi cái gì — vừa thừa một lượt đọc, vừa sẽ bị rules từ chối vì khách không đọc được `survey_submissions`.

Trong `src/components/SurveyForm.tsx`, đổi kiểu prop:

```tsx
interface SurveyFormProps {
  onSuccess: (name: string, level: "L1" | "L2" | "L3") => void;
}
```

Sau lệnh `await createSubmission(submission);`, gọi:

```tsx
onSuccess(submission.studentName, submission.assignedLevel);
```

(Xóa mọi lệnh `onSuccess()` không tham số còn sót lại trong file.)

- [ ] **Step 4: Sửa phần render trong `App.tsx`**

Điều kiện loading ở dòng ~140 đổi từ `loading` sang `publicLoading || !authReady`. Ba khối tab đổi thành:

```tsx
{activeTab === "home" && (
  <HomePortal
    onStartSurvey={() => setActiveTab("survey")}
    stats={stats}
  />
)}

{activeTab === "survey" && (
  <SurveyForm onSuccess={handleSurveySuccess} />
)}

{activeTab === "admin" && (
  user ? (
    adminLoading ? (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-11 h-11 border-[3px] border-brand-sky-deep border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-ink-3">Đang tải dữ liệu quản trị…</p>
      </div>
    ) : (
      <AdminDashboard
        submissions={submissions}
        announcements={announcements}
        classes={classes}
        onRefreshData={loadAdminData}
      />
    )
  ) : (
    <TeacherLogin onSuccess={handleLoginSuccess} />
  )
)}
```

Trong `<Navigation>`, đổi `isAdmin={isAdmin}` thành `isAdmin={!!user}`.

- [ ] **Step 5: Xóa cổng mật khẩu cũ**

```bash
git rm src/lib/auth.ts
```

Trong `.env.example`, xóa cả khối chú thích và dòng `VITE_TEACHER_PASSWORD="hungvuong2026"`.

Kiểm tra không còn chỗ nào tham chiếu:

Run: `grep -rn "lib/auth\"\|checkTeacherPassword\|isTeacherAuthed\|setTeacherAuthed\|clearTeacherAuth\|VITE_TEACHER_PASSWORD" src .env.example`
Expected: không có kết quả

- [ ] **Step 6: Kiểm tra kiểu, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: sạch lỗi, 11 test pass, build thành công

- [ ] **Step 7: Commit**

```bash
git add -A src .env.example
git commit -m "feat: App dung phien Firebase Auth va nap du lieu theo tab

Xoa cong mat khau chung o lib/auth.ts va bien VITE_TEACHER_PASSWORD.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Firestore Security Rules

**Files:**
- Modify: `firestore.rules` (viết lại toàn bộ)
- Create: `docs/van-hanh-firebase.md`

**Interfaces:**
- Consumes: cấu trúc `users/{uid}.role` từ Task 2
- Produces: không có gì cho code

- [ ] **Step 1: Viết lại `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Vai trò đọc từ users/{uid}. Dùng exists() trước get() vì get() trên
    // document không tồn tại sẽ làm cả biểu thức lỗi thay vì trả false.
    function roleOf() {
      return request.auth != null
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        : '';
    }
    function isAdmin() {
      return roleOf() == 'admin';
    }
    function isStaff() {
      return roleOf() == 'admin' || roleOf() == 'teacher';
    }

    // Vai trò chỉ được cấp bằng tay trên Firebase Console. Nếu client ghi
    // được vào đây thì bất kỳ ai cũng tự phong mình làm admin.
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    // Khách vãng lai nộp được phiếu nhưng không đọc được phiếu của người khác.
    match /survey_submissions/{id} {
      allow create: if true;
      allow read: if isStaff();
      allow update, delete: if isAdmin();
    }

    match /announcements/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Chỉ chứa số đã tổng hợp, không có thông tin định danh — an toàn để công khai.
    match /public_stats/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /students/{id} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }

    match /classes/{id} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }

    match /enrollments/{id} {
      allow read: if isStaff();
      allow write: if isAdmin();
    }

    // Giảng viên điểm danh được nhưng không xóa được buổi học.
    match /sessions/{id} {
      allow read: if isStaff();
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }

    // Bất cứ thứ gì chưa khai báo ở trên đều bị từ chối.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Viết `docs/van-hanh-firebase.md`**

```markdown
# Vận hành Firebase

## Cấp tài khoản cho giáo vụ / giảng viên

Thứ tự bắt buộc. Làm ngược sẽ tự khóa mình ra khỏi dữ liệu.

1. Firebase Console → **Authentication** → Sign-in method → bật **Email/Password**.
2. **Authentication → Users → Add user**: tạo tài khoản, ghi lại `uid`.
3. **Firestore → collection `users`**: tạo document có Document ID **đúng bằng `uid`**:
   | Trường | Kiểu | Giá trị |
   |---|---|---|
   | `email` | string | email đăng nhập |
   | `displayName` | string | tên hiển thị |
   | `role` | string | `admin` hoặc `teacher` |
4. **Chỉ sau khi bước 3 xong**: Firestore → Rules → dán nội dung `firestore.rules` → Publish.

## Vai trò

| | admin (giáo vụ) | teacher (giảng viên) |
|---|---|---|
| Đọc phiếu khảo sát, hồ sơ, lớp, ghi danh | có | có |
| Sửa hồ sơ, lớp, ghi danh | có | không |
| Điểm danh (ghi `sessions`) | có | có |
| Xóa buổi học | có | không |
| Đăng/xóa thông báo | có | không |

## Thu hồi quyền

Xóa document `users/{uid}` là đủ — tài khoản vẫn đăng nhập được vào Firebase
nhưng app tự đăng xuất ngay vì không đọc được vai trò. Muốn chặn hẳn thì
disable tài khoản trong Authentication → Users.

## Số liệu trang chủ

`public_stats/summary` được ghi lại mỗi khi một tài khoản `admin` mở tab Quản
trị. Khách vãng lai không có quyền ghi, nên con số trên trang chủ trễ tới lần
đăng nhập quản trị gần nhất. Muốn cập nhật ngay: đăng nhập bằng tài khoản
admin và mở tab Quản trị.
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules docs/van-hanh-firebase.md
git commit -m "feat: siet Firestore rules theo vai tro va them tai lieu van hanh

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Kiểm thử tay trước khi deploy

Chạy `npm run dev` và kiểm tra theo thứ tự. **Lưu ý:** rules mới chưa được publish nên lúc này Firestore vẫn mở — phần kiểm tra quyền chỉ làm được sau khi publish rules.

1. **Khách vãng lai:** mở trang chủ. Khối thống kê hiện số (hoặc ẩn hẳn nếu `public_stats/summary` chưa có). Thông báo hiện bình thường. Console không có lỗi quyền.
2. **Gửi khảo sát:** điền hết và gửi. Hộp thoại xác nhận hiện đúng tên và đúng cấp độ.
3. **Đăng nhập sai:** vào tab Quản trị, nhập email đúng mật khẩu sai → hiện "Email hoặc mật khẩu không đúng.", ô email **vẫn giữ nguyên**, ô mật khẩu bị xóa.
4. **Đăng nhập không có vai trò:** dùng một tài khoản Auth chưa có document `users/{uid}` → hiện "Tài khoản chưa được cấp quyền. Liên hệ quản trị viên."
5. **Đăng nhập đúng:** vào được bảng quản trị, danh sách học viên và lớp hiện đủ.
6. **Giữ phiên:** tải lại trang → vẫn đang đăng nhập, không phải nhập lại.
7. **Đăng xuất:** bấm đăng xuất → về trang chủ, vào lại tab Quản trị thì thấy form đăng nhập.
8. **Sau khi publish rules — tài khoản `teacher`:** đọc được danh sách nhưng thao tác sửa lớp/xóa thông báo bị từ chối (lỗi hiện ở console; xử lý thông báo lỗi tử tế cho người dùng nằm ở GĐ3).

## Deploy

```bash
npm run lint && npm test && npm run build
git push origin main
```

`.github/workflows/deploy.yml` tự build và đẩy lên GitHub Pages. Theo dõi tại tab Actions của repo.

**Sau khi Pages deploy xong**, mới publish `firestore.rules` trên Firebase Console (Firestore → Rules → dán → Publish). Publish rules trước khi code mới lên sẽ làm bản đang chạy hỏng ngay, vì nó chưa biết đăng nhập.
