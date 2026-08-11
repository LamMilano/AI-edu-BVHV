import {
  Session, Enrollment, Student, AttendanceStatus,
  StudentAttendanceRow, ClassAttendanceReport,
} from "../types";

/* Chỉ "absent" nối chuỗi. "excused" làm đứt vì xin phép không phải dấu hiệu
   bỏ học — đây là cảnh báo để giáo vụ gọi điện hỏi thăm, không phải hình phạt.
   Buổi học viên chưa ghi danh (null) bị bỏ qua hẳn, không làm đứt chuỗi. */
export function maxAbsentStreak(statuses: (AttendanceStatus | null)[]): number {
  let best = 0;
  let run = 0;
  for (const s of statuses) {
    if (s === null || s === undefined) continue;
    if (s === "absent") {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/* Tính chuyên cần của một lớp.

   Bốn quy tắc, đều hiển thị lại cho người đọc báo cáo ở giao diện:
   - Buổi chưa diễn ra và buổi hoãn KHÔNG vào mẫu số.
   - "Vắng có phép" nằm ngoài cả tử lẫn mẫu: không thưởng, cũng không phạt.
   - "Muộn" tính là có tham gia.
   - Học viên ghi danh muộn tự có mẫu số nhỏ hơn mà không cần so ngày:
     buildAttendanceRecords chỉ đưa người đang ghi danh vào records, nên buổi
     trước khi họ vào lớp đơn giản là không có tên họ. */
export function buildClassReport(args: {
  classId: string;
  sessions: Session[];
  enrollments: Enrollment[];
  students: Student[];
}): ClassAttendanceReport {
  const { classId, sessions, enrollments, students } = args;

  const counted = sessions
    .filter(s => s.classId === classId && s.status === "done")
    .sort((a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      (a.startTime || "").localeCompare(b.startTime || "")
    );

  const members = enrollments.filter(e => e.classId === classId && e.status === "enrolled");

  const rows: StudentAttendanceRow[] = members.map(e => {
    const student = students.find(s => s.id === e.studentId);

    const cells: (AttendanceStatus | null)[] = counted.map(
      s => (s.records || {})[e.studentId] ?? null
    );

    let attended = 0;
    let denominator = 0;
    for (const c of cells) {
      if (c === null) continue;
      if (c === "excused") continue;
      denominator++;
      if (c === "present" || c === "late") attended++;
    }

    return {
      studentId: e.studentId,
      fullName: student?.fullName || e.studentId,
      department: student?.department || "",
      cells,
      attended,
      counted: denominator,
      rate: denominator > 0 ? Math.round((attended / denominator) * 100) : 0,
      maxAbsentStreak: maxAbsentStreak(cells),
    };
  });

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

  return { sessions: counted, rows, totalDoneSessions: counted.length };
}
