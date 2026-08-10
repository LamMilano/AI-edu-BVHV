# Quản lý học vụ: hồ sơ học viên, phân lớp, buổi học, điểm danh

Ngày: 2026-08-10

## Vấn đề

Khảo sát đầu vào đã chạy xong và đang thu phiếu. Bước tiếp theo — xếp lớp, theo
dõi học viên, điểm danh — chưa có chỗ bám vì bốn đứt gãy trong hệ thống hiện tại:

1. **"Học viên" chưa tồn tại như một thực thể.** Hệ thống chỉ có
   `survey_submissions`; mỗi phiếu là một dòng, không mã định danh, không chống
   trùng. Ai điền hai lần thì thành hai người.
2. **Lớp và học viên không nối nhau.** `ClassSession.studentsCount`
   (`src/types.ts:46`) là số nhập tay. Không có bảng ghi danh, nên không truy được
   ai học lớp nào.
3. **Chưa có khái niệm buổi học.** Điểm danh cần một trục thời gian để bám vào;
   `ClassSession.schedule` mới chỉ là một chuỗi chữ tự do.
4. **Firestore đang mở toàn bộ.** `firestore.rules` để `allow read, write: if true`
   cho mọi collection; quyền giảng viên chỉ là một mật khẩu chung nhúng trong
   bundle client (`src/lib/auth.ts`). Chấp nhận được với phiếu khảo sát; không chấp
   nhận được khi thêm dữ liệu chuyên cần của nhân viên bệnh viện.

## Phạm vi

Một tài liệu phủ trọn chuỗi: xác thực → hồ sơ học viên → ghi danh/phân lớp →
buổi học → điểm danh → báo cáo chuyên cần. Triển khai chia năm giai đoạn, mỗi
giai đoạn deploy được (mục "Giai đoạn triển khai").

**Ngoài phạm vi:** cổng đăng nhập cho học viên; học viên tự chọn lớp; học viên tự
check-in bằng mã hoặc QR; sinh buổi học tự động theo lịch lặp; màn hình quản lý
tài khoản người dùng (tài khoản tạo tay trên Firebase Console); đồng bộ với hệ
thống nhân sự bệnh viện; chấm điểm/bài tập; cấp chứng nhận.

## Quyết định đã chốt

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Định danh học viên | Tự sinh hồ sơ từ phiếu, khóa = email chuẩn hóa | Không bắt học viên thao tác thêm; email đã thu sẵn ở mọi phiếu |
| Phân lớp | Gợi ý tự động + giáo vụ chốt | Tận dụng dữ liệu lịch rảnh (q10–q12) đã thu; xếp tay 100+ người quá mệt |
| Buổi học | Tạo thủ công từng buổi | Lịch lớp thất thường, không lặp đều theo tuần |
| Điểm danh | Giảng viên tick trên màn hình lớp | Học viên chưa có tài khoản; không phải xây cổng học viên |
| Bảo mật | Firebase Auth + siết rules | Dữ liệu chuyên cần là dữ liệu nhân sự nội bộ |
| Lưu điểm danh | Nhúng trong document buổi học | Một buổi = một lượt ghi; quy mô vài trăm học viên không cần bảng riêng |

### Vì sao nhúng điểm danh vào buổi học

Ba cách được cân nhắc:

| Cách | Ghi một buổi | Báo cáo chuyên cần một học viên |
|---|---|---|
| **Nhúng vào `sessions.records`** (chọn) | 1 lượt ghi | đọc toàn bộ buổi (~50 document) |
| Bảng `attendance` riêng | ~30 lượt ghi | 1 truy vấn |
| Subcollection lồng 3 tầng | ~30 lượt ghi | cần `collectionGroup` + index |

Quy mô dự kiến: vài trăm học viên, lớp 20–40 người, mỗi lớp khoảng chục buổi.
Ở quy mô này việc đọc vài chục document cho một báo cáo là không đáng kể, trong
khi lợi ích của cách nhúng rất rõ: giảng viên tick xong bấm lưu là một lượt ghi
nguyên tử, không có trạng thái "lưu dở nửa lớp". Bảng riêng chỉ đáng khi số buổi
lên hàng nghìn.

