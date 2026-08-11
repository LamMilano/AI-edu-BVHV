import React, { useState, useEffect } from "react";
import { saveClass, deleteClass } from "../lib/repo/classes";
import { createAnnouncement, deleteAnnouncement } from "../lib/repo/announcements";
import { deleteSubmission } from "../lib/repo/submissions";
import { SurveySubmission, Announcement, ClassRecord, Student } from "../types";
import StudentProfileList from "../features/students/StudentProfileList";
import DuplicateReview from "../features/students/DuplicateReview";
import { migrateStudents, MigrateReport } from "../lib/migrate";
import { markNotDuplicate, mergeStudents } from "../lib/repo/students";
import { LEVEL_RAMP, LEVEL_LABEL } from "../lib/levels";
import { formatDateVN, formatTimeVN } from "../lib/datetime";
import { useStudentFilters } from "../hooks/useStudentFilters";
import StudentStats from "./StudentStats";
import { computePublicStats } from "../lib/stats";
import { DAY_OPTIONS, TIMEFRAME_OPTIONS, DURATION_OPTIONS } from "../lib/classSchedule";
import StudentFilterBar from "./StudentFilterBar";
import {
  LayoutDashboard, Users, FileText, Calendar, BellRing, Plus,
  Trash2, Pencil, X, ArrowUpDown, ChevronDown, CheckCircle2, ShieldAlert, Sparkles, BookOpen
} from "lucide-react";

interface AdminDashboardProps {
  submissions: SurveySubmission[];
  announcements: Announcement[];
  classes: ClassRecord[];
  students: Student[];
  studentsLoading: boolean;
  onRefreshData: () => void;
}

/* ── Mảnh giao diện cho phiếu chi tiết học viên ─────────────── */

/** Một mục trả lời: nhãn nhỏ in hoa + nội dung. */
function AnswerItem({ label, value, wide }: {
  label: string; value: string; wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block mb-1.5">
        {label}
      </span>
      <p className="text-[13.5px] text-ink-2 leading-relaxed">{value}</p>
    </div>
  );
}

/** Tiêu đề một trang khảo sát trong phiếu chi tiết. */
function AnswerSection({ step, title, children }: {
  step: string; title: string; children: React.ReactNode;
}) {
  return (
    <div className="pt-5 border-t border-line-soft">
      <div className="flex items-baseline gap-2.5 mb-4">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-ink-4">{step}</span>
        <h5 className="text-[15px] font-extrabold tracking-[-0.02em]">{title}</h5>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">{children}</div>
    </div>
  );
}

/** Gộp đáp án nhiều lựa chọn (kèm ô "Khác") thành một dòng chữ. */
const listAnswer = (items: string[] | undefined, fallback: string, other?: string) =>
  [...(items || []), other].filter(Boolean).join(", ") || fallback;

/* Trạng thái trống của form lớp. Tách ra hằng số để "Thêm mới" và "Hủy sửa"
   dùng chung đúng một định nghĩa, không lệch nhau khi thêm trường mới. */
const emptyClass = {
  level: "L1" as "L1" | "L2" | "L3",
  name: "",
  instructor: "",
  room: "",
  capacity: 20,
  status: "planning" as "planning" | "active" | "closed",
  plannedSchedule: { days: [] as string[], timeframe: "", duration: "" },
  enrolledCount: 0,
};

