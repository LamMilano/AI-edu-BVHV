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
