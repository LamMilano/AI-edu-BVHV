# Danh sách học viên: cột STT, cột Thời gian đăng ký, bộ lọc

Ngày: 2026-08-05

## Vấn đề

Bảng học viên trong tab Quản trị giáo vụ (`src/components/AdminDashboard.tsx`) hiện chỉ
có ô tìm kiếm và bộ lọc cấp độ. Ba thiếu sót:

1. Không đánh số dòng — khó đối chiếu khi đọc hoặc in danh sách.
2. Không hiển thị thời gian đăng ký, dù dữ liệu đã có sẵn.
3. Danh sách xuất hiện theo thứ tự Firestore trả về (thứ tự document ID), không
   phải thứ tự đăng ký, nên không biết ai mới nộp phiếu.

## Phạm vi

Thêm cột STT, cột Thời gian đăng ký, bộ lọc theo khoa/phòng, bộ lọc theo khoảng
thời gian đăng ký, và ô sắp xếp. Chỉ tác động tới tab Học viên.

Ngoài phạm vi: bỏ dấu tiếng Việt khi tìm kiếm, xuất Excel, phân trang, thêm
framework test.

## Dữ liệu

`submittedAt` (Firestore Timestamp) đã được ghi cho mọi phiếu tại
`src/components/SurveyForm.tsx:446`. Không cần đổi cấu trúc dữ liệu.

**Không thêm `orderBy("submittedAt")` vào truy vấn Firestore** ở `src/App.tsx:61`.
Firestore loại bỏ khỏi kết quả mọi document thiếu trường được `orderBy` — nếu tồn
tại phiếu cũ thiếu `submittedAt`, phiếu đó sẽ biến mất khỏi danh sách mà không
báo lỗi. Sắp xếp thực hiện phía client; số lượng phiếu ở quy mô nội bộ bệnh viện
không cần sắp xếp phía máy chủ.

## Kiến trúc

Bốn đơn vị, mỗi đơn vị một trách nhiệm:

| File | Trách nhiệm |
|---|---|
| `src/lib/datetime.ts` (mới) | Đọc và định dạng Firestore Timestamp |
| `src/hooks/useStudentFilters.ts` (mới) | Trạng thái lọc/sắp xếp và phép lọc thuần túy |
| `src/components/StudentFilterBar.tsx` (mới) | Giao diện thanh lọc |
| `src/components/AdminDashboard.tsx` (sửa) | Ghép hook vào bảng, thêm 2 cột |

### `src/lib/datetime.ts`

- `toDate(value): Date | null` — nhận Firestore Timestamp (`.toDate()` hoặc
  `.seconds`), `Date`, số, chuỗi; trả `null` khi không đọc được.
- `formatDateVN(value): string` — `"05/08/2026"`, trả `"—"` khi `null`.
- `formatTimeVN(value): string` — `"14:32"`, trả `""` khi `null`.

### `src/hooks/useStudentFilters.ts`

Nhận `submissions: SurveySubmission[]`.

Trạng thái:

- `searchTerm: string`
- `levelFilter: "ALL" | "L1" | "L2" | "L3"`
- `departmentFilter: string` (`"ALL"` hoặc tên khoa)
- `datePreset: "ALL" | "TODAY" | "D7" | "D30" | "CUSTOM"`
- `customFrom: string`, `customTo: string` (dạng `yyyy-mm-dd` của `<input type="date">`)
- `sortKey: "TIME_DESC" | "TIME_ASC" | "SCORE_DESC" | "SCORE_ASC" | "NAME_ASC"`

Trả về: `filtered` (đã lọc và sắp xếp), `departments` (danh sách khoa duy nhất),
`totalCount`, `visibleCount`, `isFiltered`, `dateRangeError`, các setter, và `resetAll()`.

Quy tắc:

- Thứ tự xử lý: lọc → sắp xếp. STT gán lúc render (`index + 1`), không nằm trong hook.
- Mặc định `sortKey = "TIME_DESC"` (mới nhất trước).
- `TODAY`: từ 00:00 hôm nay đến hiện tại. `D7`/`D30`: từ 00:00 của 7/30 ngày
  trước đến hết hôm nay. `CUSTOM`: từ 00:00 ngày `customFrom` đến 23:59:59 ngày
  `customTo`; nếu chỉ điền một đầu thì lọc một chiều.
- `customFrom > customTo` → không áp dụng lọc thời gian, đặt `dateRangeError`.
- Phiếu thiếu `submittedAt`: bị loại khi `datePreset !== "ALL"`; luôn xếp cuối ở
  cả `TIME_DESC` và `TIME_ASC`.
- `departments`: rút từ dữ liệu, bỏ chuỗi rỗng, sắp bằng `localeCompare("vi")`.
- Nếu `departmentFilter` không còn trong `departments` (học viên cuối của khoa đó
  bị xóa) → tự quay về `"ALL"`.
- `NAME_ASC` dùng `localeCompare("vi")`.

### `src/components/StudentFilterBar.tsx`

Nhận toàn bộ trạng thái và setter từ hook qua props. Không tự giữ trạng thái.

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔍 Tìm theo tên hoặc khoa…            [Tất cả][C1][C2][C3]       │
├──────────────────────────────────────────────────────────────────┤
│ [Tất cả khoa ▾]  [Tất cả][Hôm nay][7 ngày][30 ngày][Tùy chọn]    │
│ [Mới nhất trước ▾]                      Hiển thị 12/47 · Xóa lọc │
└──────────────────────────────────────────────────────────────────┘
```

- Hàng 1 giữ nguyên giao diện hiện có (ô tìm kiếm + nút gạt cấp độ).
- Hai ô `<input type="date">` chỉ hiện thêm một dòng khi `datePreset === "CUSTOM"`.
- Số đếm và nút *Xóa lọc* chỉ hiện khi `isFiltered`.
- Ô sắp xếp: Mới nhất trước · Cũ nhất trước · Điểm cao→thấp · Điểm thấp→cao · Tên A→Z.
- Dùng lại class có sẵn: `field` cho ô nhập, nhóm nút gạt theo đúng style bộ lọc
  cấp độ hiện tại.

### Bảng trong `AdminDashboard.tsx`

Từ 6 lên 8 cột:

| STT | Học viên | Khoa / Phòng | Điểm số | Xếp lớp đề xuất | Thời gian đăng ký | Liên hệ | Thao tác |

- STT: cột hẹp, `tnum`, màu `text-ink-4`.
- Thời gian đăng ký: hai dòng (ngày, rồi giờ nhỏ hơn) theo đúng cách cột *Liên hệ*
  xếp số điện thoại và email.
- `colSpan` của dòng trống đổi từ 6 thành 8; nội dung đổi thành thông báo không
  khớp bộ lọc kèm nút xóa lọc.
- Bảng đã bọc `overflow-x-auto` nên hai cột thêm không làm vỡ layout.

## Kiểm chứng

Repo không có framework test (`package.json` chỉ có `lint: tsc --noEmit`), và việc
thêm framework nằm ngoài phạm vi.

- `npm run lint` không lỗi.
- Kiểm tra thủ công trên `npm run dev`: mỗi bộ lọc riêng lẻ, hai bộ lọc kết hợp,
  từng kiểu sắp xếp, STT đánh lại đúng sau khi lọc, dòng trống, nút Xóa lọc.

## Triển khai

Đẩy lên `main` — workflow `.github/workflows/deploy.yml` tự build và deploy lên
GitHub Pages.
