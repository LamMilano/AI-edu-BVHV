/* Ô cần bọc khi chứa dấu phẩy (Excel sẽ tách nhầm cột), dấu ngoặc kép
   (phá cú pháp), hoặc xuống dòng (tách nhầm dòng). */
const needsQuote = (v: string) => /[",\n\r]/.test(v);

function escapeCell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const s = value ?? "";
  return needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* Dùng CRLF: đó là dấu xuống dòng Excel trên Windows mong đợi. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\r\n");
}

/* BOM (﻿) là thứ duy nhất khiến Excel trên Windows đọc đúng dấu tiếng
   Việt. Thiếu nó thì "Nguyễn" hiện thành "Nguyá»…n" và cả file thành vô dụng.
   Để nó ở đây chứ không ở toCsv: BOM là chuyện mã hóa file, không phải
   chuyện cú pháp CSV. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
