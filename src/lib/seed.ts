import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { Announcement, ClassSession } from "../types";

export async function seedInitialData() {
  try {
    // 1. Seed Announcements if empty
    const annRef = collection(db, "announcements");
    const annSnap = await getDocs(annRef);
    if (annSnap.empty) {
      const defaultAnnouncements: Omit<Announcement, "id">[] = [
        {
          title: "Khai mạc cổng truyền thông & khảo sát phân loại học viên lớp AI nội bộ",
          content: "Để phục vụ công tác đào tạo AI bài bản, bảo mật thông tin y tế và nâng cao hiệu suất làm việc tại bệnh viện, Ban Giám đốc phát động chương trình khảo sát phân lớp cho toàn thể cán bộ, nhân viên.",
          category: "important",
          date: "17/07/2026",
          createdAt: serverTimestamp()
        },
        {
          title: "Thông báo lịch học dự kiến của Lớp Cấp độ 1 - AI cho công việc hàng ngày",
          content: "Lớp Level 1 sẽ bắt đầu khóa học đầu tiên vào đầu tháng tới. Mỗi lớp quy mô từ 15-20 học viên, học trực tiếp tại Hội trường A. Học viên vui lòng mang theo laptop cá nhân và sạc.",
          category: "schedule",
          date: "16/07/2026",
          createdAt: serverTimestamp()
        },
        {
          title: "Nguyên tắc thiết kế chung của khóa học: Tối đa thực hành (Tỷ lệ 30/70)",
          content: "Tất cả các buổi học sẽ tập trung tối thiểu vào lý thuyết (30%) và dành thời gian tối đa để thực hành (70%) trực tiếp trên máy tính của học viên với các công việc thực tế, không dùng case study mẫu.",
          category: "general",
          date: "15/07/2026",
          createdAt: serverTimestamp()
        }
      ];

      for (const ann of defaultAnnouncements) {
        await addDoc(annRef, ann);
      }
      console.log("Seeded announcements successfully!");
    }

    // 2. Seed Classes if empty
    const classRef = collection(db, "classes");
    const classSnap = await getDocs(classRef);
    if (classSnap.empty) {
      const defaultClasses: ClassSession[] = [
        {
          level: "L1",
          name: "Lớp L1-K1 (Sáng Thứ 7)",
          schedule: "08:30 - 10:30, Thứ 7 Hàng tuần",
          instructor: "TS. Nguyễn Minh Triết (Chuyên gia AI Y tế)",
          room: "Hội trường lớn A (Tầng 3, Nhà hành chính)",
          studentsCount: 18
        },
        {
          level: "L1",
          name: "Lớp L1-K2 (Chiều Thứ 4)",
          schedule: "14:00 - 16:00, Thứ 4 Hàng tuần",
          instructor: "ThS. Phạm Ngọc Lan (Phòng CNTT)",
          room: "Phòng đào tạo số 2 (Tầng 2, Nhà B)",
          studentsCount: 15
        },
        {
          level: "L2",
          name: "Lớp L2-K1: Apps Script + Gemini (Chiều Thứ 5)",
          schedule: "14:00 - 16:00, Thứ 5 Hàng tuần",
          instructor: "Kỹ sư Lê Hoàng Nam (Trưởng nhóm Giải pháp số)",
          room: "Phòng máy tính Lab CNTT (Tầng 5, Nhà C)",
          studentsCount: 12
        },
        {
          level: "L3",
          name: "Lớp L3-K1: Vibe Coding (Sáng Chủ Nhật)",
          schedule: "09:00 - 11:00, Chủ Nhật Hàng tuần",
          instructor: "TS. Nguyễn Minh Triết & Khách mời Google",
          room: "Phòng Lab AI & Đổi mới sáng tạo",
          studentsCount: 8
        }
      ];

      for (const cls of defaultClasses) {
        await addDoc(classRef, cls);
      }
      console.log("Seeded classes successfully!");
    }
  } catch (err) {
    console.error("Error seeding initial data: ", err);
  }
}
