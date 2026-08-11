# Vận hành Firebase

## ⚠️ App KHÔNG dùng database `(default)`

```
projectId          : axial-sunup-465910-b7
firestoreDatabaseId: ai-studio-cngqunlotoai-90934615-7f54-44f1-81e9-815e416cedd2
```

Giá trị này nằm ở `firebase-applet-config.json` và là database **duy nhất** app đọc/ghi.

Firebase Console mặc định mở database `(default)`. Trang Firestore có ô chọn
database ở đầu trang — **phải đổi sang đúng database trên** trước khi làm bất
cứ việc gì dưới đây. Tạo `users/{uid}` hay publish rules nhầm sang `(default)`
sẽ khiến app không thấy gì cả: đăng nhập được vào Firebase nhưng lập tức bị
đăng xuất vì không đọc được vai trò.

Muốn kiểm chứng nhanh document nằm ở database nào, chạy script chẩn đoán ở gốc
dự án — nó thử đọc trên cả hai database và nói rõ document nằm ở đâu:

```bash
FB_EMAIL=... FB_PASSWORD=... node diag-auth.mjs
```

## Cấp tài khoản cho giáo vụ / giảng viên

Thứ tự bắt buộc. Làm ngược sẽ tự khóa mình ra khỏi dữ liệu.

1. Firebase Console → **Authentication** → Sign-in method → bật **Email/Password**.
   (Authentication dùng chung cho cả project, không phân theo database.)
2. **Authentication → Users → Add user**: tạo tài khoản, ghi lại `uid`.
3. **Firestore → chọn đúng database `ai-studio-…` → collection `users`**: tạo
   document có Document ID **đúng bằng `uid`**:

   | Trường | Kiểu | Giá trị |
   |---|---|---|
   | `email` | string | email đăng nhập |
   | `displayName` | string | tên hiển thị |
   | `role` | string | `admin` hoặc `teacher` |

   `role` phải đúng chữ thường, không khoảng trắng thừa.

4. **Chỉ sau khi bước 3 xong**: Firestore → **vẫn ở database đó** → Rules →
   dán nội dung `firestore.rules` → Publish.

## Vai trò

| | admin (giáo vụ) | teacher (giảng viên) |
|---|---|---|
| Đọc phiếu khảo sát, hồ sơ, lớp, ghi danh | có | có |
| Sửa hồ sơ, lớp, ghi danh | có | không |
| Điểm danh (ghi `sessions`) | có | có |
| Xóa buổi học | có | không |
| Đăng/xóa thông báo | có | không |
| Ghi `public_stats` | có | không |

Khách vãng lai (không đăng nhập) chỉ làm được hai việc: **gửi phiếu khảo sát**
và **đọc thông báo + số liệu tổng hợp** trên trang chủ.

## Thu hồi quyền

Xóa document `users/{uid}` là đủ — tài khoản vẫn đăng nhập được vào Firebase
nhưng app tự đăng xuất ngay vì không đọc được vai trò. Muốn chặn hẳn thì
disable tài khoản trong Authentication → Users.

## Số liệu trang chủ

`public_stats/summary` được ghi lại mỗi khi một tài khoản `admin` mở tab Quản
trị. Khách vãng lai không có quyền ghi, nên con số trên trang chủ trễ tới lần
đăng nhập quản trị gần nhất. Muốn cập nhật ngay: đăng nhập bằng tài khoản
admin và mở tab Quản trị.

Lần đầu tiên, khi document chưa tồn tại, khối "Thông tin học viên" trên trang
chủ sẽ ẩn hẳn — cố ý, để không hiện một dãy số 0.

## Thứ tự khi deploy

1. Tạo tài khoản + document `users/{uid}` (mục trên).
2. Push code lên `main`, đợi GitHub Actions deploy xong.
3. Publish `firestore.rules`.

Publish rules **trước** khi code mới lên sẽ làm bản đang chạy hỏng ngay, vì bản
cũ chưa biết đăng nhập.
