# Ghi công tác giả thiết kế ở footer

Ngày: 2026-08-01

## Mục tiêu

Đánh dấu tác giả đã thiết kế và phát triển cổng đào tạo AI nội bộ, ở mức kín đáo,
không tranh chỗ với danh nghĩa Bệnh viện Đa khoa Hùng Vương.

## Nội dung hiển thị

```
Designed & developed by Nguyen Thanh Lam
```

Nhãn tiếng Anh, tên viết không dấu. Chữ tĩnh — không liên kết, không email, không
hiệu ứng hover.

## Vị trí và trình bày

Footer trong `src/App.tsx` có hai khối: logo kèm slogan bên trái, dòng bản quyền
bên phải. Dòng ghi công là dòng thứ hai trong khối bên phải, ngay dưới dòng `©`:

```
© 2026 Bệnh viện Đa khoa Hùng Vương
Designed & developed by Nguyen Thanh Lam
```

Dòng bản quyền rút gọn, bỏ đuôi "· Đào tạo AI nội bộ" — thông tin đó đã có ở
tiêu đề trang và thẻ mô tả, nhắc lại ở footer chỉ làm loãng hai dòng này.

- Cỡ chữ `11.5px`, nhỏ hơn dòng bản quyền (`12.5px`).
- Màu `text-ink-4` (`#6b7e95`), nhạt hơn một bậc so với `text-ink-3` của dòng
  bản quyền. Dùng token màu sẵn có thay vì đặt opacity tuỳ ý.
- Không thêm class căn lề: khối cha đã có `flex flex-col sm:items-end gap-1.5`,
  nên mobile căn giữa, desktop căn phải, khoảng cách hai dòng đã đúng.

Thứ bậc thị giác kết quả: tên bệnh viện đọc trước, bản quyền thứ hai, ghi công
tác giả sau cùng.

## Phạm vi

Sửa duy nhất khối footer trong `src/App.tsx`. Không thêm component, file cấu
hình, hằng số dùng chung hay dependency — dòng này xuất hiện đúng một lần ở một
nơi, tách trừu tượng chỉ làm khó đọc hơn.

## Phương án đã cân nhắc và loại bỏ

- **Nối vào cùng dòng `©` sau dấu `·`**: gọn hơn nhưng dòng quá dài, xuống dòng
  xấu trên màn hình hẹp.
- **Dải ký tên căn giữa ở đáy footer, ngăn bằng đường kẻ**: nổi hơn mức cần
  thiết cho một cổng nội bộ của bệnh viện, lại tốn thêm chiều cao trang.

## Kiểm chứng

- `npm run build` chạy sạch.
- Xem footer ở khổ hẹp và khổ rộng: hai dòng xếp đúng thứ bậc, không tràn.