export default function AdminDashboard({
  submissions, announcements, classes, students, studentsLoading, onRefreshData,
}: AdminDashboardProps) {
  // Navigation tabs within Admin Panel
  const [adminSubTab, setAdminSubTab] = useState<"students" | "classes" | "announcements">("students");

  /* Ba chế độ xem trong tab Học viên. Hồ sơ là mặc định vì đó là đơn vị vận
     hành (một dòng một người); bảng phiếu giữ lại làm dữ liệu thô để đối chiếu. */
  const [studentView, setStudentView] = useState<"profiles" | "duplicates" | "submissions">("profiles");
  const [migrating, setMigrating] = useState(false);
  const [migrateReport, setMigrateReport] = useState<MigrateReport | null>(null);
  const [studentActionBusy, setStudentActionBusy] = useState(false);

  const handleMigrate = async () => {
    if (!confirm("Dựng lại hồ sơ học viên từ toàn bộ phiếu khảo sát? Thao tác này an toàn khi chạy nhiều lần.")) return;
    setMigrating(true);
    try {
      const report = await migrateStudents();
      setMigrateReport(report);
      onRefreshData();
    } catch (err) {
      console.error("Lỗi khi dựng hồ sơ học viên: ", err);
      alert("Không dựng được hồ sơ. Kiểm tra quyền tài khoản và kết nối mạng.");
    } finally {
      setMigrating(false);
    }
  };

  const handleMergeStudents = async (keepId: string, dropId: string) => {
    setStudentActionBusy(true);
    try {
      await mergeStudents(keepId, dropId);
      onRefreshData();
    } catch (err) {
      console.error("Lỗi khi gộp hồ sơ: ", err);
      alert("Không gộp được hồ sơ. Vui lòng thử lại.");
    } finally {
      setStudentActionBusy(false);
    }
  };

  const handleDismissDuplicate = async (idA: string, idB: string) => {
    setStudentActionBusy(true);
    try {
      await markNotDuplicate(idA, idB);
      onRefreshData();
    } catch (err) {
      console.error("Lỗi khi đánh dấu không trùng: ", err);
      alert("Không lưu được đánh dấu. Vui lòng thử lại.");
    } finally {
      setStudentActionBusy(false);
    }
  };

  // State for creating / editing a Class
  const [newClass, setNewClass] = useState(emptyClass);
  // ID lớp đang sửa; null nghĩa là đang ở chế độ Thêm mới.
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // State for creating new Announcement
  const [newAnn, setNewAnn] = useState({
    title: "",
    content: "",
    category: "general" as "important" | "schedule" | "general"
  });

  // Lọc & sắp xếp danh sách học viên (logic nằm ở src/hooks/useStudentFilters.ts)
  const studentFilters = useStudentFilters(submissions);
  const [selectedSubmission, setSelectedSubmission] = useState<SurveySubmission | null>(null);

  // loading / action indicators
  const [loading, setLoading] = useState(false);

  // Calculations for Stats Card
  const totalSubmissions = submissions.length;

  // Số liệu tổng hợp: cùng một hàm với trang chủ, nên hai nơi không bao giờ lệch nhau.
  const publicStats = computePublicStats(submissions);

  // Giờ dữ liệu được nạp gần nhất — bảng số liệu cần cho biết độ mới
  const lastUpdated = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  // Day preference statistics
  const dayPrefs: Record<string, number> = { "T2": 0, "T3": 0, "T4": 0, "T5": 0, "T6": 0, "T7": 0 };
  submissions.forEach(s => {
    if (s.answers && Array.isArray(s.answers.q11_days)) {
      s.answers.q11_days.forEach(day => {
        if (dayPrefs[day] !== undefined) {
          dayPrefs[day]++;
        }
      });
    }
  });
  const dayPrefsData = Object.keys(dayPrefs).map(key => ({
    day: key,
    "Học viên": dayPrefs[key]
  }));

  // Đưa form về trạng thái trống (chế độ Thêm mới)
  const resetClassForm = () => {
    setEditingClassId(null);
    setNewClass(emptyClass);
  };

  // Bắt đầu sửa một lớp: đổ dữ liệu vào form
  const handleEditClass = (cls: ClassRecord) => {
    if (!cls.id) return;
    setEditingClassId(cls.id);
    setNewClass({
      level: cls.level,
      name: cls.name,
      instructor: cls.instructor,
      room: cls.room,
      capacity: cls.capacity,
      status: cls.status,
      // Sao chép mảng: sửa form không được đụng vào dữ liệu đang hiển thị ở bảng.
      plannedSchedule: {
        days: [...(cls.plannedSchedule?.days || [])],
        timeframe: cls.plannedSchedule?.timeframe || "",
        duration: cls.plannedSchedule?.duration || "",
      },
      enrolledCount: cls.enrolledCount,
    });
    // Cuộn lên đầu để thấy form (trên mobile form nằm dưới danh sách).
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Lưu lớp học: thêm mới hoặc cập nhật tùy theo editingClassId
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name.trim()) {
      alert("Vui lòng nhập tên lớp!");
      return;
    }
    if (newClass.plannedSchedule.days.length === 0) {
      alert("Vui lòng chọn ít nhất một ngày trong tuần cho lớp!");
      return;
    }
    setLoading(true);
    try {
      await saveClass(editingClassId, newClass);
      resetClassForm();
      onRefreshData();
    } catch (err) {
      console.error("Lỗi khi lưu lớp học: ", err);
      alert("Có lỗi khi lưu lớp học. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  // Handle adding new announcement
  const handleCreateAnn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnn.title || !newAnn.content) {
      alert("Vui lòng nhập tiêu đề và nội dung thông báo!");
      return;
    }
    setLoading(true);
    try {
      await createAnnouncement(newAnn);

      setNewAnn({
        title: "",
        content: "",
        category: "general"
      });
      onRefreshData();
    } catch (err) {
      console.error("Lỗi khi đăng thông báo: ", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete generic document
  const handleDeleteDoc = async (coll: "classes" | "announcements" | "survey_submissions", id?: string) => {
    if (!id) return;
    if (!confirm("Bạn có chắc chắn muốn xóa mục này? Hành động này không thể hoàn tác.")) return;
    
    try {
      if (coll === "classes") {
        await deleteClass(id);
      } else if (coll === "announcements") {
        await deleteAnnouncement(id);
      } else {
        await deleteSubmission(id);
      }
      onRefreshData();
      if (selectedSubmission?.id === id) setSelectedSubmission(null);
    } catch (err) {
      console.error("Lỗi khi xóa tài liệu: ", err);
    }
  };

  const filteredSubmissions = studentFilters.filtered;

  return (
    <div className="space-y-8">
      
      {/* ══ TIÊU ĐỀ TRANG ══ */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-ink tracking-[-0.028em]">Quản trị giáo vụ</h2>
          {/* Đây là bảng số liệu — người dùng cần biết dữ liệu mới đến đâu */}
          <p className="text-[13.5px] text-ink-3 mt-1 tnum">
            Cập nhật lúc {lastUpdated} · {totalSubmissions} lượt khảo sát
          </p>
        </div>

        <div className="inline-flex self-start rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#E8F0F9] to-[#DCE8F4]">
          {[
            { id: "students", label: "Học viên", icon: Users },
            { id: "classes", label: "Lớp học", icon: BookOpen },
            { id: "announcements", label: "Bảng tin", icon: BellRing }
          ].map(tab => (
            <button
              id={`admin-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setAdminSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold rounded-[7px] transition-all cursor-pointer ${
                adminSubTab === tab.id
                  ? "bg-gradient-to-b from-white to-[#F6FAFD] text-brand-navy shadow-[0_2px_6px_-2px_rgb(20_51_110/0.3)]"
                  : "text-ink-3 hover:text-ink"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ THÔNG TIN HỌC VIÊN — dùng chung với trang chủ (src/components/StudentStats.tsx) ══ */}
      <StudentStats stats={publicStats} showCharts={adminSubTab === "students"} />

      {/* SUB-TABS VIEWS */}

      {/* 1. HỌC VIÊN — ba chế độ xem: hồ sơ, nghi trùng, phiếu khảo sát thô */}
      {adminSubTab === "students" && (
        <div className="space-y-4">
          <div className="inline-flex rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#E8F0F9] to-[#DCE8F4]">
            {[
              { id: "profiles", label: `Hồ sơ (${students.length})` },
              { id: "duplicates", label: "Nghi trùng" },
              { id: "submissions", label: `Phiếu khảo sát (${submissions.length})` },
            ].map(v => (
              <button
                key={v.id}
                id={`student-view-${v.id}`}
                onClick={() => setStudentView(v.id as any)}
                className={`px-3.5 py-1.5 text-[12.5px] font-bold rounded-[7px] transition-all cursor-pointer ${
                  studentView === v.id
                    ? "bg-gradient-to-b from-white to-[#F6FAFD] text-brand-navy shadow-[0_2px_6px_-2px_rgb(20_51_110/0.3)]"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {studentView === "profiles" && (
            <StudentProfileList
              students={students}
              loading={studentsLoading}
              migrating={migrating}
              report={migrateReport}
              onMigrate={handleMigrate}
            />
          )}

          {studentView === "duplicates" && (
            <DuplicateReview
              students={students}
              busy={studentActionBusy}
              onMerge={handleMergeStudents}
              onDismiss={handleDismissDuplicate}
            />
          )}

          {studentView === "submissions" && (
          <div className="surface p-5 space-y-4">
            <StudentFilterBar {...studentFilters} />

            {/* Submissions Table */}
            <div className="overflow-x-auto border border-line-soft rounded-field">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-b from-[#F4F8FC] to-[#EAF1F8] text-[10px] font-bold text-ink-3 uppercase tracking-wider border-b border-line-soft">
                    <th className="px-4 py-3 w-12">STT</th>
                    <th className="px-4 py-3">Học viên</th>
                    <th className="px-4 py-3">Khoa / Phòng</th>
                    <th className="px-4 py-3">Điểm số</th>
                    <th className="px-4 py-3">Xếp lớp đề xuất</th>
                    <th className="px-4 py-3">Thời gian đăng ký</th>
                    <th className="px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft text-xs">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-ink-4">
                        {studentFilters.isFiltered ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="italic">Không có học viên nào khớp bộ lọc.</span>
                            <button
                              id="btn-reset-filters-empty"
                              onClick={studentFilters.resetAll}
                              className="font-bold text-brand-navy hover:text-brand-sky-deep transition-colors cursor-pointer not-italic"
                            >
                              Xóa lọc
                            </button>
                          </span>
                        ) : (
                          <span className="italic">Không tìm thấy thông tin đăng ký khảo sát nào.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, index) => (
                      <tr key={sub.id} className="hover:bg-[#F6FAFD] transition-colors">
                        <td className="px-4 py-4.5 tnum text-ink-4">{index + 1}</td>
                        <td className="px-4 py-4.5 font-bold text-ink">{sub.studentName}</td>
                        <td className="px-4 py-4.5 text-ink-3">{sub.department}</td>
                        <td className="px-4 py-4.5 tnum font-bold text-ink-2">{sub.score} / 100</td>
                        <td className="px-4 py-4.5">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-[5px] text-[11.5px] font-bold bg-gradient-to-br ${
                              LEVEL_RAMP[sub.assignedLevel].pill
                            }`}
                          >
                            {LEVEL_LABEL[sub.assignedLevel]}
                          </span>
                        </td>
                        <td className="px-4 py-4.5">
                          <div className="space-y-0.5">
                            <span className="block text-ink-3 tnum">{formatDateVN(sub.submittedAt)}</span>
                            <span className="block text-[10px] text-ink-4 tnum">{formatTimeVN(sub.submittedAt)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4.5">
                          <div className="space-y-0.5">
                            <span className="block text-ink-3 tnum">{sub.phone}</span>
                            <span className="block text-[10px] text-ink-4 tnum">{sub.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4.5 text-right space-x-2">
                          <button
                            id={`view-detail-${sub.id}`}
                            onClick={() => setSelectedSubmission(sub)}
                            className="text-xs font-semibold text-brand-navy hover:text-brand-sky-deep transition-colors cursor-pointer"
                          >
                            Xem chi tiết
                          </button>
                          <button
                            id={`delete-sub-${sub.id}`}
                            onClick={() => handleDeleteDoc("survey_submissions", sub.id)}
                            className="text-xs font-semibold text-danger hover:text-danger-deep transition-colors cursor-pointer"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Phiếu chi tiết nằm ngoài ba chế độ xem, mở từ bảng phiếu khảo sát */}
          {selectedSubmission && (
            <div className="surface cut-corner p-6 sm:p-7 space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-line-soft">
                <div className="flex items-center gap-3">
                  <span className={`w-1.5 h-11 rounded-full flex-none bg-gradient-to-b ${LEVEL_RAMP[selectedSubmission.assignedLevel].rail}`} />
                  <div>
                    <h4 className="text-[18px] font-extrabold tracking-[-0.02em]">{selectedSubmission.studentName}</h4>
                    <span className="text-[13px] text-ink-3">{selectedSubmission.department}</span>
                  </div>
                </div>
                <button
                  id="close-sub-detail"
                  onClick={() => setSelectedSubmission(null)}
                  className="btn-secondary px-3.5 py-2 text-[13px] cursor-pointer flex-none"
                >
                  Đóng
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">Liên hệ</span>
                  <div className="mt-1.5 space-y-1 text-[13.5px] text-ink-2">
                    <p className="tnum">{selectedSubmission.phone}</p>
                    <p className="break-all">{selectedSubmission.email}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">Kết quả xếp lớp</span>
                  <p className="mt-1.5 text-[13.5px] text-ink-2">
                    {LEVEL_LABEL[selectedSubmission.assignedLevel]} ·{" "}
                    <span className="tnum font-semibold">{selectedSubmission.score}/100</span>
                  </p>
                </div>
              </div>

              {/* ── Trang 2 của phiếu: kinh nghiệm AI (câu 1–5) ── */}
              <AnswerSection step="Trang 2" title="Bạn đã dùng AI đến đâu?">
                <AnswerItem
                  label="1. Công cụ AI đã dùng"
                  value={listAnswer(
                    selectedSubmission.answers.q1_tools,
                    "Chưa dùng bao giờ",
                    selectedSubmission.answers.q1_tools_other
                  )}
                />
                <AnswerItem
                  label="2. Bản trả phí đang dùng"
                  value={listAnswer(
                    selectedSubmission.answers.q2_paid,
                    "Chưa trả phí cho công cụ nào",
                    selectedSubmission.answers.q2_paid_other
                  )}
                />
                <AnswerItem
                  label="3. Tần suất dùng AI cho công việc"
                  value={selectedSubmission.answers.q3_frequency || "Chưa trả lời"}
                />
                <AnswerItem
                  label="4. Việc đã từng làm bằng AI"
                  value={listAnswer(selectedSubmission.answers.q4_past_tasks, "Chưa làm việc nào")}
                />
                <AnswerItem
                  label="5. Khái niệm đã biết"
                  value={listAnswer(selectedSubmission.answers.q5_concepts, "Chưa biết khái niệm nào")}
                  wide
                />
              </AnswerSection>

              {/* ── Trang 3 của phiếu: mục tiêu và lịch học (câu 7–12) ── */}
              <AnswerSection step="Trang 3" title="Bạn muốn đạt được gì?">
                <AnswerItem
                  label="7. Mong muốn học nhất"
                  value={listAnswer(selectedSubmission.answers.q7_goals, "Chưa chọn")}
                  wide
                />
                <AnswerItem
                  label="8. Định hướng"
                  value={selectedSubmission.answers.q8_orientation || "Chưa trả lời"}
                  wide
                />

                <div className="sm:col-span-2">
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">
                    9. Công việc lặp lại muốn cải thiện bằng AI
                  </span>
                  <p className="mt-2 text-[13.5px] text-ink-2 leading-relaxed rounded-r-[6px] border-l-[3px] border-brand-sky-deep bg-gradient-to-br from-brand-sky/12 to-brand-sky/4 px-3.5 py-3">
                    {selectedSubmission.answers.q9_repetitive_tasks || "Không cung cấp mô tả"}
                  </p>
                </div>

                <AnswerItem
                  label="10. Khung giờ thuận tiện"
                  value={listAnswer(selectedSubmission.answers.q10_timeframe, "Chưa chọn")}
                />
                <AnswerItem
                  label="11. Ngày trong tuần thuận tiện"
                  value={listAnswer(selectedSubmission.answers.q11_days, "Chưa chọn")}
                />
                <AnswerItem
                  label="12. Thời lượng buổi phù hợp"
                  value={selectedSubmission.answers.q12_duration || "Chưa chọn"}
                />
              </AnswerSection>
            </div>
          )}
        </div>
      )}

      {/* 2. ACTIVE CLASSES MANAGEMENT */}
      {adminSubTab === "classes" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Class List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Danh Sách Lớp Học Hoạt Động</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className={`bg-white p-5 rounded-card border shadow-xs space-y-3 transition-all relative ${
                  editingClassId === cls.id ? "border-brand-sky-deep ring-2 ring-brand-sky-deep/20" : "border-line-soft hover:border-line"
                }`}>
                  <div className="flex items-center justify-between pr-14">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cls.level === "L3"
                        ? "bg-gradient-to-br from-[#D6E0F2] to-[#C2D1EA] text-[#14336E]"
                        : cls.level === "L2"
                        ? "bg-gradient-to-br from-[#DDE9F6] to-[#CBDDF0] text-[#274E7A]"
                        : "bg-gradient-to-br from-[#E4F4FD] to-[#D3EDFB] text-[#14607F]"
                    }`}>
                      Level {cls.level}
                    </span>
                    <span className="text-xs font-bold tnum text-ink-3">
                      {cls.enrolledCount} / {cls.capacity} học viên
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-ink text-sm leading-snug">{cls.name}</h4>
                    <p className="text-xs text-ink-3 mt-1">
                      {cls.plannedSchedule.days.length > 0
                        ? [
                            cls.plannedSchedule.days.join(", "),
                            cls.plannedSchedule.timeframe,
                            cls.plannedSchedule.duration,
                          ].filter(Boolean).join(" · ")
                        : <span className="italic text-ink-4">Chưa khai lịch</span>}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-line-soft text-[11px] text-ink-3 space-y-1">
                    <p><b>Giảng viên:</b> {cls.instructor}</p>
                    <p><b>Địa điểm:</b> {cls.room}</p>
                  </div>

                  <div className="absolute top-4 right-4 flex items-center gap-1">
                    <button
                      id={`edit-class-${cls.id}`}
                      onClick={() => handleEditClass(cls)}
                      title="Sửa lớp học"
                      className="text-ink-4 hover:text-brand-navy transition-colors p-1 rounded-md cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      id={`delete-class-${cls.id}`}
                      onClick={() => handleDeleteDoc("classes", cls.id)}
                      title="Xóa lớp học"
                      className="text-ink-4 hover:text-danger transition-colors p-1 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Create / Edit Class */}
          <div className={`bg-white p-5 rounded-card border shadow-xs self-start ${
            editingClassId ? "border-brand-sky-deep" : "border-line-soft"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                {editingClassId ? (
                  <><Pencil className="w-4 h-4 text-brand-navy" /> Sửa Lớp Học</>
                ) : (
                  <><Plus className="w-4 h-4 text-brand-navy" /> Thêm Lớp Học Mới</>
                )}
              </h3>
              {editingClassId && (
                <button
                  id="btn-cancel-edit-class"
                  type="button"
                  onClick={resetClassForm}
                  title="Hủy sửa"
                  className="flex items-center gap-1 text-[11px] font-semibold text-ink-3 hover:text-ink transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Hủy
                </button>
              )}
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-ink-2">Cấp độ đào tạo</label>
                <select
                  id="new-class-level"
                  value={newClass.level}
                  onChange={(e) => setNewClass(prev => ({ ...prev, level: e.target.value as any }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                >
                  <option value="L1">Level 1 - Daily Work AI</option>
                  <option value="L2">Level 2 - AI Automation</option>
                  <option value="L3">Level 3 - Vibe Coding</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Tên lớp học</label>
                <input
                  id="new-class-name"
                  type="text"
                  placeholder="Lớp L1-K3 (Sáng Thứ Bảy)"
                  value={newClass.name}
                  onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Ngày trong tuần</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {DAY_OPTIONS.map(d => {
                    const on = newClass.plannedSchedule.days.includes(d);
                    return (
                      <button
                        key={d}
                        id={`class-day-${d}`}
                        type="button"
                        onClick={() => setNewClass(prev => ({
                          ...prev,
                          plannedSchedule: {
                            ...prev.plannedSchedule,
                            days: on
                              ? prev.plannedSchedule.days.filter(x => x !== d)
                              : [...prev.plannedSchedule.days, d],
                          },
                        }))}
                        className={`px-3 py-1.5 rounded-lg text-[13px] font-bold border transition-colors cursor-pointer ${
                          on
                            ? "border-brand-sky-deep bg-[#E4F4FD] text-brand-navy"
                            : "border-line text-ink-3 hover:bg-white"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                {/* Khảo sát chỉ hỏi T2–T7, nên lớp Chủ Nhật không bao giờ khớp ngày với ai */}
                {newClass.plannedSchedule.days.includes("CN") && (
                  <p className="text-[12px] text-ink-4 pt-1">
                    Khảo sát không hỏi Chủ Nhật, nên lớp này sẽ không khớp ngày với học viên nào khi xếp tự động.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-ink-2">Khung giờ</label>
                  <select
                    id="class-timeframe"
                    value={newClass.plannedSchedule.timeframe}
                    onChange={(e) => setNewClass(prev => ({
                      ...prev, plannedSchedule: { ...prev.plannedSchedule, timeframe: e.target.value },
                    }))}
                    className="w-full p-2.5 rounded-lg border border-line"
                  >
                    <option value="">Chưa xác định</option>
                    {TIMEFRAME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-ink-2">Thời lượng</label>
                  <select
                    id="class-duration"
                    value={newClass.plannedSchedule.duration}
                    onChange={(e) => setNewClass(prev => ({
                      ...prev, plannedSchedule: { ...prev.plannedSchedule, duration: e.target.value },
                    }))}
                    className="w-full p-2.5 rounded-lg border border-line"
                  >
                    <option value="">Chưa xác định</option>
                    {DURATION_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Trạng thái</label>
                <select
                  id="class-status"
                  value={newClass.status}
                  onChange={(e) => setNewClass(prev => ({ ...prev, status: e.target.value as typeof prev.status }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                >
                  <option value="planning">Đang chuẩn bị</option>
                  <option value="active">Đang học</option>
                  <option value="closed">Đã đóng</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Giảng viên / Trợ giảng</label>
                <input
                  id="new-class-instructor"
                  type="text"
                  placeholder="TS. Nguyễn Minh Triết"
                  value={newClass.instructor}
                  onChange={(e) => setNewClass(prev => ({ ...prev, instructor: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Phòng học (Địa điểm)</label>
                <input
                  id="new-class-room"
                  type="text"
                  placeholder="Phòng Đào tạo số 1 (Nhà A)"
                  value={newClass.room}
                  onChange={(e) => setNewClass(prev => ({ ...prev, room: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Sức chứa tối đa</label>
                <input
                  id="new-class-capacity"
                  type="number"
                  min={0}
                  value={newClass.capacity || ""}
                  onChange={(e) => setNewClass(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2.5 rounded-lg border border-line tnum"
                />
              </div>

              <button
                id="btn-create-class"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 btn-primary text-white font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? "Đang xử lý..." : editingClassId ? "Cập Nhật Lớp Học" : "Lưu Lớp Học"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. ANNOUNCEMENTS MANAGEMENT */}
      {adminSubTab === "announcements" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Current announcements */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Thông báo hiện tại</h3>
            
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="surface p-5 relative flex flex-col justify-between hover:border-line transition-all">
                  <div className="space-y-2 max-w-[90%]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tnum text-ink-4">{ann.date}</span>
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        ann.category === "important" 
                          ? "bg-gradient-to-br from-[#FEF2F2] to-[#FDE8E8] text-danger-deep" 
                          : ann.category === "schedule" 
                          ? "bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] text-[#92400E]" 
                          : "bg-gradient-to-b from-[#E8F0F9] to-[#DCE8F4] text-ink-3"
                      }`}>
                        {ann.category === "important" ? "Quan Trọng" : ann.category === "schedule" ? "Lịch Học" : "Tin tức"}
                      </span>
                    </div>
                    <h4 className="font-bold text-ink text-sm">{ann.title}</h4>
                    <p className="text-xs text-ink-3 leading-relaxed font-sans">{ann.content}</p>
                  </div>

                  <button
                    id={`delete-ann-${ann.id}`}
                    onClick={() => handleDeleteDoc("announcements", ann.id)}
                    className="absolute top-4 right-4 text-ink-4 hover:text-danger transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Create Announcement Form */}
          <div className="surface p-5 self-start">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-brand-navy" />
              Đăng Thông Báo Mới
            </h3>

            <form onSubmit={handleCreateAnn} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-ink-2">Phân loại thông báo</label>
                <select
                  id="new-ann-category"
                  value={newAnn.category}
                  onChange={(e) => setNewAnn(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full p-2.5 rounded-lg border border-line bg-white"
                >
                  <option value="general">Tin tức chung (General)</option>
                  <option value="important">Tin khẩn / Quan trọng (Important)</option>
                  <option value="schedule">Thay đổi lịch học (Schedule)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Tiêu đề thông báo</label>
                <input
                  id="new-ann-title"
                  type="text"
                  placeholder="Yêu cầu chuẩn bị tài khoản email trước buổi học..."
                  value={newAnn.title}
                  onChange={(e) => setNewAnn(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink-2">Nội dung chi tiết</label>
                <textarea
                  id="new-ann-content"
                  rows={4}
                  placeholder="Nhập nội dung thông báo gửi đến toàn thể lớp học hoặc thông báo phân lớp..."
                  value={newAnn.content}
                  onChange={(e) => setNewAnn(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                />
              </div>

              <button
                id="btn-create-ann"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 btn-primary text-white font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? "Đang xử lý..." : "Đăng Thông Báo"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
