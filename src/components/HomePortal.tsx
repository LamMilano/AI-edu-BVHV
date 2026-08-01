import React, { useState } from "react";
import { ShieldAlert, Briefcase, Zap, ArrowRight } from "lucide-react";
import { SurveySubmission } from "../types";
import StudentStats from "./StudentStats";

interface HomePortalProps {
  onStartSurvey: () => void;
  submissions: SurveySubmission[];
}

type Level = "L1" | "L2" | "L3";

interface AgendaRow {
  time: string;
  type: string;
  content: string;
  output: string;
}

const LEVELS: {
  id: Level;
  num: string;
  name: string;
  tagline: string;
  tools: string[];
  rail: string;
  num_grad: string;
}[] = [
  {
    id: "L1",
    num: "01",
    name: "Daily Work AI",
    tagline: "AI cho công việc hằng ngày",
    tools: ["ChatGPT/Gemini", "NotebookLM", "Gems", "Office AI", "Gamma/Napkin"],
    rail: "from-lv1-light to-lv1",
    num_grad: "from-lv1 to-lv1-deep",
  },
  {
    id: "L2",
    num: "02",
    name: "AI Automation",
    tagline: "Tự động hoá quy trình lặp",
    tools: ["Apps Script", "Gemini API", "Google Sheet", "Google Form", "AI trả phí"],
    rail: "from-lv2-light to-lv2-deep",
    num_grad: "from-lv2-light to-lv2-deep",
  },
  {
    id: "L3",
    num: "03",
    name: "Vibe Coding",
    tagline: "Tự dựng ứng dụng chuyên môn",
    tools: ["Prompt-to-App", "LLM API", "Web Deploy", "Chia sẻ ứng dụng", "Kết nối CSDL"],
    rail: "from-lv3-light to-lv3-deep",
    num_grad: "from-lv3-light to-lv3-deep",
  },
];

const AGENDA: Record<Level, AgendaRow[]> = {
  L1: [
    { time: "0–20′", type: "Lý thuyết", content: "Bảy khái niệm cốt lõi: LLM, token, cửa sổ ngữ cảnh, ảo giác, prompt, dữ liệu AI, và phân biệt hỏi/đáp với agent.", output: "Phân biệt được hỏi/đáp và agent" },
    { time: "20–40′", type: "Thực hành", content: "Công thức TCREI (Task–Context–References–Evaluate–Iterate) áp lên một việc thật, và cấu hình Custom Instructions.", output: "1 prompt TCREI + bộ Custom Instructions riêng" },
    { time: "40–60′", type: "Thực hành", content: "Dùng Gems/GPT riêng của bệnh viện và tải tài liệu lên NotebookLM để hỏi đáp có trích dẫn nguồn nội bộ.", output: "1 Gem cá nhân + 1 NotebookLM chứa tài liệu công việc" },
    { time: "60–85′", type: "Thực hành", content: "AI tích hợp trong Chrome/Edge, Perplexity và công cụ Deep Research để tổng hợp và kiểm chứng thông tin.", output: "1 báo cáo đã kiểm chứng, có trích dẫn nguồn" },
    { time: "85–100′", type: "Thực hành", content: "AI thao tác trực tiếp trên Word/Docs (soạn thảo), Excel/Sheets (công thức, pivot) và PowerPoint/Slides.", output: "3 việc thực tế làm xong bằng AI trong bộ Office" },
    { time: "100–115′", type: "Thực hành", content: "Dùng Gamma.app dựng bộ slide từ dàn ý, và Napkin.ai tạo sơ đồ tư duy, infographic trực quan.", output: "1 bộ slide nháp hoàn chỉnh từ tài liệu thực tế" },
  ],
  L2: [
    { time: "0–15′", type: "Lý thuyết", content: "Tư duy tự động hoá (kích hoạt → xử lý → kết quả). Khái niệm no-code/low-code/API và cách nhận diện quy trình lặp.", output: "Xác định 1 quy trình lặp tại khoa để tự động hoá" },
    { time: "15–65′", type: "Thực hành", content: "Kết hợp Google Apps Script với Gemini: dùng Gemini viết mã, rồi cấu hình chạy trực tiếp trên Sheets/Forms.", output: "1 workflow Apps Script chạy thật trên Sheets/Forms của khoa" },
    { time: "65–105′", type: "Thực hành", content: "Khai thác tính năng cao cấp của AI trả phí: ngữ cảnh dài, phân tích tệp lớn, tạo ảnh chuyên sâu, agent nâng cao.", output: "Danh sách tính năng hữu ích đã cấu hình thử thành công" },
  ],
  L3: [
    { time: "0–20′", type: "Lý thuyết", content: "Bản chất của vibe coding và ranh giới khả thi của prompt-to-app. Cấu trúc triển khai hệ thống và mô hình LLM API.", output: "Định hình được kỳ vọng và ranh giới ứng dụng thực tế" },
    { time: "20–75′", type: "Thực hành", content: "Mô tả yêu cầu chi tiết để sinh mã giao diện và chức năng, kết nối dữ liệu, rồi triển khai tạo link chia sẻ.", output: "1 ứng dụng web chạy thật phục vụ chuyên môn + link chia sẻ" },
  ],
};

