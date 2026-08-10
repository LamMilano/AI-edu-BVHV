import React, { useState, useEffect } from "react";
import { SurveySubmission, Announcement, ClassSession, PublicStatsData, AuthUser } from "./types";
import Navigation from "./components/Navigation";
import HomePortal from "./components/HomePortal";
import SurveyForm from "./components/SurveyForm";
import AdminDashboard from "./components/AdminDashboard";
import TeacherLogin from "./components/TeacherLogin";
import { onAuthChange, signOutUser } from "./lib/authz";
import { fetchSubmissions } from "./lib/repo/submissions";
import { fetchAnnouncements } from "./lib/repo/announcements";
import { fetchClasses } from "./lib/repo/classes";
import { fetchPublicStats, writePublicStats } from "./lib/repo/publicStats";
import { computePublicStats } from "./lib/stats";
import { CheckCircle2, ArrowRight } from "lucide-react";
import HungVuongLogo from "./components/HungVuongLogo";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "survey" | "admin">("home");

  /* Phiên đăng nhập. authReady = false nghĩa là Firebase Auth chưa kịp khôi
     phục phiên cũ — chưa biết là khách hay giảng viên, nên chưa vẽ gì. Nếu
     bỏ cờ này, người đã đăng nhập sẽ thấy màn hình đăng nhập nhấp nháy một
     nhịp mỗi lần tải trang. */
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Dữ liệu công khai: ai cũng đọc được.
  const [stats, setStats] = useState<PublicStatsData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  // Dữ liệu quản trị: chỉ nạp sau khi đăng nhập và mở tab Quản trị.
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Hộp thoại xác nhận sau khi gửi khảo sát
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    name: string;
    level: "L1" | "L2" | "L3";
  } | null>(null);

  // Theo dõi phiên đăng nhập suốt vòng đời app.
  useEffect(() => onAuthChange((u) => {
    setUser(u);
    setAuthReady(true);
  }), []);

  /* Dữ liệu công khai nạp một lần khi mở trang. Trước đây App nạp cả
     survey_submissions và classes ngay cả với khách chỉ vào điền khảo sát —
     sau khi siết rules những lệnh đọc đó sẽ bị từ chối. */
  useEffect(() => {
    (async () => {
      setPublicLoading(true);
      try {
        const [s, a] = await Promise.all([fetchPublicStats(), fetchAnnouncements()]);
        setStats(s);
        setAnnouncements(a);
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu công khai: ", err);
      } finally {
        setPublicLoading(false);
      }
    })();
  }, []);

  const loadAdminData = async () => {
    if (!user) return;
    setAdminLoading(true);
    try {
      const [subs, cls] = await Promise.all([fetchSubmissions(), fetchClasses()]);
      setSubmissions(subs);
      setClasses(cls);

      /* Làm mới số liệu trang chủ. Khách vãng lai không có quyền ghi, nên đây
         là lần duy nhất public_stats được cập nhật — con số trên trang chủ trễ
         tới lần quản trị viên đăng nhập gần nhất. Đánh đổi có ý thức để khỏi
         phải dựng Cloud Functions cho một con số mang tính trưng bày. */
      if (user.role === "admin") {
        const fresh = computePublicStats(subs);
        await writePublicStats(fresh);
        setStats(fresh);
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu quản trị: ", err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Nạp dữ liệu quản trị khi đã đăng nhập và đang ở tab Quản trị.
  useEffect(() => {
    if (activeTab === "admin" && user) {
      loadAdminData();
    }
  }, [activeTab, user?.uid]);

  // Gửi khảo sát xong: SurveyForm đưa thẳng kết quả sang, không phải đọc lại Firestore.
  const handleSurveySuccess = (name: string, level: "L1" | "L2" | "L3") => {
    setLastSubmissionResult({ name, level });
    setShowSuccessModal(true);
  };

  // Đăng nhập thành công (gọi từ TeacherLogin). onAuthChange sẽ tự cập nhật user.
  const handleLoginSuccess = () => {
    setActiveTab("admin");
  };

  const handleLogout = async () => {
    await signOutUser();
    // Xóa dữ liệu quản trị khỏi bộ nhớ để người dùng sau không thấy được.
    setSubmissions([]);
    setClasses([]);
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
          isAdmin={!!user}
          onLogout={handleLogout}
        />

        {/* Khung nội dung chính */}
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {(publicLoading || !authReady) && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-11 h-11 border-[3px] border-brand-sky-deep border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-ink-3">Đang tải dữ liệu…</p>
          </div>
        )}

        {!publicLoading && authReady && (
          <div className="animate-fade-up">
            {activeTab === "home" && (
              <HomePortal
                onStartSurvey={() => setActiveTab("survey")}
                stats={stats}
              />
            )}

            {activeTab === "survey" && (
              <SurveyForm onSuccess={handleSurveySuccess} />
            )}

            {activeTab === "admin" && (
              user ? (
                adminLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="w-11 h-11 border-[3px] border-brand-sky-deep border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-ink-3">Đang tải dữ liệu quản trị…</p>
                  </div>
                ) : (
                  <AdminDashboard
                    submissions={submissions}
                    announcements={announcements}
                    classes={classes}
                    onRefreshData={loadAdminData}
                  />
                )
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
              <span>© 2026 Bệnh viện Đa khoa Hùng Vương</span>
              {/* Ghi công tác giả — nhẹ hơn một bậc so với dòng bản quyền phía trên */}
              <span className="text-[11.5px] text-ink-4">
                Designed &amp; developed by Nguyen Thanh Lam
              </span>
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
