import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SurveySubmission } from "../types";
import { 
  FileText, User, Mail, Phone, Building2, Brain, CheckSquare, 
  Clock, Calendar, Award, Sparkles, Send, CheckCircle2, ChevronRight, ChevronLeft 
} from "lucide-react";

interface SurveyFormProps {
  onSuccess: () => void;
}

export default function SurveyForm({ onSuccess }: SurveyFormProps) {
  // Wizard Step State
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    score: number;
    assignedLevel: "L1" | "L2" | "L3";
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    studentName: "",
    department: "",
    email: "",
    phone: "",
    q1_tools: [] as string[],
    q2_paid: [] as string[],
    q3_frequency: "Chưa bao giờ",
    q4_past_tasks: [] as string[],
    q5_concepts: [] as string[],
    q6_coding_exp: "Không có",
    q7_goals: [] as string[],
    q8_orientation: "Chỉ cần AI hỗ trợ công việc",
    q9_repetitive_tasks: "",
    q10_timeframe: [] as string[],
    q11_days: [] as string[],
    q12_duration: "120 phút"
  });

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper arrays for options
  const toolOptions = ["ChatGPT", "Gemini", "Copilot", "NotebookLM", "Chưa dùng bao giờ", "Khác"];
  const paidOptions = ["Chưa trả phí cho công cụ nào", "ChatGPT Plus", "Gemini Advanced", "Copilot Pro", "Khác"];
  const frequencyOptions = ["Chưa bao giờ", "Thỉnh thoảng", "Hàng tuần", "Hàng ngày"];
  const pastTaskOptions = [
    "Viết prompt có cấu trúc",
    "Tạo GPT/Gem riêng",
    "Dùng NotebookLM có trích dẫn",
    "Dùng AI trong Office (Word/Excel/PowerPoint)",
    "Viết code hoặc Apps Script",
    "Xây app/tool nhỏ"
  ];
  const conceptOptions = ["LLM", "Token", "Context window", "Hallucination", "Prompt", "Agent"];
  const codingExpOptions = ["Không có", "Biết cơ bản (đọc/sửa code)", "Thành thạo >= 1 ngôn ngữ"];
  const goalOptions = [
    "Dùng AI cho công việc hàng ngày (L1)",
    "Tự động hóa quy trình lặp (L2)",
    "Tự xây tool/app (L3)"
  ];
  const orientationOptions = [
    "Chỉ cần AI hỗ trợ công việc",
    "Muốn trở thành người xây workflow",
    "Muốn tạo công cụ nội bộ"
  ];
  const timeframeOptions = ["Sáng", "Chiều", "Tối", "Trong giờ hành chính", "Ngoài giờ"];
  const dayOptions = ["T2", "T3", "T4", "T5", "T6", "T7"];

  // Handle Input Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  // Handle Multi-checkboxes
  const handleCheckboxChange = (name: "q1_tools" | "q2_paid" | "q4_past_tasks" | "q5_concepts" | "q7_goals" | "q10_timeframe" | "q11_days", option: string) => {
    setFormData(prev => {
      const current = prev[name] as string[];
      let updated: string[];

      if (option === "Chưa dùng bao giờ" && name === "q1_tools") {
        updated = ["Chưa dùng bao giờ"];
      } else if (option === "Chưa trả phí cho công cụ nào" && name === "q2_paid") {
        updated = ["Chưa trả phí cho công cụ nào"];
      } else {
        // filter out clear all options
        let temp = current.filter(item => item !== "Chưa dùng bao giờ" && item !== "Chưa trả phí cho công cụ nào");
        if (temp.includes(option)) {
          updated = temp.filter(item => item !== option);
        } else {
          updated = [...temp, option];
        }
      }

      return { ...prev, [name]: updated };
    });
  };

  // Calculate Placement Score & Level
  const calculateResult = () => {
    let score = 0;

    // 1. Q1 Tools (Max 15 pts)
    if (!formData.q1_tools.includes("Chưa dùng bao giờ")) {
      score += formData.q1_tools.length * 3;
    }

    // 2. Q2 Paid (Max 15 pts)
    if (!formData.q2_paid.includes("Chưa trả phí cho công cụ nào")) {
      score += formData.q2_paid.length * 5;
    }

    // 3. Q3 Frequency (Max 15 pts)
    if (formData.q3_frequency === "Thỉnh thoảng") score += 5;
    else if (formData.q3_frequency === "Hàng tuần") score += 10;
    else if (formData.q3_frequency === "Hàng ngày") score += 15;

    // 4. Q4 Past Tasks (Max 25 pts)
    formData.q4_past_tasks.forEach(task => {
      if (task === "Viết prompt có cấu trúc") score += 4;
      if (task === "Tạo GPT/Gem riêng") score += 4;
      if (task === "Dùng NotebookLM có trích dẫn") score += 4;
      if (task === "Dùng AI trong Office (Word/Excel/PowerPoint)") score += 4;
      if (task === "Viết code hoặc Apps Script") score += 6;
      if (task === "Xây app/tool nhỏ") score += 8;
    });

    // 5. Q5 Concepts (Max 15 pts)
    score += formData.q5_concepts.length * 2.5;

    // 6. Q6 Coding Exp (Max 15 pts)
    if (formData.q6_coding_exp === "Biết cơ bản (đọc/sửa code)") score += 8;
    else if (formData.q6_coding_exp === "Thành thạo >= 1 ngôn ngữ") score += 15;

    // Clamp score to 100
    const finalScore = Math.min(Math.round(score), 100);

    // Level Assignment Logic
    let assignedLevel: "L1" | "L2" | "L3" = "L1";
    
    // Check key signals or scores
    const hasCodingOrAutomation = 
      formData.q4_past_tasks.includes("Viết code hoặc Apps Script") || 
      formData.q4_past_tasks.includes("Xây app/tool nhỏ") || 
      formData.q6_coding_exp === "Thành thạo >= 1 ngôn ngữ";

    if (hasCodingOrAutomation || finalScore >= 45) {
      assignedLevel = "L3";
    } else if (finalScore >= 18 || formData.q4_past_tasks.length > 0 || formData.q6_coding_exp.includes("Biết cơ bản")) {
      assignedLevel = "L2";
    } else {
      assignedLevel = "L1";
    }

    return { score: finalScore, assignedLevel };
  };

  // Validate Step 1
  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.studentName.trim()) newErrors.studentName = "Vui lòng nhập họ và tên";
    if (!formData.department.trim()) newErrors.department = "Vui lòng nhập Khoa/Phòng làm việc";
    if (!formData.email.trim() || !formData.email.includes("@")) newErrors.email = "Vui lòng nhập email hợp lệ";
    if (!formData.phone.trim()) newErrors.phone = "Vui lòng nhập số điện thoại hoặc Zalo";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate Step 3
  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.q9_repetitive_tasks.trim()) {
      newErrors.q9_repetitive_tasks = "Vui lòng mô tả ngắn gọn công việc lặp lại muốn cải thiện";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (validateStep3()) {
        const result = calculateResult();
        setSubmittedResult(result);
        setStep(4);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  const handleSubmit = async () => {
    if (!submittedResult) return;
    setSubmitting(true);

    try {
      const submission: SurveySubmission = {
        studentName: formData.studentName,
        department: formData.department,
        email: formData.email,
        phone: formData.phone,
        score: submittedResult.score,
        assignedLevel: submittedResult.assignedLevel,
        answers: {
          q1_tools: formData.q1_tools,
          q2_paid: formData.q2_paid,
          q3_frequency: formData.q3_frequency,
          q4_past_tasks: formData.q4_past_tasks,
          q5_concepts: formData.q5_concepts,
          q6_coding_exp: formData.q6_coding_exp,
          q7_goals: formData.q7_goals,
          q8_orientation: formData.q8_orientation,
          q9_repetitive_tasks: formData.q9_repetitive_tasks,
          q10_timeframe: formData.q10_timeframe,
          q11_days: formData.q11_days,
          q12_duration: formData.q12_duration
        },
        submittedAt: serverTimestamp()
      };

      await addDoc(collection(db, "survey_submissions"), submission);
      setSubmitting(false);
      onSuccess(); // Triggers success modal/view
    } catch (err) {
      console.error("Lỗi khi gửi kết quả khảo sát: ", err);
      setSubmitting(false);
      alert("Đã xảy ra lỗi khi lưu kết quả. Vui lòng kiểm tra kết nối mạng và thử lại.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      
      {/* Header Wizard indicator */}
      <div className="bg-slate-950 px-6 py-6 sm:px-8 text-white border-b border-slate-850">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-bold">Khảo Sát Phân Loại Lớp Học</h2>
            <p className="text-xs text-slate-400 mt-0.5">Xác định trình độ tối ưu để phân lớp và chuẩn bị hậu cần học tập hiệu quả.</p>
          </div>
        </div>

        {/* STEPPER METRIC */}
        <div className="flex items-center gap-2 mt-6">
          {[
            { label: "Thông tin", num: 1 },
            { label: "Nhận thức AI", num: 2 },
            { label: "Nhu cầu học", num: 3 },
            { label: "Kết quả", num: 4 }
          ].map((st) => (
            <React.Fragment key={st.num}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  step === st.num 
                    ? "bg-blue-600 text-white shadow-lg" 
                    : step > st.num 
                    ? "bg-emerald-500 text-white" 
                    : "bg-slate-800 text-slate-400"
                }`}>
                  {step > st.num ? <CheckCircle2 className="w-4.5 h-4.5" /> : st.num}
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${
                  step === st.num ? "text-blue-400" : step > st.num ? "text-emerald-400" : "text-slate-500"
                }`}>
                  {st.label}
                </span>
              </div>
              {st.num < 4 && <div className={`flex-1 h-0.5 min-w-[12px] ${step > st.num ? "bg-emerald-500" : "bg-slate-800"}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* FORM CORE */}
      <div className="p-6 sm:p-8 space-y-6">

        {/* STEP 1: PERSONAL INFORMATION */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Phần A: Thông Tin Học Viên
              </h3>
              <p className="text-xs text-slate-400">Vui lòng điền đúng thông tin để ban tổ chức liên lạc xếp lịch học.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Họ và tên</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="input-name"
                    type="text"
                    name="studentName"
                    value={formData.studentName}
                    onChange={handleChange}
                    placeholder="Nguyễn Văn A"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-950 text-white placeholder-slate-600 ${
                      errors.studentName ? "border-red-500/50 focus:ring-red-900/50" : "border-slate-800 focus:ring-blue-900/40 focus:border-blue-500"
                    } focus:outline-none focus:ring-3 text-sm transition-all`}
                  />
                </div>
                {errors.studentName && <span className="text-xs text-red-400">{errors.studentName}</span>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Khoa / Phòng / Ban</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="input-dept"
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="Khoa Khám bệnh / Phòng CNTT"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-950 text-white placeholder-slate-600 ${
                      errors.department ? "border-red-500/50 focus:ring-red-900/50" : "border-slate-800 focus:ring-blue-900/40 focus:border-blue-500"
                    } focus:outline-none focus:ring-3 text-sm transition-all`}
                  />
                </div>
                {errors.department && <span className="text-xs text-red-400">{errors.department}</span>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Địa chỉ Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="input-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="nhanvien@benhvien.com"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-950 text-white placeholder-slate-600 ${
                      errors.email ? "border-red-500/50 focus:ring-red-900/50" : "border-slate-800 focus:ring-blue-900/40 focus:border-blue-500"
                    } focus:outline-none focus:ring-3 text-sm transition-all`}
                  />
                </div>
                {errors.email && <span className="text-xs text-red-400">{errors.email}</span>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">SĐT / Zalo</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-500" />
                  <input
                    id="input-phone"
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="0901234567"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-slate-950 text-white placeholder-slate-600 ${
                      errors.phone ? "border-red-500/50 focus:ring-red-900/50" : "border-slate-800 focus:ring-blue-900/40 focus:border-blue-500"
                    } focus:outline-none focus:ring-3 text-sm transition-all`}
                  />
                </div>
                {errors.phone && <span className="text-xs text-red-400">{errors.phone}</span>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: AI COGNITION & EXPERIENCE */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                Phần B: Mức Độ Nhận Thức & Ứng Dụng AI
              </h3>
              <p className="text-xs text-slate-400">Trả lời thành thật giúp chúng tôi ước lượng điểm kiến thức đầu vào để chọn đúng lớp đào tạo.</p>
            </div>

            {/* Q1: AI Tools Used */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">1. Bạn đã sử dụng công cụ AI nào? (Chọn nhiều)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {toolOptions.map((opt) => (
                  <button
                    id={`q1-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => handleCheckboxChange("q1_tools", opt)}
                    className={`p-3 text-left text-xs rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                      formData.q1_tools.includes(opt)
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    <CheckSquare className={`w-4 h-4 ${formData.q1_tools.includes(opt) ? "text-blue-400" : "text-slate-700"}`} />
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Paid AI tools */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">2. Bạn đang sử dụng bản CÓ TRẢ PHÍ của công cụ AI nào? (Chọn nhiều)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paidOptions.map((opt) => (
                  <button
                    id={`q2-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => handleCheckboxChange("q2_paid", opt)}
                    className={`p-3 text-left text-xs rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                      formData.q2_paid.includes(opt)
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    <CheckSquare className={`w-4 h-4 ${formData.q2_paid.includes(opt) ? "text-blue-400" : "text-slate-700"}`} />
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Frequency */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">3. Tần suất dùng AI cho công việc của bạn:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {frequencyOptions.map((opt) => (
                  <button
                    id={`q3-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, q3_frequency: opt }))}
                    className={`p-3 text-center text-xs rounded-xl border transition-all cursor-pointer ${
                      formData.q3_frequency === opt
                        ? "bg-blue-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q4: Work accomplished */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">4. Bạn đã từng tự làm các việc nào sau đây bằng AI? (Chọn nhiều)</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {pastTaskOptions.map((opt) => (
                  <button
                    id={`q4-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => handleCheckboxChange("q4_past_tasks", opt)}
                    className={`p-3 text-left text-xs rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                      formData.q4_past_tasks.includes(opt)
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    <CheckSquare className={`w-4 h-4 ${formData.q4_past_tasks.includes(opt) ? "text-blue-400" : "text-slate-700"}`} />
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q5: Known Concepts */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">5. Bạn hiểu khái niệm nào sau đây? (Chọn nhiều)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {conceptOptions.map((opt) => (
                  <button
                    id={`q5-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => handleCheckboxChange("q5_concepts", opt)}
                    className={`p-3 text-left text-xs rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                      formData.q5_concepts.includes(opt)
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    <CheckSquare className={`w-4 h-4 ${formData.q5_concepts.includes(opt) ? "text-blue-400" : "text-slate-700"}`} />
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q6: Coding Experience */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">6. Kinh nghiệm lập trình của bạn:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {codingExpOptions.map((opt) => (
                  <button
                    id={`q6-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, q6_coding_exp: opt }))}
                    className={`p-3 text-left text-xs rounded-xl border transition-all cursor-pointer ${
                      formData.q6_coding_exp === opt
                        ? "bg-blue-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: GOALS, TASKS & LOGISTICS */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Phần C & D: Nhu Cầu, Định Hướng & Hậu Cần
              </h3>
              <p className="text-xs text-slate-400">Mô tả chi tiết nhu cầu công việc để hỗ trợ chuẩn bị giáo trình sát thực nhất.</p>
            </div>

            {/* Q7: Desired Learning Level */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">7. Bạn mong muốn học lớp nào nhất? (Chọn nhiều)</label>
              <div className="grid grid-cols-1 gap-2">
                {goalOptions.map((opt) => (
                  <button
                    id={`q7-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => handleCheckboxChange("q7_goals", opt)}
                    className={`p-3.5 text-left text-xs rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                      formData.q7_goals.includes(opt)
                        ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    <CheckSquare className={`w-4 h-4 ${formData.q7_goals.includes(opt) ? "text-blue-400" : "text-slate-700"}`} />
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q8: Orientation */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-200 block">8. Định hướng sử dụng AI lâu dài của bạn:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {orientationOptions.map((opt) => (
                  <button
                    id={`q8-${opt}`}
                    key={opt}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, q8_orientation: opt }))}
                    className={`p-3 text-left text-xs rounded-xl border transition-all cursor-pointer ${
                      formData.q8_orientation === opt
                        ? "bg-blue-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-slate-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q9: Manual Repetitive Tasks Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-200 block">9. Công việc lặp lại nào bạn muốn cải thiện bằng AI? (mô tả ngắn)*</label>
              <textarea
                id="input-q9"
                name="q9_repetitive_tasks"
                rows={3}
                value={formData.q9_repetitive_tasks}
                onChange={handleChange}
                placeholder="Ví dụ: Mỗi tuần tôi phải viết báo cáo tổng hợp từ dữ liệu Excel tốn 2 tiếng, soạn thư mời đào tạo, hoặc dịch tài liệu y khoa từ tiếng Anh..."
                className={`w-full p-3.5 rounded-xl border bg-slate-950 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-3 focus:ring-blue-900/40 focus:border-blue-500 transition-all ${
                  errors.q9_repetitive_tasks ? "border-red-500/50" : "border-slate-800"
                }`}
              />
              {errors.q9_repetitive_tasks && <span className="text-xs text-red-400">{errors.q9_repetitive_tasks}</span>}
            </div>

            <div className="h-[1px] bg-slate-800 my-4" />

            <div className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Thời gian học tập mong muốn (Hậu cần)</h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Q10: Timeframe preference */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">10. Khung giờ thuận tiện (Chọn nhiều)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {timeframeOptions.map((opt) => {
                      const isSel = formData.q10_timeframe.includes(opt);
                      return (
                        <button
                          id={`q10-${opt}`}
                          key={opt}
                          type="button"
                          onClick={() => handleCheckboxChange("q10_timeframe", opt)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer ${
                            isSel ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg" : "border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-850"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Q11: Convenient days */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">11. Ngày trong tuần thuận tiện (Chọn nhiều)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {dayOptions.map((opt) => {
                      const isSel = formData.q11_days.includes(opt);
                      return (
                        <button
                          id={`q11-${opt}`}
                          key={opt}
                          type="button"
                          onClick={() => handleCheckboxChange("q11_days", opt)}
                          className={`w-10 h-10 text-xs font-bold rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                            isSel ? "bg-blue-600 border-blue-500 text-white shadow-lg" : "border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-850"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Q12: Session duration preference */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">12. Thời lượng buổi học phù hợp nhất</label>
                <div className="flex gap-3">
                  {["90 phút", "120 phút"].map((opt) => (
                    <button
                      id={`q12-${opt}`}
                      key={opt}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, q12_duration: opt }))}
                      className={`px-5 py-2.5 text-xs rounded-xl border transition-all font-bold cursor-pointer ${
                        formData.q12_duration === opt
                          ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold shadow-lg"
                          : "border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-850"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: PLACEMENT RESULT & SUBMISSION */}
        {step === 4 && submittedResult && (
          <div className="space-y-6">
            <div className="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-6 text-center space-y-4">
              <Award className="w-12 h-12 text-blue-400 mx-auto animate-bounce" />
              <div>
                <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">Kết quả tự đánh giá</span>
                <h3 className="text-xl font-extrabold text-white mt-1">Đề xuất xếp lớp phù hợp</h3>
              </div>

              <div className="flex items-center justify-center gap-6 py-2">
                <div className="text-center">
                  <span className="text-3xl font-extrabold text-blue-400 font-mono">{submittedResult.score}/100</span>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Điểm Ước Lượng</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-800" />
                <div className="text-center">
                  <span className={`text-2xl font-extrabold uppercase px-4 py-1.5 rounded-xl shadow-lg ${
                    submittedResult.assignedLevel === "L3" 
                      ? "bg-purple-600 border border-purple-500 text-white shadow-purple-500/10" 
                      : submittedResult.assignedLevel === "L2" 
                      ? "bg-indigo-600 border border-indigo-500 text-white shadow-indigo-500/10" 
                      : "bg-blue-600 border border-blue-500 text-white shadow-blue-500/10"
                  }`}>
                    {submittedResult.assignedLevel === "L3" ? "Level 3" : submittedResult.assignedLevel === "L2" ? "Level 2" : "Level 1"}
                  </span>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 mt-1">Phân Lớp Khuyên Dùng</span>
                </div>
              </div>

              <div className="max-w-md mx-auto text-xs text-slate-300 font-sans leading-relaxed pt-2">
                {submittedResult.assignedLevel === "L3" && (
                  <span>Chúc mừng! Bạn có điểm số rất tốt hoặc đã có sẵn kinh nghiệm lập trình. Bạn được đề xuất tham gia lớp <b>Level 3 — Vibe Coding (Creators)</b> để học tự xây dựng ứng dụng web bằng AI.</span>
                )}
                {submittedResult.assignedLevel === "L2" && (
                  <span>Tuyệt vời! Bạn đã có một số nền tảng hoặc có nhu cầu tự động hóa công việc. Bạn được đề xuất tham gia lớp <b>Level 2 — AI Automation (Builders)</b> để học viết Google Apps Script với AI.</span>
                )}
                {submittedResult.assignedLevel === "L1" && (
                  <span>Chào đón bạn! Điểm số cho thấy bạn phù hợp nhất với lớp nền tảng <b>Level 1 — Daily Work AI (AI cho công việc hàng ngày)</b> để thành thạo kỹ năng hỏi đáp AI, dùng Gems, NotebookLM và công cụ soạn thảo.</span>
                )}
              </div>
            </div>

            <div className="border border-slate-800 rounded-2xl p-5 space-y-3 bg-slate-950/50 text-xs">
              <span className="font-bold text-white block border-b border-slate-800 pb-2">Xác nhận thông tin gửi đi</span>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div><span className="text-slate-400">Họ tên:</span> <span className="font-semibold text-slate-200">{formData.studentName}</span></div>
                <div><span className="text-slate-400">Khoa/Phòng:</span> <span className="font-semibold text-slate-200">{formData.department}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className="font-semibold text-slate-200 font-mono text-blue-400">{formData.email}</span></div>
                <div><span className="text-slate-400">SĐT/Zalo:</span> <span className="font-semibold text-slate-200 font-mono text-blue-400">{formData.phone}</span></div>
                <div><span className="text-slate-400">Thời lượng:</span> <span className="font-semibold text-slate-200">{formData.q12_duration}</span></div>
                <div><span className="text-slate-400">Sắp xếp ngày học:</span> <span className="font-semibold text-slate-200 text-indigo-400">{formData.q11_days.join(", ") || "Chưa chọn"}</span></div>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center font-sans">
              *Bằng việc nhấn "Xác nhận gửi", kết quả khảo sát của bạn sẽ được lưu giữ bảo mật trên cơ sở dữ liệu bệnh viện để Ban Tổ chức lập danh sách phân lớp chính thức.
            </p>
          </div>
        )}

      </div>

      {/* FOOTER ACTIONS */}
      <div className="bg-slate-950 border-t border-slate-850 px-6 py-4 flex items-center justify-between">
        <div>
          {step > 1 && (
            <button
              id="btn-back"
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="px-5 py-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </button>
          )}
        </div>

        <div>
          {step < 4 ? (
            <button
              id="btn-next"
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Tiếp tục
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="btn-submit"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Đang gửi kết quả..." : "Xác nhận gửi kết quả"}
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
