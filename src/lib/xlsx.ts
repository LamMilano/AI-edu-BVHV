/* Ghi file .xlsx cho trình duyệt.
 *
 *  CSV vẫn dùng cho báo cáo chuyên cần (lib/csv.ts). Danh sách học viên đi
 *  đường Excel vì nó rộng hơn hai chục cột và chứa câu trả lời tự do có dấu
 *  phẩy lẫn xuống dòng — thứ mà CSV chỉ chịu đựng được chứ không xử lý đẹp. */

/** Một ô trong sheet, theo mô tả của write-excel-file. null = ô trống. */
export type SheetCell = {
  value: string | number;
  type: StringConstructor | NumberConstructor;
  fontWeight?: "bold";
  backgroundColor?: string;
  color?: string;
  align?: "left" | "center" | "right";
  wrap?: boolean;
} | null;

const HEADER_BG = "#EAF1F8";
const HEADER_FG = "#274E7A";

/** Dàn tiêu đề + các dòng thành ma trận ô mà write-excel-file hiểu được.
 *
 *  Tách khỏi hàm tải file để phần quyết định kiểu dữ liệu — thứ quyết định
 *  Excel có tính được cột điểm hay không — kiểm thử được mà không cần trình
 *  duyệt. */
export function toSheetData(
  header: string[],
  rows: (string | number)[][]
): SheetCell[][] {
  const headerRow: SheetCell[] = header.map(h => ({
    value: h,
    type: String,
    fontWeight: "bold",
    backgroundColor: HEADER_BG,
    color: HEADER_FG,
    align: "center",
    wrap: true,
  }));

  const body: SheetCell[][] = rows.map(row =>
    row.map(v => {
      if (typeof v === "number") return { value: v, type: Number };
      /* Chuỗi rỗng phải thành ô trống thật: ô trống thì Excel lọc "(Blanks)"
         và COUNTA bỏ qua, còn chuỗi rỗng thì bị đếm như có dữ liệu. */
      return v ? { value: String(v), type: String } : null;
    })
  );

  return [headerRow, ...body];
}

export interface XlsxDownload {
  fileName: string;
  sheetName: string;
  header: string[];
  rows: (string | number)[][];
  /** Độ rộng từng cột, tính theo ký tự. Thiếu thì để Excel tự co. */
  columnWidths?: number[];
}

/** Dựng file .xlsx rồi kích hoạt tải xuống.
 *
 *  Thư viện nạp bằng import động: người dùng chỉ tải nó khi thực sự bấm xuất,
 *  chứ không nằm trong gói chính mà mọi khách vào trang chủ đều phải tải. */
export async function downloadXlsx(opts: XlsxDownload): Promise<void> {
  /* Phải là nhánh /browser: gói này không khai "." trong exports, và nhánh
     /node ghi ra đĩa bằng fs thay vì bật hộp thoại tải xuống. */
  const writeXlsxFile = (await import("write-excel-file/browser")).default;

  /* Từ v4, hàm này trả về đối tượng có toFile()/toBlob() chứ không tự tải
     file theo tùy chọn fileName nữa. */
  await writeXlsxFile(toSheetData(opts.header, opts.rows), {
    sheet: opts.sheetName,
    columns: opts.columnWidths?.map(width => ({ width })),
    /* Đóng băng dòng tiêu đề: cuộn tới cột "12. Thời lượng" mà vẫn biết mình
       đang đọc cột nào. */
    stickyRowsCount: 1,
  }).toFile(opts.fileName);
}
