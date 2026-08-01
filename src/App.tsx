import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./lib/firebase";
import { seedInitialData } from "./lib/seed";
import { SurveySubmission, Announcement, ClassSession } from "./types";
import Navigation from "./components/Navigation";
import HomePortal from "./components/HomePortal";
import SurveyForm from "./components/SurveyForm";
import AdminDashboard from "./components/AdminDashboard";
import TeacherLogin from "./components/TeacherLogin";
import { isTeacherAuthed, clearTeacherAuth } from "./lib/auth";
import { CheckCircle2, ArrowRight } from "lucide-react";
import HungVuongLogo from "./components/HungVuongLogo";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "survey" | "admin">("home");
  // Quyền Giảng viên: khôi phục từ localStorage để ghi nhớ đăng nhập.
  const [isAdmin, setIsAdmin] = useState(() => isTeacherAuthed());
  
  // Data State
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Success Modal State after Survey submission
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    name: string;
    level: "L1" | "L2" | "L3";
  } | null>(null);

  // Function to load all data from Firestore
  const loadFirestoreData = async () => {
    setLoading(true);
    try {
      // 1. Seed if empty
      await seedInitialData();

      // 2. Fetch Announcements (ordered by createdAt descending)
      const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      const annSnap = await getDocs(annQuery);
      const annList = annSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(annList);

      // 3. Fetch Classes
      const classesSnap = await getDocs(collection(db, "classes"));
      const classesList = classesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassSession[];
      // Sort classes loosely by level
      classesList.sort((a, b) => a.level.localeCompare(b.level));
      setClasses(classesList);

      // 4. Fetch Submissions
      const subSnap = await getDocs(collection(db, "survey_submissions"));
      const subList = subSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SurveySubmission[];
      setSubmissions(subList);

    } catch (err) {
      console.error("Lỗi khi tải dữ liệu Firestore: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirestoreData();
  }, []);

  // Handle successful survey submission
  const handleSurveySuccess = () => {
    // Reload submissions to show on Admin dashboard immediately
    loadFirestoreData();
    
    // Read the newest submission to display on the success alert
    setTimeout(async () => {
      try {
        const subSnap = await getDocs(collection(db, "survey_submissions"));
        const subList = subSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SurveySubmission[];
        
        // Sort by submittedAt to find the latest
        subList.sort((a, b) => b.submittedAt?.seconds - a.submittedAt?.seconds);
        if (subList.length > 0) {
          setLastSubmissionResult({
            name: subList[0].studentName,
            level: subList[0].assignedLevel
          });
          setShowSuccessModal(true);
        } else {
          setActiveTab("home");
        }
      } catch (err) {
        setActiveTab("home");
      }
    }, 500);
  };

  // Đăng nhập giảng viên thành công (gọi từ TeacherLogin).
  const handleLoginSuccess = () => {
    setIsAdmin(true);
    setActiveTab("admin");
  };

  // Đăng xuất khỏi quyền giảng viên.
  const handleLogout = () => {
    clearTeacherAuth();
    setIsAdmin(false);
    setActiveTab("home");
  };

  return (
    <div className="app-canvas relative min-h-screen text-ink flex flex-col font-sans">
      {/* Dải chéo 45° kế thừa từ khối thoi của logo: rộng 90px, cách 240px,
          có mặt nạ tan dần nên vùng đọc chữ hoàn toàn sạch. */}
      <div className="diag-bands z-0" aria-hidden="true" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Thanh điều hướng */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />

        {/* Khung nội dung chính */}
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-11 h-11 border-[3px] border-brand-sky-deep border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-ink-3">Đang tải dữ liệu…</p>
          </div>
        )}

        {!loading && (
          <div className="animate-fade-up">
            {activeTab === "home" && (
              <HomePortal
                onStartSurvey={() => setActiveTab("survey")}
              />
            )}

            {activeTab === "survey" && (
              <SurveyForm onSuccess={handleSurveySuccess} />
            )}

            {activeTab === "admin" && (
              isAdmin ? (
                <AdminDashboard
                  submissions={submissions}
                  announcements={announcements}
                  classes={classes}
                  onRefreshData={loadFirestoreData}
                />
              ) : (
                <TeacherLogin onSuccess={handleLoginSuccess} />
              )
            )}
          </div>
        )}
        </main>

        {/* Footer — slogan sống ở đây, nơi nó có chỗ thở */}
        <footer className="border-t border-brand-navy/12 bg-white/55 backdrop-blur-sm py-8 mt-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-center sm:text-left">
              <HungVuongLogo size="sm" showSlogan variant="compact" />
            </div>
            <div className="flex flex-col sm:items-end gap-1.5 text-[12.5px] text-ink-3">
              <span>© 2026 Bệnh viện Đa khoa Hùng Vương · Đào tạo AI nội bộ</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Hộp thoại xác nhận sau khi gửi khảo sát */}
      {showSuccessModal && lastSubmissionResult && (
        <div className="fixed inset-0 bg-brand-navy-deep/45 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="surface cut-corner p-7 sm:p-8 max-w-md w-full space-y-5 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-field flex items-center justify-center bg-gradient-to-br from-ok-light to-ok text-white shadow-[0_10px_20px_-8px_rgb(14_159_110/0.7)]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10.5px] font-extrabold text-ok-deep tracking-[0.09em] uppercase">
                  Đã ghi nhận khảo sát
                </span>
                <h3 className="text-lg font-extrabold text-ink tracking-tight">
                  Cảm ơn {lastSubmissionResult.name}
                </h3>
              </div>
            </div>

            <p className="text-[14px] text-ink-3 leading-relaxed">
              Dựa trên câu trả lời, hệ thống đề xuất bạn học cấp độ dưới đây. Bạn vẫn có thể đổi khi liên hệ giáo vụ.
            </p>

            <div
              className={`relative overflow-hidden rounded-card p-5 text-white shadow-[0_18px_36px_-14px_rgb(20_51_110/0.7)] ${
                lastSubmissionResult.level === "L1"
                  ? "bg-gradient-to-br from-lv1-light via-lv1 to-lv1-deep"
                  : lastSubmissionResult.level === "L2"
                  ? "bg-gradient-to-br from-lv2-light via-lv2 to-lv2-deep"
                  : "bg-gradient-to-br from-lv3-light via-lv3 to-lv3-deep"
              }`}
            >
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-white/75">
                Đề xuất cho bạn
              </span>
              <div className="flex items-baseline gap-2.5 mt-2">
                <span className="text-4xl font-extrabold leading-none tracking-[-0.04em] tnum">
                  {lastSubmissionResult.level === "L1" ? "01" : lastSubmissionResult.level === "L2" ? "02" : "03"}
                </span>
                <span className="text-[17px] font-extrabold tracking-tight">
                  {lastSubmissionResult.level === "L1"
                    ? "Daily Work AI"
                    : lastSubmissionResult.level === "L2"
                    ? "AI Automation"
                    : "Vibe Coding"}
                </span>
              </div>
            </div>

            <button
              id="btn-modal-close"
              onClick={() => {
                setShowSuccessModal(false);
                setLastSubmissionResult(null);
                setActiveTab("home");
              }}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 cursor-pointer text-[15px]"
            >
              Về trang chương trình
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
