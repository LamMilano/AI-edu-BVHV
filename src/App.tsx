import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./lib/firebase";
import { seedInitialData } from "./lib/seed";
import { SurveySubmission, Announcement, ClassSession } from "./types";
import Navigation from "./components/Navigation";
import HomePortal from "./components/HomePortal";
import SurveyForm from "./components/SurveyForm";
import AdminDashboard from "./components/AdminDashboard";
import { CheckCircle2, Award, ArrowRight, GraduationCap, Calendar, Sparkles } from "lucide-react";
import HungVuongLogo from "./components/HungVuongLogo";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "survey" | "admin">("home");
  const [isAdmin, setIsAdmin] = useState(false);
  
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
      />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Đang đồng bộ hóa dữ liệu từ hệ thống...</p>
          </div>
        )}

        {!loading && (
          <div className="space-y-8 animate-fade-in">
            {activeTab === "home" && (
              <HomePortal
                onStartSurvey={() => setActiveTab("survey")}
              />
            )}

            {activeTab === "survey" && (
              <SurveyForm onSuccess={handleSurveySuccess} />
            )}

            {activeTab === "admin" && (
              <AdminDashboard
                submissions={submissions}
                announcements={announcements}
                classes={classes}
                onRefreshData={loadFirestoreData}
              />
            )}
          </div>
        )}
      </main>

      {/* SUCCESS POPUP MODAL */}
      {showSuccessModal && lastSubmissionResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 animate-scale-up">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-md border border-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Gửi Khảo Sát Thành Công!</span>
              <h3 className="text-xl font-extrabold text-white mt-1">Cảm ơn, {lastSubmissionResult.name}!</h3>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed font-sans">
              Hệ thống đã ghi nhận đầy đủ câu trả lời của bạn. Dựa trên thông tin khảo sát, bạn được xếp vào lớp:
            </p>

            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex flex-col items-center gap-2">
              <Award className="w-8 h-8 text-blue-400 animate-pulse" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Khuyên dùng đào tạo</span>
              <span className="text-lg font-black text-white">
                {lastSubmissionResult.level === "L1" 
                  ? "Level 1: Daily Work AI" 
                  : lastSubmissionResult.level === "L2" 
                  ? "Level 2: AI Automation" 
                  : "Level 3: Vibe Coding"}
              </span>
            </div>

            <div className="pt-2">
              <button
                id="btn-modal-close"
                onClick={() => {
                  setShowSuccessModal(false);
                  setLastSubmissionResult(null);
                  setActiveTab("home");
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/10"
              >
                Về trang chủ chương trình
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant minimalist Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <HungVuongLogo showSlogan={false} size="sm" variant="dark" />
            <span>•</span>
            <span>© 2026 Cổng Quản Lý & Đào Tạo AI Nội Bộ Bệnh Viện Hùng Vương.</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-300 cursor-pointer">Chính sách bảo mật</span>
            <span>•</span>
            <span className="hover:text-slate-300 cursor-pointer">Hướng dẫn sử dụng AI an toàn</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