Ghi danh thì ngược lại — tách bảng riêng — vì phân lớp cần sửa đi sửa lại, cần
giữ lịch sử chuyển lớp, và cần truy vấn ngược "học viên này đang ở lớp nào".

## Mô hình dữ liệu

Năm collection mới/mở rộng. `survey_submissions` giữ nguyên, không đụng vào.

### `students`

Khóa document = email đã chuẩn hóa (chữ thường, bỏ khoảng trắng hai đầu). Firestore
không cho phép ký tự `/` trong document ID; email không chứa `/` nên dùng trực tiếp
được, không cần mã hóa.

```ts
interface Student {
  id?: string;                  // = email chuẩn hóa
  email: string;                // bản gốc như học viên gõ
  fullName: string;
  department: string;
  phone: string;
  currentLevel: "L1" | "L2" | "L3";   // cấp độ chốt; khởi tạo = assignedLevel của phiếu
  latestSubmissionId: string;         // trỏ về phiếu mới nhất
  submissionCount: number;            // >1 nghĩa là đã làm lại khảo sát
  availability: {
    timeframes: string[];       // từ q10_timeframe
    days: string[];             // từ q11_days
    duration: string;           // từ q12_duration
  };
  notDuplicateOf: string[];     // các studentId đã được giáo vụ xác nhận "không trùng"
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `classes` (mở rộng `ClassSession` hiện có)

```ts
interface ClassRecord {
  id?: string;
  level: "L1" | "L2" | "L3";
  name: string;
  instructor: string;
  room: string;
  capacity: number;             // thay studentsCount
  plannedSchedule: {            // thay schedule (chuỗi chữ)
    days: string[];             // ["T3", "T5"]
    timeframe: string;          // "Sáng" | "Chiều" | "Tối"
    duration: string;           // "90 phút" | "120 phút"
  };
  status: "planning" | "active" | "closed";   // bảng xếp lớp chỉ hiện planning và active
  enrolledCount: number;        // phi chuẩn hóa; cập nhật khi ghi danh
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

`plannedSchedule` là **khung lịch dự kiến**, chỉ dùng để so khớp với lịch rảnh của
học viên và để hiển thị. Nó **không** sinh ra buổi học — buổi học tạo thủ công.

`enrolledCount` là số phi chuẩn hóa, có thể lệch nếu ghi lỗi. Nguồn sự thật là số
document `enrollments` có `status == "enrolled"`. Màn quản trị hiển thị cảnh báo khi
hai con số lệch nhau, kèm nút tính lại.

### `enrollments`

Khóa document = `{classId}_{studentId}`, khiến ghi danh trùng là bất khả thi ở tầng
lưu trữ chứ không phải chỉ ở tầng giao diện.

```ts
interface Enrollment {
  id?: string;                  // = `${classId}_${studentId}`
  classId: string;
  studentId: string;
  level: "L1" | "L2" | "L3";    // chép lại để lọc không cần join
  status: "enrolled" | "transferred" | "dropped";
  matchScore: number | null;    // null khi giáo vụ xếp tay
  matchReason: string | null;   // "Khớp T3, T5 · buổi Tối · lớp còn 6 chỗ"
  enrolledAt: Timestamp;
  enrolledBy: string;           // uid người thao tác
}
```

### `sessions`

```ts
type AttendanceStatus = "present" | "late" | "excused" | "absent";

interface Session {
  id?: string;
  classId: string;
  date: string;                 // "2026-08-20" (ISO, sắp xếp được bằng chuỗi)
  startTime: string;            // "18:00"
  durationMin: number;
  topic: string;
  status: "scheduled" | "done" | "cancelled";
  records: Record<string, AttendanceStatus>;   // studentId → trạng thái
  note: string;
  takenBy: string | null;       // uid người điểm danh
  takenAt: Timestamp | null;
  createdAt: Timestamp;
}
```

### `users`

```ts
interface UserProfile {
  id?: string;                  // = Firebase Auth uid
  email: string;
  displayName: string;
  role: "admin" | "teacher";
}
```

Tạo tay trên Firebase Console. Client không bao giờ ghi vào collection này.

### `public_stats/summary`

Một document duy nhất, đọc công khai:

```ts
interface PublicStats {
  totalStudents: number;
  byLevel: { L1: number; L2: number; L3: number };
  updatedAt: Timestamp;
}
```

### Ba ràng buộc bất biến

1. **`students` là bản chiếu, không phải bản gốc.** `survey_submissions` vẫn là
   nguồn sự thật cho câu trả lời khảo sát; `students` chỉ giữ phần cần cho vận hành.
   Sửa hồ sơ học viên không ghi ngược vào phiếu.
2. **Một cấp độ, một lớp.** Học viên có thể ghi danh nhiều lớp **khác cấp độ** (học
   xong L1 lên L2), nhưng chỉ được **một** enrollment `status == "enrolled"` trong
   cùng một cấp độ tại một thời điểm. Chuyển lớp = bản ghi cũ đổi sang
   `transferred`, tạo bản ghi mới. Ràng buộc này kiểm tra ở tầng ứng dụng trước khi
   ghi (rules không biểu diễn được kiểu ràng buộc chéo-document này).
3. **Điểm danh không hồi tố.** `records` chỉ chứa học viên đang `enrolled` tại thời
   điểm điểm danh. Người ghi danh muộn không bị tính vắng các buổi trước; báo cáo
   chuyên cần tính mẫu số theo số buổi kể từ ngày ghi danh.

## Kiến trúc code

`src/components/AdminDashboard.tsx` hiện 728 dòng cho ba tab. Thêm ba hệ nữa vào
cùng file sẽ đưa nó lên khoảng 2000 dòng — quá lớn để sửa an toàn. Tách theo tính
năng:

```
src/
  lib/
    repo/                # tầng truy cập dữ liệu, mỗi file một collection
      students.ts
      classes.ts
      enrollments.ts
      sessions.ts
      publicStats.ts
    matching.ts          # chấm điểm khớp lớp — hàm thuần, không chạm Firestore
    migrate.ts           # chuyển đổi dữ liệu cũ, chạy một lần
    authz.ts             # Firebase Auth + đọc vai trò (thay auth.ts cũ)
  features/
    students/
      StudentList.tsx  StudentDetail.tsx  DuplicateReview.tsx
    classes/
      ClassList.tsx  ClassForm.tsx  AssignmentBoard.tsx
    attendance/
      SessionList.tsx  SessionForm.tsx  AttendanceSheet.tsx  AttendanceReport.tsx
```

Quy tắc ranh giới:

- Component **không** viết truy vấn Firestore. Mọi lần đọc/ghi đi qua `lib/repo/*`.
  Hiện tại truy vấn nằm rải rác ở `App.tsx` và `AdminDashboard.tsx`; gom lại khiến
  việc siết quyền và xử lý lỗi có một chỗ duy nhất để sửa.
- `matching.ts` nhận vào một học viên và một danh sách lớp, trả về danh sách điểm
  khớp. Không phụ thuộc React, không phụ thuộc Firestore, nên test được trực tiếp.
- `AdminDashboard.tsx` co lại thành khung tab mỏng, mỗi tab render một component
  trong `features/`.
- Component dùng chung hiện có (`StudentFilterBar`, `StudentStats`,
  `DepartmentField`) giữ nguyên vị trí và được tái sử dụng.

`src/App.tsx:33` hiện nạp toàn bộ collection ngay khi mở trang, kể cả với khách vãng
lai chỉ vào điền khảo sát. Sau khi siết rules, các lệnh đọc đó sẽ lỗi quyền. Đổi
thành nạp theo tab: trang chủ đọc `public_stats` và `announcements`; dữ liệu quản
trị nạp khi vào tab tương ứng.

## Xác thực và phân quyền

Firebase Auth email/mật khẩu. Vai trò đọc từ `users/{uid}.role`, không dùng custom
claims — claims cần Cloud Functions hoặc Admin SDK, quá nặng so với nhu cầu vài tài
khoản.

| Collection | Khách vãng lai | teacher | admin |
|---|---|---|---|
| `survey_submissions` | chỉ **create** | read | toàn quyền |
| `announcements` | read | read | toàn quyền |
| `public_stats` | read | read | write |
| `students` | — | read | toàn quyền |
| `classes` | — | read | toàn quyền |
| `enrollments` | — | read | toàn quyền |
| `sessions` | — | read + create/update | toàn quyền |
| `users` | — | read chính mình | read chính mình |

Không ai ghi được `users` từ client.

`public_stats` chỉ cho `admin` ghi, nhưng nó cần được cập nhật khi **khách vãng lai**
nộp phiếu — mà khách không có quyền ghi. Giải pháp trong phạm vi client-only:
`public_stats` được tính lại mỗi khi một tài khoản quản trị mở trang quản trị. Con số
trên trang chủ do đó trễ tới lần đăng nhập quản trị gần nhất, không phải thời gian
thực. Đây là đánh đổi có ý thức để tránh phải dựng Cloud Functions cho một con số
mang tính trưng bày.

Thay đổi kéo theo:

- Xoá `src/lib/auth.ts` và biến môi trường `VITE_TEACHER_PASSWORD` (kể cả dòng mô tả
  trong `.env.example`).
- `TeacherLogin.tsx` đổi từ ô mật khẩu chung sang form email + mật khẩu, có xử lý
  các mã lỗi Firebase Auth thường gặp (sai mật khẩu, không tồn tại tài khoản, quá
  nhiều lần thử).
- Trang chủ (`HomePortal.tsx`) đổi nguồn thống kê từ `submissions` sang
  `public_stats`. Khi chưa có document `public_stats/summary`, khối thống kê ẩn đi
  thay vì hiển thị số 0.

## Màn hình

Tab quản trị: **Học viên · Phân lớp · Lớp & Buổi học · Điểm danh · Báo cáo ·
Thông báo**.

### Học viên

Danh sách hồ sơ, tái sử dụng `StudentFilterBar` và `StudentStats` hiện có. Bấm một
dòng mở phiếu chi tiết (dùng lại phần hiển thị đáp án đã có trong
`AdminDashboard.tsx`), bổ sung: lớp đang học, lịch sử ghi danh, tỉ lệ chuyên cần.

Tab con **Nghi trùng**: liệt kê các nhóm hồ sơ cùng họ tên và cùng khoa/phòng nhưng
khác email. Mỗi nhóm cho hai hành động — Gộp (chọn hồ sơ giữ lại; enrollment và
`records` của hồ sơ bị gộp được trỏ sang hồ sơ giữ lại) hoặc Đánh dấu không trùng
(ghi vào `students.notDuplicateOf: string[]` để lần sau không hỏi lại).

### Phân lớp (bảng xếp lớp)

Hai cột. Trái: học viên chưa có enrollment `enrolled` ở cấp độ đang chọn. Phải: các
lớp cùng cấp độ kèm số chỗ còn lại.

Nút **Xếp tự động** điền đề xuất ở dạng **nháp** — hiển thị viền đứt, màu khác hẳn
với ghi danh đã lưu. Giáo vụ sửa từng người, rồi bấm **Lưu tất cả**. Không có gì
được ghi vào Firestore cho tới lúc bấm lưu; sai thì tải lại trang là mất hết bản
nháp.

Cách chấm điểm khớp (`lib/matching.ts`):

- Cấp độ không khớp → loại thẳng, không tính điểm.
- Lớp đã đầy (`enrolledCount >= capacity`) → loại thẳng.
- Điểm = 50 × (số thứ trùng / số thứ học viên rảnh) + 35 × (buổi trùng: 1 hoặc 0)
  + 15 × (thời lượng trùng: 1 hoặc 0).
- Trừ 10 điểm khi lớp còn dưới 20% chỗ, để rải học viên đều giữa các lớp thay vì
  dồn vào lớp khớp nhất.
- Học viên thiếu dữ liệu lịch rảnh (phiếu cũ, câu hỏi bỏ trống) → điểm 0 kèm lý do
  "Chưa có dữ liệu lịch rảnh", vẫn xếp được nhưng xếp sau cùng.

Mỗi đề xuất hiển thị `%` kèm một dòng lý do đọc được, ví dụ
*"Khớp T3, T5 · buổi Tối · lớp còn 6 chỗ"*. Lý do được lưu vào
`enrollments.matchReason` để sau này còn truy được vì sao xếp như vậy.

### Lớp & Buổi học

Danh sách lớp với form thêm/sửa (mở rộng từ form hiện có, thay ô lịch dạng chữ bằng
các ô chọn thứ/buổi/thời lượng). Mỗi lớp có danh sách buổi kèm nút **Thêm buổi**
(ngày, giờ bắt đầu, thời lượng, chủ đề). Buổi hoãn đánh dấu `cancelled` thay vì xoá,
để báo cáo chuyên cần không tính vào mẫu số.

### Điểm danh

Tối ưu cho điện thoại — giảng viên dùng khi đang đứng lớp.

Chọn buổi → danh sách học viên đang `enrolled` của lớp đó, **mặc định tất cả "Có
mặt"**, giảng viên chỉ chạm để sửa ngoại lệ (Muộn / Vắng có phép / Vắng). Hàng cao
tối thiểu 56px, vùng chạm rộng. Có ô ghi chú chung cho buổi.

Bấm Lưu → một lượt ghi, đổi `status` sang `done`, ghi `takenBy` và `takenAt`. Mở lại
buổi đã điểm danh thì sửa được; lưu lại cập nhật `takenAt`.

### Báo cáo

- **Theo lớp:** bảng chéo buổi × học viên, ô màu theo trạng thái, cột cuối là %
  chuyên cần. Mẫu số = số buổi `done` kể từ ngày học viên ghi danh.
- **Theo học viên:** danh sách buổi đã tham gia trên tổng số.
- **Cảnh báo:** đánh dấu học viên vắng (`absent`) từ 2 buổi liên tiếp trở lên.
- **Xuất CSV** cho cả hai loại báo cáo, mã hóa UTF-8 có BOM để Excel đọc đúng tiếng
  Việt.

## Xử lý lỗi

| Tình huống | Cách xử lý |
|---|---|
| Mất mạng khi lưu điểm danh | Giữ nguyên mọi thao tác đã tick trên màn hình, hiện thông báo lỗi kèm nút "Thử lại". Không bao giờ xoá thao tác của người dùng. |
| Hai người cùng điểm danh một buổi | Ghi bằng transaction, so `takenAt` đọc được với `takenAt` hiện tại. Lệch thì hiện cảnh báo "Buổi này vừa được lưu lúc HH:MM. Tải lại?" thay vì âm thầm ghi đè. |
| Email trùng nhưng khác người | Màn Nghi trùng, giáo vụ quyết định gộp hay đánh dấu không trùng. |
| Học viên nộp phiếu lần hai | Cập nhật hồ sơ theo phiếu mới, tăng `submissionCount`, cập nhật `latestSubmissionId`. **Không** đổi `currentLevel` nếu học viên đã có enrollment `enrolled` — đổi cấp độ khi đang học là quyết định của giáo vụ, không phải của hệ thống. |
| `enrolledCount` lệch số enrollment thật | Hiện cảnh báo trên màn lớp kèm nút tính lại. |
| Lỗi quyền (rules từ chối) | Thông báo rõ "Bạn không có quyền thao tác này", không hiện lỗi Firebase thô. |

## Chuyển đổi dữ liệu

`src/lib/migrate.ts`, gọi tay từ màn quản trị qua nút có hộp xác nhận. Chạy lại
nhiều lần không được nhân đôi dữ liệu (idempotent).

1. Duyệt toàn bộ `survey_submissions`, sinh `students` với khóa = email chuẩn hóa.
   Phiếu trùng email → giữ phiếu có `submittedAt` mới nhất, `submissionCount` = số
   phiếu.
2. Phiếu thiếu `submittedAt` (dữ liệu cũ) vẫn phải được xử lý — không dùng
   `orderBy("submittedAt")` trong truy vấn vì Firestore loại bỏ document thiếu
   trường được sắp xếp. Sắp xếp trong bộ nhớ sau khi đọc.
3. Chuyển `classes`: `schedule` (chuỗi) → `plannedSchedule` bằng cách dò các mẫu
   "T2".."T7" và "Sáng/Chiều/Tối" trong chuỗi; không dò được thì để mảng rỗng và
   đánh dấu lớp cần giáo vụ khai lại. `studentsCount` → `capacity`.
4. Tạo `public_stats/summary` lần đầu.

Báo cáo kết quả sau khi chạy: số hồ sơ tạo mới, số hồ sơ gộp, số lớp cần khai lại
lịch.

## Kiểm thử

Dự án hiện chưa có framework test. Thêm Vitest và **chỉ** viết test tự động cho các
hàm thuần — nơi lỗi âm thầm làm hỏng dữ liệu và nơi test chạy được không cần
Firestore:

- `lib/matching.ts`: khớp hoàn toàn, khớp một phần, lệch cấp độ, lớp đầy, học viên
  thiếu dữ liệu lịch rảnh, phạt lớp gần đầy.
- Chuẩn hóa email và phát hiện trùng: hoa/thường, khoảng trắng thừa, cùng tên khác
  email.
- Tính % chuyên cần: học viên ghi danh muộn, buổi `cancelled` không vào mẫu số, lớp
  chưa có buổi nào `done`.
- Sinh CSV: dấu tiếng Việt, dấu phẩy trong tên khoa/phòng.

Phần giao diện kiểm thử tay theo kịch bản, ghi rõ trong plan triển khai của từng
giai đoạn.

## Giai đoạn triển khai

Mỗi giai đoạn deploy được độc lập.

**GĐ1 — Xác thực và phân quyền.** Firebase Auth, `users`, `authz.ts`, rules mới,
`public_stats`, đổi `TeacherLogin`, đổi nguồn thống kê trang chủ, tách tầng `repo/`
cho các collection hiện có, đổi `App.tsx` sang nạp theo tab. Làm trước vì mọi thứ
sau đều đọc/ghi qua tầng này — làm sau thì phải sửa lại toàn bộ.

**GĐ2 — Hồ sơ học viên.** `students`, `repo/students.ts`, `migrate.ts`, màn Học viên
và Nghi trùng.

**GĐ3 — Phân lớp.** Mở rộng `classes`, thêm `enrollments`, `matching.ts`, bảng xếp
lớp.

**GĐ4 — Buổi học và điểm danh.** `sessions`, màn Lớp & Buổi học, màn Điểm danh.

**GĐ5 — Báo cáo.** Báo cáo theo lớp, theo học viên, cảnh báo vắng liên tiếp, xuất
CSV.

## Deploy

`.github/workflows/deploy.yml` đã tự build và đẩy lên GitHub Pages mỗi khi push
`main`. Không cần thêm secret: cấu hình Firebase nằm trong
`firebase-applet-config.json` và không phải bí mật — bảo vệ nằm ở Security Rules.

Việc cần làm tay ngoài code, trước khi GĐ1 lên production:

1. Bật Email/Password provider trong Firebase Console → Authentication.
2. Tạo tài khoản cho giáo vụ và giảng viên.
3. Tạo document `users/{uid}` tương ứng với `role` đúng cho từng tài khoản.
4. Triển khai `firestore.rules` mới.

Thứ tự quan trọng: rules mới phải lên **sau** khi tài khoản đã tạo xong, nếu không
sẽ tự khóa mình ra khỏi dữ liệu.
