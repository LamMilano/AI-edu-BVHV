import React, { useState } from "react";
import {
  Brain, Zap, Cpu, Award, FileText, Clock, MapPin,
  Calendar, ShieldAlert, Sparkles, ChevronRight, FileSpreadsheet, AppWindow, ArrowRight,
  Database, Activity, Server, ArrowUpRight
} from "lucide-react";
import HungVuongLogo from "./HungVuongLogo";

interface HomePortalProps {
  onStartSurvey: () => void;
}

export default function HomePortal({ onStartSurvey }: HomePortalProps) {
  const [selectedLevelTab, setSelectedLevelTab] = useState<"L1" | "L2" | "L3">("L1");

  const timetableL1 = [
    { time: "0-20 phút", type: "Lý thuyết + Demo", content: "7 khái niệm cốt lõi: LLM, Token, Context Window, Hallucination, Prompt, Dữ liệu AI, và Hỏi đáp vs Agent.", output: "Nắm vững 6 khái niệm nền; phân biệt được Hỏi/đáp và Agent" },
    { time: "20-40 phút", type: "Thực hành Chat", content: "Công thức TCREI (Task-Context-References-Evaluate-Iterate) trên việc thật và cấu hình Custom Instructions.", output: "1 Prompt TCREI tối ưu việc thật + Custom Instructions riêng" },
    { time: "40-60 phút", type: "Hỏi/đáp nguồn riêng", content: "Sử dụng GPT Custom/Gems bệnh viện và tải tài liệu lên NotebookLM để hỏi đáp có trích dẫn nguồn nội bộ.", output: "1 Gem cá nhân + 1 NotebookLM chứa tài liệu công việc" },
    { time: "60-85 phút", type: "AI cho Web", content: "Sử dụng AI tích hợp trong Chrome/Edge, Perplexity và công cụ Deep Research để tự động tổng hợp thông tin, kiểm chứng.", output: "1 Báo cáo nghiên cứu đã kiểm chứng và trích dẫn nguồn" },
    { time: "85-100 phút", type: "AI cho Office", content: "Ứng dụng AI thao tác trực tiếp trên Word/Docs (soạn thảo), Excel/Sheets (công thức, pivot) và PowerPoint/Slides.", output: "3 Công việc thực tế làm xong bằng AI trong bộ Office" },
    { time: "100-115 phút", type: "Thiết kế Slide", content: "Dùng Gamma.app thiết lập bộ slide nhanh chóng từ dàn ý và Napkin.ai tạo sơ đồ tư duy, infographic trực quan.", output: "1 Bộ slide nháp hoàn chỉnh từ tài liệu thực tế" }
  ];

  const timetableL2 = [
    { time: "0-15 phút", type: "Lý thuyết nền tảng", content: "Tư duy tự động hóa (Trigger → Xử lý → Kết quả). Khái niệm No-code/Low-code/API và nhận diện quy trình lặp.", output: "Xác định chính xác 1 quy trình lặp tại khoa để tự động hóa" },
    { time: "15-65 phút", type: "Thực hành trọng tâm", content: "Kết hợp Google Apps Script + Gemini. Ứng dụng Gemini viết code, sau đó chuyển cấu hình chạy trực tiếp trên Sheets/Forms.", output: "1 Workflow Apps Script hoạt động thực tế trên Sheets/Forms của khoa" },
    { time: "65-105 phút", type: "Tính năng trả phí", content: "Khai thác các tính năng cao cấp của AI trả phí: long context, phân tích file lớn, tạo ảnh chuyên sâu và tạo AI agent nâng cao.", output: "Danh sách tính năng hữu ích được cấu hình thử nghiệm thành công" }
  ];

  const timetableL3 = [
    { time: "0-20 phút", type: "Lý thuyết nền tảng", content: "Hiểu bản chất của Vibe Coding và ranh giới khả thi của prompt-to-app. Cấu trúc triển khai hệ thống, mô hình LLM API.", output: "Hiểu kỳ vọng thực tế và định hình được ranh giới ứng dụng" },
    { time: "20-75 phút", type: "Thực hành trọng tâm", content: "Ứng dụng Prompt-to-App: mô tả yêu cầu chi tiết để sinh mã nguồn giao diện & chức năng. Kết nối dữ liệu và deploy tạo link chia sẻ.", output: "1 ứng dụng web chạy thực tế phục vụ chuyên môn + Link chia sẻ" }
  ];

  return (
    <div className="space-y-12 pb-16">

      {/* FUTURISTIC HERO BANNER WITH AI STATUS BOARD */}
      <section className="relative overflow-hidden bg-slate-950 text-white p-8 sm:p-12 md:p-16 rounded-3xl border border-slate-800 shadow-2xl">
        {/* Subtle grid decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#121b2e_1px,transparent_1px),linear-gradient(to_bottom,#121b2e_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] opacity-40" />

        {/* Dynamic glowing radial backgrounds */}
        <div className="absolute -top-12 -left-12 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

        <div className="relative grid lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
          {/* Hero text */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <HungVuongLogo variant="dark" size="lg" className="mb-2 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-xs w-fit shadow-inner" />

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-sm font-semibold text-blue-400 tracking-wide">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-blue-400" />
              <span>Chương trình Đào tạo AI Nội bộ</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight leading-tight">
              Đào tạo - Chia sẻ <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                AI TRONG Y TẾ

              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl font-sans font-light leading-relaxed">
              Giải pháp tối ưu hóa thời gian nghiên cứu tài liệu, soạn thảo văn bản, và tự động hóa quy trình nội bộ bệnh viện. Làm khảo sát chẩn đoán năng lực của bạn trong 2 phút để xếp lớp tối ưu.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3.5">
              <button
                id="hero-start-survey"
                onClick={onStartSurvey}
                className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                Đăng ký tham gia khóa học
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#curriculum-section"
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Xem chi tiết lịch học
              </a>
            </div>
          </div>

          {/* AI Status Monitor Widget */}
          <div className="lg:col-span-5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">AI DIAGNOSTIC TERMINAL</span>
              </div>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-md text-slate-300 font-mono">v1.2.6</span>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3 text-sm font-mono">
                <span className="text-slate-400">Trạng thái hệ thống</span>
                <span className="text-emerald-400 font-bold text-right">HOẠT ĐỘNG (SẴN SÀNG)</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm font-mono">
                <span className="text-slate-400">Trí tuệ nhân lực</span>
                <span className="text-blue-400 font-bold text-right">Khảo sát Phân lớp</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm font-mono">
                <span className="text-slate-400">Mô hình phân loại</span>
                <span className="text-purple-400 font-bold text-right">Gemini Clinical Scoring</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm font-mono">
                <span className="text-slate-400">Khung đào tạo chính</span>
                <span className="text-slate-200 text-right">Level 1 | Level 2 | Level 3</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* CORE OBJECTIVES & GENERAL DESIGN PRINCIPLES */}
      <section className="grid md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-lg shadow-black/20 flex flex-col gap-4 hover:border-slate-700 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Sử dụng AI An Toàn & Bảo Mật</h3>
            <p className="text-base text-slate-300 mt-1.5 leading-relaxed">
              Chuẩn hóa quy tắc sử dụng AI an toàn, nghiêm cấm tiết lộ thông tin bệnh nhân và bảo mật tối đa dữ liệu nghiệp vụ của bệnh viện.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-lg shadow-black/20 flex flex-col gap-4 hover:border-slate-700 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Thực Hành Trên Việc Thật</h3>
            <p className="text-base text-slate-300 mt-1.5 leading-relaxed">
              Học viên mang theo công việc hàng ngày của chính khoa/phòng mình để thực hành giải quyết ngay tại lớp học, không dùng case study mẫu.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800/80 shadow-lg shadow-black/20 flex flex-col gap-4 hover:border-slate-700 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Tỷ Lệ Thực Hành Vượt Trội (30/70)</h3>
            <p className="text-base text-slate-300 mt-1.5 leading-relaxed">
              Lý thuyết tinh giản tối đa (chiếm 30% thời lượng). Dành trọn vẹn 70% thời gian thực hành tương tác trực tiếp trên máy tính.
            </p>
          </div>
        </div>
      </section>

      {/* THREE TRAINING LEVELS (BENTO CARDS) WITH LUXURY ACCENTS */}
      <section id="curriculum-section" className="space-y-6">
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-black text-white tracking-tight">Chương Trình Đào Tạo Phân Cấp</h2>
          <p className="text-base text-slate-300 mt-1">
            Chương trình được thiết kế thành 3 cấp độ phù hợp cho mọi đối tượng từ chưa có kinh nghiệm đến chuyên sâu.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEVEL 1 CARD */}
          <div className="bg-slate-900 rounded-3xl border border-slate-850 p-6 shadow-xl flex flex-col justify-between hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-sm font-semibold uppercase tracking-wider">
                  Cấp Độ 1
                </span>
                <span className="text-sm text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-4 h-4" /> 120 phút
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors flex items-center justify-between">
                  Daily Work AI
                  <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </h3>
                <p className="text-sm text-blue-400 mt-0.5 font-semibold">AI cho công việc hàng ngày</p>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <p className="text-sm font-bold text-slate-200">Bộ công cụ cốt lõi:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["ChatGPT/Gemini", "NotebookLM", "Gems", "Office AI", "Gamma/Napkin"].map((tool) => (
                    <span key={tool} className="text-sm px-2.5 py-1 bg-slate-950 text-slate-300 rounded-lg border border-slate-850 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-6">
              <button
                onClick={() => {
                  setSelectedLevelTab("L1");
                  document.getElementById("agenda-tab")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-2.5 bg-slate-950 border border-slate-850 group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:text-white rounded-xl text-sm font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-inner"
              >
                Xem chi tiết lịch học
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* LEVEL 2 CARD */}
          <div className="bg-slate-900 rounded-3xl border border-slate-850 p-6 shadow-xl flex flex-col justify-between hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-sm font-semibold uppercase tracking-wider">
                  Cấp Độ 2
                </span>
                <span className="text-sm text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-4 h-4" /> 120 phút
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors flex items-center justify-between">
                  AI Automation
                  <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </h3>
                <p className="text-sm text-indigo-400 mt-0.5 font-semibold">Lớp Builders - Tự động hóa</p>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <p className="text-sm font-bold text-slate-200">Bộ công cụ cốt lõi:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Apps Script", "Gemini API", "Google Sheet", "Google Form", "AI Trả Phí"].map((tool) => (
                    <span key={tool} className="text-sm px-2.5 py-1 bg-slate-950 text-slate-300 rounded-lg border border-slate-850 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-6">
              <button
                onClick={() => {
                  setSelectedLevelTab("L2");
                  document.getElementById("agenda-tab")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-2.5 bg-slate-950 border border-slate-850 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:text-white rounded-xl text-sm font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-inner"
              >
                Xem chi tiết lịch học
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* LEVEL 3 CARD */}
          <div className="bg-slate-900 rounded-3xl border border-slate-850 p-6 shadow-xl flex flex-col justify-between hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/5 transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-sm font-semibold uppercase tracking-wider">
                  Cấp Độ 3
                </span>
                <span className="text-sm text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-4 h-4" /> 120 phút
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors flex items-center justify-between">
                  Vibe Coding
                  <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </h3>
                <p className="text-sm text-purple-400 mt-0.5 font-semibold">Lớp Creators - Tạo ứng dụng</p>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <p className="text-sm font-bold text-slate-200">Bộ công cụ cốt lõi:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Prompt-to-App", "LLM API/Local", "Web Deploy", "App Sharing", "DB Integration"].map((tool) => (
                    <span key={tool} className="text-sm px-2.5 py-1 bg-slate-950 text-slate-300 rounded-lg border border-slate-850 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-6">
              <button
                onClick={() => {
                  setSelectedLevelTab("L3");
                  document.getElementById("agenda-tab")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full py-2.5 bg-slate-950 border border-slate-850 group-hover:bg-purple-600 group-hover:border-purple-500 group-hover:text-white rounded-xl text-sm font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-inner"
              >
                Xem chi tiết lịch học
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* DETAILED INTERACTIVE TIMETABLE/AGENDA */}
      <section id="agenda-tab" className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Chi Tiết Lịch Trình Buổi Học</h3>
            <p className="text-sm text-slate-300">Bấm chọn từng cấp độ bên dưới để xem khung giờ chi tiết và kết quả đầu ra mong đợi.</p>
          </div>
          <div className="flex rounded-xl bg-slate-950 p-1 self-start sm:self-center border border-slate-800">
            {(["L1", "L2", "L3"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevelTab(lvl)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${selectedLevelTab === lvl
                  ? "bg-slate-900 text-blue-400 border border-slate-800 shadow-lg"
                  : "text-slate-400 hover:text-white"
                  }`}
              >
                {lvl === "L1" ? "Level 1 (120p)" : lvl === "L2" ? "Level 2 (120p)" : "Level 3 (120p)"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800">
                <th className="px-4 py-3.5 w-24">Thời gian</th>
                <th className="px-4 py-3.5 w-32">Dạng bài</th>
                <th className="px-6 py-3.5">Nội dung học tập</th>
                <th className="px-6 py-3.5">Sản phẩm đầu ra mong đợi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-base">
              {selectedLevelTab === "L1" && timetableL1.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-850/40 transition-colors">
                  <td className="px-4 py-4 font-mono font-bold text-blue-400 whitespace-nowrap">{row.time}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-semibold">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 leading-relaxed font-sans">{row.content}</td>
                  <td className="px-6 py-4 text-slate-300 font-sans italic">{row.output}</td>
                </tr>
              ))}
              {selectedLevelTab === "L2" && timetableL2.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-850/40 transition-colors">
                  <td className="px-4 py-4 font-mono font-bold text-indigo-400 whitespace-nowrap">{row.time}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-semibold">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 leading-relaxed font-sans">{row.content}</td>
                  <td className="px-6 py-4 text-slate-300 font-sans italic">{row.output}</td>
                </tr>
              ))}
              {selectedLevelTab === "L3" && timetableL3.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-850/40 transition-colors">
                  <td className="px-4 py-4 font-mono font-bold text-purple-400 whitespace-nowrap">{row.time}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-semibold">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 leading-relaxed font-sans">{row.content}</td>
                  <td className="px-6 py-4 text-slate-300 font-sans italic">{row.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


      </section>
    </div>
  );
}
