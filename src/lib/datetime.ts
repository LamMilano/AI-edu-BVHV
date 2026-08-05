/* Firestore trả mốc thời gian dưới nhiều dạng tùy lúc đọc: Timestamp đầy đủ khi
   nạp từ máy chủ, nhưng có thể là null trong khoảnh khắc serverTimestamp() chưa
   được máy chủ ghi xong. Mọi chỗ hiển thị thời gian đi qua đây để xử lý đồng
   nhất thay vì đoán kiểu dữ liệu tại chỗ. */

/** Đưa mọi dạng mốc thời gian về Date. Trả null nếu không đọc được. */
export function toDate(value: any): Date | null {
  if (!value) return null;

  // Firestore Timestamp
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Ngày dạng 05/08/2026. Trả "—" khi không có dữ liệu. */
export function formatDateVN(value: any): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Giờ dạng 14:32. Trả chuỗi rỗng khi không có dữ liệu. */
export function formatTimeVN(value: any): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
