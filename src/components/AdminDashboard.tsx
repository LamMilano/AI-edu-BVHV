import React, { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { SurveySubmission, Announcement, ClassSession } from "../types";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";
import {
  LayoutDashboard, Users, FileText, Calendar, BellRing, Plus,
  Trash2, Pencil, X, Search, ArrowUpDown, ChevronDown, CheckCircle2, ShieldAlert, Sparkles, BookOpen
} from "lucide-react";

interface AdminDashboardProps {
  submissions: SurveySubmission[];
  announcements: Announcement[];
  classes: ClassSession[];
  onRefreshData: () => void;
}

/* Ba cấp độ dùng chung một dải xanh đậm dần trên toàn app. Giữ nguyên
   bảng này ở mọi nơi (ô số, biểu đồ, nhãn trong bảng) để người xem nối
   được ô số ↔ lát biểu đồ ↔ dòng dữ liệu chỉ bằng màu. */
const LEVEL_RAMP = {
  L1: { name: "Daily Work AI", solid: "#2E86C8", rail: "from-lv1-light to-lv1", from: "#7CD0F5", to: "#4FC3F0", pill: "from-[#E4F4FD] to-[#D3EDFB] text-[#14607F]" },
  L2: { name: "AI Automation", solid: "#4A7EB5", rail: "from-lv2-light to-lv2-deep", from: "#6B9FD4", to: "#4A7EB5", pill: "from-[#DDE9F6] to-[#CBDDF0] text-[#274E7A]" },
  L3: { name: "Vibe Coding", solid: "#14336E", rail: "from-lv3-light to-lv3-deep", from: "#2A5FB4", to: "#14336E", pill: "from-[#D6E0F2] to-[#C2D1EA] text-[#14336E]" },
} as const;

type LevelId = keyof typeof LEVEL_RAMP;

const LEVEL_TILES: {
  id: LevelId;
  label: string;
  color: string;
  count: (c: { l1Count: number; l2Count: number; l3Count: number }) => number;
}[] = [
  { id: "L1", label: "Cấp độ 1", color: LEVEL_RAMP.L1.solid, count: (c) => c.l1Count },
  { id: "L2", label: "Cấp độ 2", color: LEVEL_RAMP.L2.solid, count: (c) => c.l2Count },
  { id: "L3", label: "Cấp độ 3", color: LEVEL_RAMP.L3.solid, count: (c) => c.l3Count },
];

const LEVEL_LABEL: Record<LevelId, string> = {
  L1: "Cấp độ 1",
  L2: "Cấp độ 2",
  L3: "Cấp độ 3",
};

export default function AdminDashboard({ submissions, announcements, classes, onRefreshData }: AdminDashboardProps) {
  // Navigation tabs within Admin Panel
  const [adminSubTab, setAdminSubTab] = useState<"students" | "classes" | "announcements">("students");

  // State for creating / editing a Class
  const [newClass, setNewClass] = useState({
    level: "L1" as "L1" | "L2" | "L3",
    name: "",
    schedule: "",
    instructor: "",
    room: "",
    studentsCount: 0
  });
  // ID lớp đang sửa; null nghĩa là đang ở chế độ Thêm mới.
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // State for creating new Announcement
  const [newAnn, setNewAnn] = useState({
    title: "",
    content: "",
    category: "general" as "important" | "schedule" | "general"
  });

  // Filters & Searches for Student List
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | "L1" | "L2" | "L3">("ALL");
  const [selectedSubmission, setSelectedSubmission] = useState<SurveySubmission | null>(null);

  // loading / action indicators
  const [loading, setLoading] = useState(false);

  // Calculations for Stats Card
  const totalSubmissions = submissions.length;
  const l1Count = submissions.filter(s => s.assignedLevel === "L1").length;
  const l2Count = submissions.filter(s => s.assignedLevel === "L2").length;
  const l3Count = submissions.filter(s => s.assignedLevel === "L3").length;

  const distributionData = (["L1", "L2", "L3"] as LevelId[])
    .map((id) => ({
      id,
      name: `${LEVEL_LABEL[id]} · ${LEVEL_RAMP[id].name}`,
      value: id === "L1" ? l1Count : id === "L2" ? l2Count : l3Count,
      color: LEVEL_RAMP[id].solid,
    }))
    .filter(d => d.value > 0);

  // Giờ dữ liệu được nạp gần nhất — bảng số liệu cần cho biết độ mới
  const lastUpdated = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  // Department statistics
  const deptMap: Record<string, number> = {};
  submissions.forEach(s => {
    const dept = s.department || "Khác";
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const departmentData = Object.keys(deptMap).map(key => ({
    name: key,
    students: deptMap[key]
  })).sort((a, b) => b.students - a.students).slice(0, 5);

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
    setNewClass({
      level: "L1",
      name: "",
      schedule: "",
      instructor: "",
      room: "",
      studentsCount: 0
    });
  };

  // Bắt đầu sửa một lớp: đổ dữ liệu vào form
  const handleEditClass = (cls: ClassSession) => {
    if (!cls.id) return;
    setEditingClassId(cls.id);
    setNewClass({
      level: cls.level,
      name: cls.name,
      schedule: cls.schedule,
      instructor: cls.instructor,
      room: cls.room,
      studentsCount: cls.studentsCount
    });
    // Cuộn lên đầu để thấy form (trên mobile form nằm dưới danh sách).
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Lưu lớp học: thêm mới hoặc cập nhật tùy theo editingClassId
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name || !newClass.schedule) {
      alert("Vui lòng nhập tên lớp và lịch học!");
      return;
    }
    setLoading(true);
    try {
      if (editingClassId) {
        await updateDoc(doc(db, "classes", editingClassId), newClass);
      } else {
        await addDoc(collection(db, "classes"), newClass);
      }
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
      const today = new Date();
      const formattedDate = today.toLocaleDateString("vi-VN");
      
      await addDoc(collection(db, "announcements"), {
        title: newAnn.title,
        content: newAnn.content,
        category: newAnn.category,
        date: formattedDate,
        createdAt: serverTimestamp()
      });

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
      await deleteDoc(doc(db, coll, id));
      onRefreshData();
      if (selectedSubmission?.id === id) setSelectedSubmission(null);
    } catch (err) {
      console.error("Lỗi khi xóa tài liệu: ", err);
    }
  };

  // Filter Submissions
  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = 
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = levelFilter === "ALL" || s.assignedLevel === levelFilter;
    
    return matchesSearch && matchesLevel;
  });

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

      {/* ══ BỐN Ô SỐ — màu theo đúng dải cấp độ, nên nối được với biểu đồ và bảng ══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="surface-tile p-4">
          <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">Tổng học viên</span>
          <div className="text-[29px] font-extrabold tracking-[-0.035em] leading-none tnum mt-2 text-grad">
            {totalSubmissions}
          </div>
        </div>

        {LEVEL_TILES.map(({ id, label, color, count }) => {
          const n = count({ l1Count, l2Count, l3Count });
          return (
            <div key={id} className="surface-tile p-4 relative overflow-hidden">
              <span className={`absolute top-0 left-0 bottom-0 w-[4px] bg-gradient-to-b ${LEVEL_RAMP[id].rail}`} />
              <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">{label}</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-[29px] font-extrabold tracking-[-0.035em] leading-none tnum" style={{ color }}>
                  {n}
                </span>
                <span className="text-[12.5px] text-ink-3 tnum">
                  {totalSubmissions > 0 ? Math.round((n / totalSubmissions) * 100) : 0}%
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* RECHARTS PLOTS */}
      {totalSubmissions > 0 && adminSubTab === "students" && (
        <section className="grid md:grid-cols-3 gap-6">
          {/* Donut phân bố cấp độ — chú giải hình thoi đặt cạnh, không chồng lên */}
          <div className="surface p-5">
            <h4 className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em]">Phân bố cấp độ</h4>
            <div className="h-44 relative mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {distributionData.map((d) => (
                      <linearGradient key={d.id} id={`grad-${d.id}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={LEVEL_RAMP[d.id].from} />
                        <stop offset="100%" stopColor={LEVEL_RAMP[d.id].to} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {distributionData.map((entry) => (
                      <Cell key={entry.id} fill={`url(#grad-${entry.id})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} học viên`, ""]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #D8E4F2",
                      boxShadow: "0 14px 30px -14px rgb(20 51 110 / 0.4)",
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[26px] font-extrabold text-ink tnum leading-none">{totalSubmissions}</span>
                <span className="text-[11px] text-ink-4 mt-0.5">học viên</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {distributionData.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className="w-2.5 h-2.5 rotate-45 rounded-[2px] flex-none"
                    style={{ background: `linear-gradient(135deg, ${LEVEL_RAMP[d.id].from}, ${LEVEL_RAMP[d.id].to})` }}
                  />
                  <span className="text-ink-3 truncate">{d.name}</span>
                  <span className="ml-auto font-bold text-ink tnum">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cột theo khoa phòng — đổ màu dọc thay vì bệt */}
          <div className="surface p-5 md:col-span-2">
            <h4 className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em]">
              Năm khoa/phòng tham gia nhiều nhất
            </h4>
            {departmentData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-ink-4 text-[13.5px]">Chưa có dữ liệu</div>
            ) : (
              <div className="h-44 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7CD0F5" />
                        <stop offset="100%" stopColor="#2E86C8" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#6B7E95" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7E95" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgb(79 195 240 / 0.08)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #D8E4F2",
                        boxShadow: "0 14px 30px -14px rgb(20 51 110 / 0.4)",
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="students" name="Học viên" fill="url(#grad-bar)" radius={[5, 5, 2, 2]} barSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SUB-TABS VIEWS */}

      {/* 1. STUDENTS SUBMISSIONS */}
      {adminSubTab === "students" && (
        <div className="space-y-4">
          <div className="surface p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
                <input
                  id="search-students"
                  type="text"
                  placeholder="Tìm theo tên hoặc khoa…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="field w-full pl-10 pr-4 py-2.5 text-[14px]"
                />
              </div>

              {/* Lọc cấp độ dạng nút gạt — nhanh hơn thả xuống khi chỉ có 4 lựa chọn */}
              <div className="inline-flex self-start rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#EDF3FA] to-[#E1EAF4]">
                {(["ALL", "L1", "L2", "L3"] as const).map((lv) => (
                  <button
                    key={lv}
                    id={`filter-level-${lv}`}
                    onClick={() => setLevelFilter(lv)}
                    className={`px-3.5 py-1.5 rounded-[6px] text-[12.5px] font-bold transition-all cursor-pointer ${
                      levelFilter === lv
                        ? "bg-white text-brand-navy shadow-[0_2px_5px_-2px_rgb(20_51_110/0.3)]"
                        : "text-ink-3 hover:text-ink"
                    }`}
                  >
                    {lv === "ALL" ? "Tất cả" : LEVEL_LABEL[lv].replace("Cấp độ ", "C")}
                  </button>
                ))}
              </div>
            </div>

            {/* Submissions Table */}
            <div className="overflow-x-auto border border-line-soft rounded-field">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-b from-[#F4F8FC] to-[#EAF1F8] text-[10px] font-bold text-ink-3 uppercase tracking-wider border-b border-line-soft">
                    <th className="px-4 py-3">Học viên</th>
                    <th className="px-4 py-3">Khoa / Phòng</th>
                    <th className="px-4 py-3">Điểm số</th>
                    <th className="px-4 py-3">Xếp lớp đề xuất</th>
                    <th className="px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft text-xs">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-ink-4 italic">
                        Không tìm thấy thông tin đăng ký khảo sát nào.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#F6FAFD] transition-colors">
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

          {/* Student details expansion modal/pane if selected */}
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

              <div className="grid sm:grid-cols-3 gap-6">
                <div>
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">Liên hệ</span>
                  <div className="mt-2.5 space-y-1.5 text-[13.5px] text-ink-2">
                    <p className="tnum">{selectedSubmission.phone}</p>
                    <p className="break-all">{selectedSubmission.email}</p>
                    <p>
                      {LEVEL_LABEL[selectedSubmission.assignedLevel]} ·{" "}
                      <span className="tnum font-semibold">{selectedSubmission.score}/100</span>
                    </p>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block">
                    Công việc lặp lại muốn cải thiện bằng AI
                  </span>
                  <p className="mt-2.5 text-[13.5px] text-ink-2 leading-relaxed rounded-r-[6px] border-l-[3px] border-brand-sky-deep bg-gradient-to-br from-brand-sky/12 to-brand-sky/4 px-3.5 py-3">
                    {selectedSubmission.answers.q9_repetitive_tasks || "Không cung cấp mô tả"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-line-soft grid sm:grid-cols-2 gap-5">
                <div>
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block mb-1.5">Công cụ đã dùng</span>
                  <p className="text-[13.5px] text-ink-2">{(selectedSubmission.answers.q1_tools || []).join(", ") || "Chưa dùng bao giờ"}</p>
                </div>
                <div>
                  <span className="text-[10.5px] font-extrabold text-ink-4 uppercase tracking-[0.09em] block mb-1.5">Khái niệm đã biết</span>
                  <p className="text-[13.5px] text-ink-2">{(selectedSubmission.answers.q5_concepts || []).join(", ") || "Chưa biết khái niệm nào"}</p>
                </div>
              </div>
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
                    <span className="text-xs font-bold tnum text-ink-3">{cls.studentsCount} học viên</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-ink text-sm leading-snug">{cls.name}</h4>
                    <p className="text-xs text-ink-3 mt-1">{cls.schedule}</p>
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
                <label className="font-bold text-ink-2">Lịch học chi tiết</label>
                <input
                  id="new-class-schedule"
                  type="text"
                  placeholder="08:30 - 10:30, Thứ Bảy hàng tuần"
                  value={newClass.schedule}
                  onChange={(e) => setNewClass(prev => ({ ...prev, schedule: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-line"
                />
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
                <label className="font-bold text-ink-2">Số lượng học viên dự kiến</label>
                <input
                  id="new-class-count"
                  type="number"
                  value={newClass.studentsCount || ""}
                  onChange={(e) => setNewClass(prev => ({ ...prev, studentsCount: parseInt(e.target.value) || 0 }))}
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
