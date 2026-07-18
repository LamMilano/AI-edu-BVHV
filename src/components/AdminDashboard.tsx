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

  const distributionData = [
    { name: "Daily Work AI (L1)", value: l1Count, color: "#2563eb" },
    { name: "AI Automation (L2)", value: l2Count, color: "#4f46e5" },
    { name: "Vibe Coding (L3)", value: l3Count, color: "#9333ea" }
  ].filter(d => d.value > 0);

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
      
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-6.5 h-6.5 text-blue-600" />
            Bảng Quản Trị Giáo Vụ & Đào Tạo
          </h2>
          <p className="text-xs text-slate-500 mt-1">Cung cấp báo cáo, biểu đồ phân tích và quản lý danh sách học viên, lịch học thực tế.</p>
        </div>
        
        {/* Toggle tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 self-start">
          {[
            { id: "students", label: "Danh sách Học viên", icon: Users },
            { id: "classes", label: "Quản lý Lớp học", icon: BookOpen },
            { id: "announcements", label: "Quản lý Bảng tin", icon: BellRing }
          ].map(tab => (
            <button
              id={`admin-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setAdminSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                adminSubTab === tab.id
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* STATS OVERVIEW FOR SUBMISSIONS */}
      <section className="grid sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số học viên</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900 font-mono">{totalSubmissions}</span>
            <span className="text-xs text-emerald-600 font-semibold">Khảo sát hoàn tất</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs border-l-4 border-l-blue-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level 1 - Daily Work</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-blue-600 font-mono">{l1Count}</span>
            <span className="text-xs text-slate-400">
              {totalSubmissions > 0 ? Math.round((l1Count / totalSubmissions) * 100) : 0}% học viên
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs border-l-4 border-l-indigo-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level 2 - Automation</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-indigo-600 font-mono">{l2Count}</span>
            <span className="text-xs text-slate-400">
              {totalSubmissions > 0 ? Math.round((l2Count / totalSubmissions) * 100) : 0}% học viên
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs border-l-4 border-l-purple-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level 3 - Vibe Coding</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-purple-600 font-mono">{l3Count}</span>
            <span className="text-xs text-slate-400">
              {totalSubmissions > 0 ? Math.round((l3Count / totalSubmissions) * 100) : 0}% học viên
            </span>
          </div>
        </div>
      </section>

      {/* RECHARTS PLOTS */}
      {totalSubmissions > 0 && adminSubTab === "students" && (
        <section className="grid md:grid-cols-3 gap-6">
          {/* Level Distribution Pie Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Tỷ Lệ Phân Phối Level</h4>
            <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} học viên`]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-lg font-extrabold text-slate-700 font-mono">{totalSubmissions}</span>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              {distributionData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department Bar Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs md:col-span-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">Top 5 Khoa/Phòng Tham Gia</h4>
            {departmentData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-sans">Chưa có dữ liệu</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="students" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 text-[10px] text-slate-400 text-center font-sans">
              *Học viên phân loại chủ yếu tại các Khoa lâm sàng và Hành chính tổng hợp
            </div>
          </div>
        </section>
      )}

      {/* SUB-TABS VIEWS */}

      {/* 1. STUDENTS SUBMISSIONS */}
      {adminSubTab === "students" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  id="search-students"
                  type="text"
                  placeholder="Tìm học viên, khoa/phòng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-3 focus:ring-blue-200"
                />
              </div>

              <div className="flex gap-2">
                <select
                  id="filter-level"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white focus:outline-none focus:ring-3 focus:ring-blue-200"
                >
                  <option value="ALL">Tất cả các Cấp độ</option>
                  <option value="L1">Daily Work (L1)</option>
                  <option value="L2">AI Automation (L2)</option>
                  <option value="L3">Vibe Coding (L3)</option>
                </select>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-4 py-3">Học viên</th>
                    <th className="px-4 py-3">Khoa / Phòng</th>
                    <th className="px-4 py-3">Điểm số</th>
                    <th className="px-4 py-3">Xếp lớp đề xuất</th>
                    <th className="px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400 italic">
                        Không tìm thấy thông tin đăng ký khảo sát nào.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4.5 font-bold text-slate-800">{sub.studentName}</td>
                        <td className="px-4 py-4.5 text-slate-600">{sub.department}</td>
                        <td className="px-4 py-4.5 font-mono font-bold text-slate-700">{sub.score} / 100</td>
                        <td className="px-4 py-4.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.assignedLevel === "L3"
                              ? "bg-purple-100 text-purple-700"
                              : sub.assignedLevel === "L2"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {sub.assignedLevel === "L3" ? "Level 3" : sub.assignedLevel === "L2" ? "Level 2" : "Level 1"}
                          </span>
                        </td>
                        <td className="px-4 py-4.5">
                          <div className="space-y-0.5">
                            <span className="block text-slate-500 font-mono">{sub.phone}</span>
                            <span className="block text-[10px] text-slate-400 font-mono">{sub.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4.5 text-right space-x-2">
                          <button
                            id={`view-detail-${sub.id}`}
                            onClick={() => setSelectedSubmission(sub)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                          >
                            Xem chi tiết
                          </button>
                          <button
                            id={`delete-sub-${sub.id}`}
                            onClick={() => handleDeleteDoc("survey_submissions", sub.id)}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
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
            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h4 className="text-lg font-bold">{selectedSubmission.studentName}</h4>
                  <span className="text-xs text-slate-400">Khoa/Phòng: {selectedSubmission.department}</span>
                </div>
                <button
                  id="close-sub-detail"
                  onClick={() => setSelectedSubmission(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                >
                  Đóng chi tiết
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-6 text-xs">
                <div className="space-y-3">
                  <span className="font-bold text-blue-400 block uppercase tracking-wider">Thông tin liên lạc</span>
                  <div className="space-y-1.5 font-mono text-slate-300">
                    <p>SĐT: {selectedSubmission.phone}</p>
                    <p>Email: {selectedSubmission.email}</p>
                    <p>Xếp lớp: Level {selectedSubmission.assignedLevel}</p>
                    <p>Điểm: {selectedSubmission.score}/100</p>
                  </div>
                </div>

                <div className="space-y-3 sm:col-span-2">
                  <span className="font-bold text-indigo-400 block uppercase tracking-wider">Công việc lặp đi lặp lại muốn cải thiện bằng AI</span>
                  <p className="text-slate-300 leading-relaxed italic bg-slate-800/50 p-3.5 rounded-xl border border-slate-800 font-sans">
                    "{selectedSubmission.answers.q9_repetitive_tasks || "Không cung cấp mô tả"}"
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 grid sm:grid-cols-2 gap-4 text-xs font-sans">
                <div>
                  <span className="font-semibold text-slate-400 block mb-1">Công cụ đã dùng:</span>
                  <p className="text-slate-200">{(selectedSubmission.answers.q1_tools || []).join(", ") || "Chưa dùng bao giờ"}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block mb-1">Kiến thức đã biết:</span>
                  <p className="text-slate-200">{(selectedSubmission.answers.q5_concepts || []).join(", ") || "Chưa biết khái niệm nào"}</p>
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
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Danh Sách Lớp Học Hoạt Động</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className={`bg-white p-5 rounded-2xl border shadow-xs space-y-3 transition-all relative ${
                  editingClassId === cls.id ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-100 hover:border-slate-200"
                }`}>
                  <div className="flex items-center justify-between pr-14">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cls.level === "L3"
                        ? "bg-purple-100 text-purple-700"
                        : cls.level === "L2"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      Level {cls.level}
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-500">{cls.studentsCount} học viên</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug">{cls.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{cls.schedule}</p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-50 text-[11px] text-slate-500 space-y-1">
                    <p><b>Giảng viên:</b> {cls.instructor}</p>
                    <p><b>Địa điểm:</b> {cls.room}</p>
                  </div>

                  <div className="absolute top-4 right-4 flex items-center gap-1">
                    <button
                      id={`edit-class-${cls.id}`}
                      onClick={() => handleEditClass(cls)}
                      title="Sửa lớp học"
                      className="text-slate-300 hover:text-blue-600 transition-colors p-1 rounded-md cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      id={`delete-class-${cls.id}`}
                      onClick={() => handleDeleteDoc("classes", cls.id)}
                      title="Xóa lớp học"
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Create / Edit Class */}
          <div className={`bg-white p-5 rounded-2xl border shadow-xs self-start ${
            editingClassId ? "border-blue-300" : "border-slate-100"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                {editingClassId ? (
                  <><Pencil className="w-4 h-4 text-blue-600" /> Sửa Lớp Học</>
                ) : (
                  <><Plus className="w-4 h-4 text-blue-600" /> Thêm Lớp Học Mới</>
                )}
              </h3>
              {editingClassId && (
                <button
                  id="btn-cancel-edit-class"
                  type="button"
                  onClick={resetClassForm}
                  title="Hủy sửa"
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Hủy
                </button>
              )}
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Cấp độ đào tạo</label>
                <select
                  id="new-class-level"
                  value={newClass.level}
                  onChange={(e) => setNewClass(prev => ({ ...prev, level: e.target.value as any }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                >
                  <option value="L1">Level 1 - Daily Work AI</option>
                  <option value="L2">Level 2 - AI Automation</option>
                  <option value="L3">Level 3 - Vibe Coding</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên lớp học</label>
                <input
                  id="new-class-name"
                  type="text"
                  placeholder="Lớp L1-K3 (Sáng Thứ Bảy)"
                  value={newClass.name}
                  onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Lịch học chi tiết</label>
                <input
                  id="new-class-schedule"
                  type="text"
                  placeholder="08:30 - 10:30, Thứ Bảy hàng tuần"
                  value={newClass.schedule}
                  onChange={(e) => setNewClass(prev => ({ ...prev, schedule: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Giảng viên / Trợ giảng</label>
                <input
                  id="new-class-instructor"
                  type="text"
                  placeholder="TS. Nguyễn Minh Triết"
                  value={newClass.instructor}
                  onChange={(e) => setNewClass(prev => ({ ...prev, instructor: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Phòng học (Địa điểm)</label>
                <input
                  id="new-class-room"
                  type="text"
                  placeholder="Phòng Đào tạo số 1 (Nhà A)"
                  value={newClass.room}
                  onChange={(e) => setNewClass(prev => ({ ...prev, room: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số lượng học viên dự kiến</label>
                <input
                  id="new-class-count"
                  type="number"
                  value={newClass.studentsCount || ""}
                  onChange={(e) => setNewClass(prev => ({ ...prev, studentsCount: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <button
                id="btn-create-class"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
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
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Thông báo hiện tại</h3>
            
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative flex flex-col justify-between hover:border-slate-200 transition-all">
                  <div className="space-y-2 max-w-[90%]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">{ann.date}</span>
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        ann.category === "important" 
                          ? "bg-red-50 text-red-600" 
                          : ann.category === "schedule" 
                          ? "bg-amber-50 text-amber-600" 
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {ann.category === "important" ? "Quan Trọng" : ann.category === "schedule" ? "Lịch Học" : "Tin tức"}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{ann.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">{ann.content}</p>
                  </div>

                  <button
                    id={`delete-ann-${ann.id}`}
                    onClick={() => handleDeleteDoc("announcements", ann.id)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Create Announcement Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs self-start">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Đăng Thông Báo Mới
            </h3>

            <form onSubmit={handleCreateAnn} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Phân loại thông báo</label>
                <select
                  id="new-ann-category"
                  value={newAnn.category}
                  onChange={(e) => setNewAnn(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="general">Tin tức chung (General)</option>
                  <option value="important">Tin khẩn / Quan trọng (Important)</option>
                  <option value="schedule">Thay đổi lịch học (Schedule)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tiêu đề thông báo</label>
                <input
                  id="new-ann-title"
                  type="text"
                  placeholder="Yêu cầu chuẩn bị tài khoản email trước buổi học..."
                  value={newAnn.title}
                  onChange={(e) => setNewAnn(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nội dung chi tiết</label>
                <textarea
                  id="new-ann-content"
                  rows={4}
                  placeholder="Nhập nội dung thông báo gửi đến toàn thể lớp học hoặc thông báo phân lớp..."
                  value={newAnn.content}
                  onChange={(e) => setNewAnn(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <button
                id="btn-create-ann"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
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