const PRINCIPLES = [
  {
    icon: ShieldAlert,
    grad: "from-[#FF6B60] to-danger",
    title: "An toàn dữ liệu bệnh nhân",
    desc: "Quy tắc bắt buộc: không đưa thông tin định danh người bệnh vào bất kỳ công cụ AI nào.",
  },
  {
    icon: Briefcase,
    grad: "from-lv1-light to-lv1-deep",
    title: "Thực hành trên việc thật",
    desc: "Học viên mang công việc của chính khoa mình lên lớp, không dùng tình huống mẫu.",
  },
  {
    icon: Zap,
    grad: "from-ok-light to-ok",
    title: "30% lý thuyết · 70% thực hành",
    desc: "Mỗi phần đều kết thúc bằng một sản phẩm bạn mang về dùng được ngay.",
  },
];

export default function HomePortal({ onStartSurvey, submissions }: HomePortalProps) {
  const [selectedLevel, setSelectedLevel] = useState<Level>("L1");

  const openAgenda = (lvl: Level) => {
    setSelectedLevel(lvl);
    document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-14 pb-6">
      {/* ══ HERO ══ */}
      <section className="pt-6 sm:pt-10">
        <span className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-brand-navy bg-gradient-to-b from-white/95 to-white/70 border border-brand-navy/20 shadow-[0_4px_12px_-6px_rgb(20_51_110/0.4)]">
          <span className="w-2.5 h-2.5 rotate-45 rounded-[2px] bg-gradient-to-br from-brand-sky to-brand-navy" />
          Chương trình đào tạo nội bộ · 2026
        </span>

        <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-[-0.035em] leading-[1.06]">
          Đào tạo & chia sẻ <span className="text-grad">AI nội bộ</span>
        </h1>

        <p className="mt-4 max-w-xl text-[16px] sm:text-[16.5px] leading-relaxed text-ink-3">
          Rút ngắn thời gian tra cứu tài liệu, soạn thảo văn bản và tự động hoá quy trình khoa phòng.
          Làm khảo sát 2 phút để hệ thống xếp bạn vào đúng cấp độ.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <button
            id="hero-start-survey"
            onClick={onStartSurvey}
            className="btn-primary px-6 py-3.5 text-[15px] flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            Đăng ký tham gia
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href="#agenda"
            className="btn-secondary px-5 py-3.5 text-[15px] flex items-center justify-center"
          >
            Xem lịch học
          </a>
        </div>

        {/* ══ THÔNG TIN HỌC VIÊN — đặt ngay dưới nút đăng ký để người xem thấy
            ai đã tham gia trước khi quyết định. Chỉ số liệu tổng hợp, không có
            tên/liên hệ của ai. Dùng chung component với bảng Quản trị. ══ */}
        <div className="mt-10 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-extrabold tracking-tight">Thông tin học viên</h2>
            <span className="text-[12.5px] text-ink-3">Tổng hợp từ các khảo sát đã gửi</span>
          </div>
          <StudentStats submissions={submissions} />
        </div>

        {/* Ba con số thật — thay cho widget trạng thái hệ thống hiển thị dữ liệu cứng */}
        <div className="mt-11 surface grid grid-cols-1 sm:grid-cols-3 overflow-hidden">
          {[
            { n: "03", unit: "", l: "cấp độ, từ dùng AI hằng ngày đến xây dựng ứng dụng" },
            { n: "120", unit: " phút", l: "mỗi buổi, học trên máy tính cá nhân" },
            { n: "70", unit: "%", l: "thời lượng là thực hành trên việc thật của khoa bạn" },
          ].map((f, i) => (
            <div
              key={f.l}
              className={`p-5 sm:p-6 ${i < 2 ? "border-b sm:border-b-0 sm:border-r border-line-soft" : ""}`}
            >
              <div className="text-3xl font-extrabold tracking-[-0.04em] leading-none tnum text-grad">
                {f.n}
                {f.unit && <span className="text-[17px] font-bold">{f.unit}</span>}
              </div>
              <p className="mt-2 text-[13px] leading-snug text-ink-3">{f.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ NGUYÊN TẮC — dải nhẹ, không phải ba thẻ nặng ══ */}
      <section className="grid md:grid-cols-3 gap-7 py-8 border-y border-brand-navy/15">
        {PRINCIPLES.map((p) => (
          <div key={p.title}>
            <h3 className="flex items-center gap-2.5 text-[15px] font-extrabold tracking-tight">
              <span className={`w-3.5 h-3.5 rotate-45 rounded-[2px] flex-none bg-gradient-to-br ${p.grad}`} />
              {p.title}
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{p.desc}</p>
          </div>
        ))}
      </section>

      {/* ══ BA CẤP ĐỘ ══ */}
      <section>
        <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-[-0.025em]">Ba cấp độ</h2>
        <p className="mt-1.5 text-[14.5px] text-ink-3">
          Khảo sát sẽ tự xếp bạn vào một trong ba, nhưng bạn có quyền chọn khác.
        </p>

        <div className="mt-5 grid lg:grid-cols-3 gap-4">
          {LEVELS.map((lv) => (
            <div key={lv.id} className="surface cut-corner relative overflow-hidden p-6 flex flex-col">
              <span className={`absolute top-0 left-0 bottom-0 w-[5px] bg-gradient-to-b ${lv.rail}`} />

              <div className="flex items-baseline gap-3">
                <span
                  className={`text-4xl font-extrabold leading-[0.9] tracking-[-0.04em] bg-gradient-to-br ${lv.num_grad} bg-clip-text text-transparent`}
                >
                  {lv.num}
                </span>
                <div>
                  <h3 className="text-[18px] font-extrabold tracking-[-0.02em] leading-tight">{lv.name}</h3>
                  <p className="text-[13px] text-ink-3 mt-0.5">{lv.tagline}</p>
                </div>
              </div>

              <div className="h-px my-4 bg-gradient-to-r from-line to-transparent" />

              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-ink-4">Công cụ</span>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {lv.tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-[4px] px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-navy bg-gradient-to-b from-[#F2F7FC] to-[#E4EEF8]"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-5 flex items-center justify-between">
                <span className="text-[13px] text-ink-3 tnum">
                  120 phút · {AGENDA[lv.id].length} phần
                </span>
                <button
                  onClick={() => openAgenda(lv.id)}
                  className="text-[13.5px] font-bold text-brand-navy hover:text-brand-sky-deep transition-colors cursor-pointer"
                >
                  Lịch học →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ LỊCH TRÌNH — dòng thời gian 2 cột, xếp dọc được trên điện thoại ══ */}
      <section id="agenda" className="scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-[-0.025em]">Lịch trình buổi học</h2>
            <p className="mt-1.5 text-[14.5px] text-ink-3">
              Từng mốc thời gian và sản phẩm bạn mang về sau mỗi mốc.
            </p>
          </div>

          <div
            role="tablist"
            className="inline-flex self-start rounded-field p-[3px] gap-0.5 bg-gradient-to-b from-[#E8F0F9] to-[#DCE8F4]"
          >
            {LEVELS.map((lv) => (
              <button
                key={lv.id}
                role="tab"
                aria-selected={selectedLevel === lv.id}
                onClick={() => setSelectedLevel(lv.id)}
                className={`px-4 py-2 rounded-[7px] text-[13px] font-bold transition-all cursor-pointer ${
                  selectedLevel === lv.id
                    ? "bg-gradient-to-b from-white to-[#F6FAFD] text-brand-navy shadow-[0_2px_6px_-2px_rgb(20_51_110/0.3)]"
                    : "text-ink-3 hover:text-ink"
                }`}
              >
                Cấp độ {lv.num.replace("0", "")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 surface p-5 sm:p-7">
          {AGENDA[selectedLevel].map((row, i) => (
            <div
              key={row.time}
              className={`grid grid-cols-1 sm:grid-cols-[96px_1fr] gap-2 sm:gap-5 py-5 ${
                i > 0 ? "border-t border-line-soft" : "pt-0"
              }`}
            >
              <div className="sm:pt-0.5">
                <div className="text-[13px] font-bold text-brand-navy tnum">{row.time}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-4 mt-1">
                  {row.type}
                </div>
              </div>

              <div>
                <p className="text-[14px] leading-relaxed text-ink-2">{row.content}</p>
                <div className="mt-2.5 inline-flex items-start gap-2 rounded-r-[6px] border-l-[3px] border-ok bg-gradient-to-br from-ok/12 to-ok/5 px-3 py-2">
                  <span className="mt-[5px] w-2 h-2 rotate-45 rounded-[1px] flex-none bg-gradient-to-br from-ok-light to-ok" />
                  <span className="text-[13px] leading-snug text-ok-deep">{row.output}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
