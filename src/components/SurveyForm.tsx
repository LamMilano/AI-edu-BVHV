import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SurveySubmission } from "../types";
import {
  User, Mail, Phone, Check, Send, CheckCircle2,
  ChevronRight, ChevronLeft, AlertCircle
} from "lucide-react";
import DepartmentField from "./DepartmentField";
import { isValidDepartment } from "../lib/departments";

interface SurveyFormProps {
  onSuccess: () => void;
}

const STEPS = [
  { num: 1, label: "Thông tin" },
  { num: 2, label: "Kinh nghiệm AI" },
  { num: 3, label: "Mục tiêu" },
  { num: 4, label: "Kết quả" },
] as const;

const LEVEL_META = {
  L1: {
    num: "01",
    name: "Daily Work AI",
    grad: "from-lv1-light via-lv1 to-lv1-deep",
    desc: "Thành thạo hỏi đáp AI, dùng Gems, NotebookLM và AI trong bộ Office.",
  },
  L2: {
    num: "02",
    name: "AI Automation",
    grad: "from-lv2-light via-lv2 to-lv2-deep",
    desc: "Tự động hoá quy trình lặp bằng Google Apps Script và Gemini API.",
  },
  L3: {
    num: "03",
    name: "Vibe Coding",
    grad: "from-lv3-light via-lv3 to-lv3-deep",
    desc: "Tự dựng ứng dụng web phục vụ chuyên môn bằng prompt-to-app.",
  },
} as const;

/** Các câu hỏi cho chọn nhiều đáp án. */
type MultiField =
  | "q1_tools" | "q2_paid" | "q4_past_tasks" | "q5_concepts"
  | "q7_goals" | "q10_timeframe" | "q11_days";

/** Đáp án "phủ định" của từng câu: chọn nó thì bỏ hết đáp án còn lại. */
const NONE_OPTION: Partial<Record<MultiField, string>> = {
  q1_tools: "Chưa dùng bao giờ",
  q2_paid: "Chưa trả phí cho công cụ nào",
  q5_concepts: "Không hiểu",
};

/* ── Mảnh giao diện dùng lại ──────────────────────────────────
   Định nghĩa ở cấp module, KHÔNG lồng trong SurveyForm: nếu lồng,
   mỗi lần render React thấy một kiểu component mới, tháo bỏ DOM cũ
   và dựng lại — ô nhập sẽ mất focus sau mỗi ký tự gõ. */

function Question({ n, title, hint, children }: {
  n: number; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[14px] font-bold text-ink-2">
        <span className="text-ink-4 mr-1.5 tnum">{n}.</span>
        {title}
        {hint && <span className="font-medium text-ink-4 ml-1.5">({hint})</span>}
      </label>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function MultiChoice({ opts, selected, onPick, cols, idPrefix }: {
  opts: string[]; selected: string[]; onPick: (o: string) => void; cols: string; idPrefix: string;
}) {
  return (
    <div className={`grid ${cols} gap-2`}>
      {opts.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            id={`${idPrefix}-${opt}`}
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(opt)}
            className={`choice ${on ? "choice-on" : ""} px-3.5 py-3 text-left text-[13.5px] flex items-center gap-2.5`}
          >
            <span
              className={`w-4 h-4 rounded-[4px] flex-none flex items-center justify-center border-2 transition-all ${
                on ? "bg-brand-navy border-brand-navy" : "border-[#B9CCE0]"
              }`}
            >
              {on && <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SingleChoice({ opts, selected, onPick, cols, idPrefix }: {
  opts: string[]; selected: string; onPick: (o: string) => void; cols: string; idPrefix: string;
}) {
  return (
    <div className={`grid ${cols} gap-2`}>
      {opts.map((opt) => {
        const on = selected === opt;
        return (
          <button
            id={`${idPrefix}-${opt}`}
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(opt)}
            className={`choice ${on ? "choice-on" : ""} px-3.5 py-3 text-left text-[13.5px] flex items-center gap-2.5`}
          >
            <span
              className={`w-4 h-4 rounded-full flex-none border-2 transition-all ${
                on
                  ? "border-brand-navy bg-[radial-gradient(circle,var(--color-brand-navy)_0_4px,#fff_5px_7px)]"
                  : "border-[#B9CCE0]"
              }`}
            />
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** Ô ghi rõ nội dung cho lựa chọn "Khác", chỉ hiện khi "Khác" được chọn. */
function OtherInput({ id, name, show, value, onChange }: {
  id: string; name: string; show: boolean; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!show) return null;
  return (
    <input
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      placeholder="Khác — vui lòng ghi rõ tên công cụ…"
      aria-label="Ghi rõ công cụ khác"
      className="field w-full mt-2 px-3.5 py-2.5 text-[13.5px]"
    />
  );
}

function TextField({ id, name, label, placeholder, Icon, type = "text", value, error, onChange }: {
  id: string; name: string; label: string; placeholder?: string; Icon: any; type?: string;
  value: string; error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13.5px] font-bold text-ink-2 mb-2">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
        <input
          id={id}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`field w-full pl-10 pr-4 py-3 text-[14px] ${error ? "field-error" : ""}`}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-[13px] text-danger-deep mt-1.5 font-semibold">
          <AlertCircle className="w-3.5 h-3.5 flex-none" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function SurveyForm({ onSuccess }: SurveyFormProps) {
  // Trạng thái từng bước
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    score: number;
    assignedLevel: "L1" | "L2" | "L3";
  } | null>(null);

  const [formData, setFormData] = useState({
    studentName: "",
    department: "",
    email: "",
    phone: "",
    q1_tools: [] as string[],
    q1_tools_other: "",
    q2_paid: [] as string[],
    q2_paid_other: "",
    q3_frequency: "Chưa bao giờ",
    q4_past_tasks: [] as string[],
    q5_concepts: [] as string[],
    q7_goals: [] as string[],
    q8_orientation: "Chỉ cần AI hỗ trợ công việc",
    q9_repetitive_tasks: "",
    q10_timeframe: [] as string[],
    q11_days: [] as string[],
    q12_duration: "120 phút"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const toolOptions = ["Chưa dùng bao giờ", "ChatGPT", "Gemini", "Copilot", "NotebookLM", "Khác"];
  const paidOptions = ["Chưa trả phí cho công cụ nào", "ChatGPT", "Gemini", "Copilot", "NotebookLM", "Khác"];
  const frequencyOptions = ["Chưa bao giờ", "Thỉnh thoảng", "Hàng tuần", "Hàng ngày"];
  const pastTaskOptions = [
    "Hỏi đáp thông thường",
    "Viết prompt có cấu trúc",
    "Tạo GPT/Gem riêng",
    "Dùng NotebookLM có trích dẫn",
    "Dùng AI trong Office (Word/Excel/PowerPoint)",
    "Viết code hoặc Apps Script",
    "Xây app/tool nhỏ"
  ];
  const conceptOptions = ["Không hiểu", "LLM", "Token", "Context window", "Hallucination", "Prompt", "Agent"];
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleDepartmentChange = (value: string) => {
    setFormData(prev => ({ ...prev, department: value }));
    if (errors.department) {
      setErrors(prev => ({ ...prev, department: "" }));
    }
  };

  const handleCheckboxChange = (name: MultiField, option: string) => {
    setFormData(prev => {
      const current = prev[name] as string[];
      const none = NONE_OPTION[name];
      let updated: string[];

      if (option === none) {
        // "Không có / chưa dùng" loại trừ mọi lựa chọn khác
        updated = [option];
      } else {
        const temp = none ? current.filter(item => item !== none) : current;
        updated = temp.includes(option)
          ? temp.filter(item => item !== option)
          : [...temp, option];
      }

      const next = { ...prev, [name]: updated };
      // Bỏ chọn "Khác" thì xoá luôn nội dung đã ghi kèm
      if (name === "q1_tools" && !updated.includes("Khác")) next.q1_tools_other = "";
      if (name === "q2_paid" && !updated.includes("Khác")) next.q2_paid_other = "";
      return next;
    });
  };

  /** Điểm cho từng việc đã từng làm ở câu 4 — càng tự chủ càng cao. */
  const TASK_POINTS: Record<string, number> = {
    "Hỏi đáp thông thường": 1,
    "Viết prompt có cấu trúc": 4,
    "Tạo GPT/Gem riêng": 6,
    "Dùng NotebookLM có trích dẫn": 5,
    "Dùng AI trong Office (Word/Excel/PowerPoint)": 5,
    "Viết code hoặc Apps Script": 10,
    "Xây app/tool nhỏ": 12,
  };

  // Tính điểm và xếp lớp
  const calculateResult = () => {
    let score = 0;

    if (!formData.q1_tools.includes("Chưa dùng bao giờ")) {
      score += formData.q1_tools.length * 3;
    }

    if (!formData.q2_paid.includes("Chưa trả phí cho công cụ nào")) {
      score += formData.q2_paid.length * 5;
    }

    if (formData.q3_frequency === "Thỉnh thoảng") score += 5;
    else if (formData.q3_frequency === "Hàng tuần") score += 10;
    else if (formData.q3_frequency === "Hàng ngày") score += 15;

    formData.q4_past_tasks.forEach(task => {
      score += TASK_POINTS[task] ?? 0;
    });

    if (!formData.q5_concepts.includes("Không hiểu")) {
      score += formData.q5_concepts.length * 2.5;
    }

    const finalScore = Math.min(Math.round(score), 100);

    let assignedLevel: "L1" | "L2" | "L3" = "L1";

    // Đã tự viết code / dựng tool là tín hiệu đủ mạnh để vào L3 dù điểm thấp.
    const hasCodingOrAutomation =
      formData.q4_past_tasks.includes("Viết code hoặc Apps Script") ||
      formData.q4_past_tasks.includes("Xây app/tool nhỏ");

    // "Hỏi đáp thông thường" là mức khởi đầu, không tính là kinh nghiệm nâng cao.
    const hasAdvancedTask = formData.q4_past_tasks.some(
      task => task !== "Hỏi đáp thông thường"
    );

    if (hasCodingOrAutomation || finalScore >= 45) {
      assignedLevel = "L3";
    } else if (finalScore >= 18 || hasAdvancedTask) {
      assignedLevel = "L2";
    } else {
      assignedLevel = "L1";
    }

    return { score: finalScore, assignedLevel };
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.studentName.trim()) newErrors.studentName = "Vui lòng nhập họ và tên";
    // Chỉ nhận tên nằm trong danh mục chuẩn — thống kê theo khoa mới gộp đúng.
    if (!formData.department.trim()) newErrors.department = "Vui lòng chọn khoa/phòng làm việc";
    else if (!isValidDepartment(formData.department)) {
      newErrors.department = "Vui lòng chọn một khoa/phòng có trong danh sách";
    }
    if (!formData.email.trim() || !formData.email.includes("@")) newErrors.email = "Vui lòng nhập email hợp lệ";
    if (!formData.phone.trim()) newErrors.phone = "Vui lòng nhập số điện thoại hoặc Zalo";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.q9_repetitive_tasks.trim()) {
      newErrors.q9_repetitive_tasks = "Vui lòng mô tả ngắn gọn công việc lặp lại muốn cải thiện";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Số mục đã có câu trả lời trên bước hiện tại — hiện cạnh nút Tiếp tục
      để người dùng biết mình còn thiếu gì trước khi bấm. */
  const answeredOnStep = (): { done: number; total: number } => {
    if (step === 1) {
      const fields = [formData.studentName, formData.department, formData.email, formData.phone];
      return { done: fields.filter(f => f.trim()).length, total: 4 };
    }
    if (step === 2) {
      const answers = [
        formData.q1_tools.length > 0,
        formData.q2_paid.length > 0,
        Boolean(formData.q3_frequency),
        formData.q4_past_tasks.length > 0,
        formData.q5_concepts.length > 0,
      ];
      return { done: answers.filter(Boolean).length, total: 5 };
    }
    if (step === 3) {
      const answers = [
        formData.q7_goals.length > 0,
        Boolean(formData.q8_orientation),
        Boolean(formData.q9_repetitive_tasks.trim()),
        formData.q10_timeframe.length > 0,
        formData.q11_days.length > 0,
        Boolean(formData.q12_duration),
      ];
      return { done: answers.filter(Boolean).length, total: 6 };
    }
    return { done: 0, total: 0 };
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
          q1_tools_other: formData.q1_tools_other.trim(),
          q2_paid: formData.q2_paid,
          q2_paid_other: formData.q2_paid_other.trim(),
          q3_frequency: formData.q3_frequency,
          q4_past_tasks: formData.q4_past_tasks,
          q5_concepts: formData.q5_concepts,
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
      onSuccess();
    } catch (err) {
      console.error("Lỗi khi gửi kết quả khảo sát: ", err);
      setSubmitting(false);
      alert("Đã xảy ra lỗi khi lưu kết quả. Vui lòng kiểm tra kết nối mạng và thử lại.");
    }
  };

  const counter = answeredOnStep();
  const meta = submittedResult ? LEVEL_META[submittedResult.assignedLevel] : null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* ══ THANH BƯỚC — ô thoi, lặp lại motif 45° của logo ══ */}
      <div className="flex items-center mb-7">
        {STEPS.map((st, i) => {
          const done = step > st.num;
          const now = step === st.num;
          return (
            <React.Fragment key={st.num}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-[26px] h-[26px] rotate-45 rounded-[4px] flex-none flex items-center justify-center transition-all ${
                    done
                      ? "bg-gradient-to-br from-ok-light to-ok"
                      : now
                      ? "bg-gradient-to-br from-brand-sky to-brand-navy ring-4 ring-brand-sky-deep/20"
                      : "bg-gradient-to-b from-[#EEF3F9] to-[#DFE9F3]"
                  }`}
                >
                  <span className={`-rotate-45 text-[12px] font-extrabold ${done || now ? "text-white" : "text-ink-4"}`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : st.num}
                  </span>
                </div>
                <span
                  className={`hidden sm:block text-[12.5px] font-bold whitespace-nowrap ${
                    done ? "text-ok-deep" : now ? "text-brand-navy-deep" : "text-ink-4"
                  }`}
                >
                  {st.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 rounded-full ${
                    done ? "bg-gradient-to-r from-ok to-brand-sky-deep" : "bg-line"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="surface cut-corner p-6 sm:p-8">
        {/* ══ BƯỚC 1 ══ */}
        {step === 1 && (
          <div>
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-ink-4">Bước 1 / 4</span>
            <h2 className="text-[21px] font-extrabold tracking-[-0.025em] mt-1.5">Thông tin của bạn</h2>
            <p className="text-[14px] text-ink-3 mt-1 leading-relaxed">
              Ban tổ chức dùng thông tin này để liên hệ xếp lịch học.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <TextField id="input-name" name="studentName" label="Họ và tên" placeholder="Nguyễn Văn A" Icon={User}
                value={formData.studentName} error={errors.studentName} onChange={handleChange} />
              <DepartmentField id="input-dept" label="Khoa / Phòng / Ban"
                value={formData.department} error={errors.department} onChange={handleDepartmentChange} />
              <TextField id="input-email" name="email" label="Địa chỉ email" Icon={Mail} type="email"
                value={formData.email} error={errors.email} onChange={handleChange} />
              <TextField id="input-phone" name="phone" label="SĐT / Zalo" placeholder="0901234567" Icon={Phone}
                value={formData.phone} error={errors.phone} onChange={handleChange} />
            </div>
          </div>
        )}

        {/* ══ BƯỚC 2 ══ */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-ink-4">Bước 2 / 4</span>
              <h2 className="text-[21px] font-extrabold tracking-[-0.025em] mt-1.5">Bạn đã dùng AI đến đâu?</h2>
              <p className="text-[14px] text-ink-3 mt-1 leading-relaxed">
                Trả lời thật — hệ thống dùng câu trả lời để xếp lớp, không phải để chấm điểm.
              </p>
            </div>

            <Question n={1} title="Bạn đã sử dụng công cụ AI nào?" hint="chọn nhiều">
              <MultiChoice idPrefix="q1" opts={toolOptions} selected={formData.q1_tools} cols="grid-cols-1 sm:grid-cols-3" onPick={(o) => handleCheckboxChange("q1_tools", o)} />
              <OtherInput
                id="input-q1-other"
                name="q1_tools_other"
                show={formData.q1_tools.includes("Khác")}
                value={formData.q1_tools_other}
                onChange={handleChange}
              />
            </Question>

            <Question n={2} title="Bạn đang sử dụng bản CÓ TRẢ PHÍ của công cụ AI nào?" hint="chọn nhiều">
              <MultiChoice idPrefix="q2" opts={paidOptions} selected={formData.q2_paid} cols="grid-cols-1 sm:grid-cols-3" onPick={(o) => handleCheckboxChange("q2_paid", o)} />
              <OtherInput
                id="input-q2-other"
                name="q2_paid_other"
                show={formData.q2_paid.includes("Khác")}
                value={formData.q2_paid_other}
                onChange={handleChange}
              />
            </Question>

            <Question n={3} title="Tần suất dùng AI cho công việc">
              <SingleChoice idPrefix="q3" opts={frequencyOptions} selected={formData.q3_frequency} cols="grid-cols-2 sm:grid-cols-4" onPick={(o) => setFormData(p => ({ ...p, q3_frequency: o }))} />
            </Question>

            <Question n={4} title="Bạn đã từng làm việc nào sau đây?" hint="chọn nhiều">
              <MultiChoice idPrefix="q4" opts={pastTaskOptions} selected={formData.q4_past_tasks} cols="grid-cols-1 sm:grid-cols-2" onPick={(o) => handleCheckboxChange("q4_past_tasks", o)} />
            </Question>

            <Question n={5} title="Bạn hiểu các khái niệm nào?" hint="chọn nhiều">
              <MultiChoice idPrefix="q5" opts={conceptOptions} selected={formData.q5_concepts} cols="grid-cols-2 sm:grid-cols-3" onPick={(o) => handleCheckboxChange("q5_concepts", o)} />
            </Question>
          </div>
        )}

        {/* ══ BƯỚC 3 ══ */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-ink-4">Bước 3 / 4</span>
              <h2 className="text-[21px] font-extrabold tracking-[-0.025em] mt-1.5">Bạn muốn đạt được gì?</h2>
              <p className="text-[14px] text-ink-3 mt-1 leading-relaxed">
                Mô tả càng sát công việc thật, giáo trình chuẩn bị càng đúng nhu cầu của bạn.
              </p>
            </div>

            <Question n={7} title="Bạn mong muốn học gì nhất?" hint="chọn nhiều">
              <MultiChoice idPrefix="q7" opts={goalOptions} selected={formData.q7_goals} cols="grid-cols-1" onPick={(o) => handleCheckboxChange("q7_goals", o)} />
            </Question>

            <Question n={8} title="Định hướng của bạn">
              <SingleChoice idPrefix="q8" opts={orientationOptions} selected={formData.q8_orientation} cols="grid-cols-1 sm:grid-cols-3" onPick={(o) => setFormData(p => ({ ...p, q8_orientation: o }))} />
            </Question>

            <div>
              <label htmlFor="input-q9" className="block text-[14px] font-bold text-ink-2">
                <span className="text-ink-4 mr-1.5 tnum">9.</span>
                Công việc lặp lại nào bạn muốn cải thiện bằng AI?
                <span className="text-danger ml-1">*</span>
              </label>
              <textarea
                id="input-q9"
                name="q9_repetitive_tasks"
                rows={3}
                value={formData.q9_repetitive_tasks}
                onChange={handleChange}
                placeholder="Ví dụ: mỗi tuần tôi mất 2 tiếng viết báo cáo tổng hợp từ Excel; soạn thư mời đào tạo; dịch tài liệu y khoa từ tiếng Anh…"
                aria-invalid={Boolean(errors.q9_repetitive_tasks)}
                className={`field w-full mt-2.5 p-3.5 text-[14px] leading-relaxed resize-y ${errors.q9_repetitive_tasks ? "field-error" : ""}`}
              />
              {errors.q9_repetitive_tasks && (
                <p className="flex items-center gap-1.5 text-[13px] text-danger-deep mt-1.5 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 flex-none" />
                  {errors.q9_repetitive_tasks}
                </p>
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-line to-transparent" />

            <h3 className="text-[15px] font-extrabold tracking-tight">Thời gian học mong muốn</h3>

            <div className="grid sm:grid-cols-2 gap-5">
              <Question n={10} title="Khung giờ thuận tiện" hint="chọn nhiều">
                <div className="flex flex-wrap gap-2">
                  {timeframeOptions.map((opt) => {
                    const on = formData.q10_timeframe.includes(opt);
                    return (
                      <button
                        id={`q10-${opt}`}
                        key={opt}
                        type="button"
                        onClick={() => handleCheckboxChange("q10_timeframe", opt)}
                        className={`choice ${on ? "choice-on" : ""} px-3.5 py-2 text-[13px]`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </Question>

              <Question n={11} title="Ngày trong tuần thuận tiện" hint="chọn nhiều">
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map((opt) => {
                    const on = formData.q11_days.includes(opt);
                    return (
                      <button
                        id={`q11-${opt}`}
                        key={opt}
                        type="button"
                        onClick={() => handleCheckboxChange("q11_days", opt)}
                        className={`choice ${on ? "choice-on" : ""} w-11 h-11 text-[13px] font-bold flex items-center justify-center`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </Question>
            </div>

            <Question n={12} title="Thời lượng buổi phù hợp">
              <SingleChoice idPrefix="q12" opts={["90 phút", "120 phút"]} selected={formData.q12_duration} cols="grid-cols-2 sm:grid-cols-4" onPick={(o) => setFormData(p => ({ ...p, q12_duration: o }))} />
            </Question>
          </div>
        )}

        {/* ══ BƯỚC 4 — kết quả tách đôi ══ */}
        {step === 4 && submittedResult && meta && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6 md:items-center">
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-ok-deep bg-gradient-to-br from-ok/16 to-ok/6">
                  <span className="w-2.5 h-2.5 rotate-45 rounded-[2px] bg-gradient-to-br from-ok-light to-ok" />
                  Đã tính xong kết quả
                </span>
                <h2 className="text-[23px] font-extrabold tracking-[-0.025em] mt-3.5">
                  Cảm ơn {formData.studentName || "bạn"}
                </h2>
                <p className="text-[14px] text-ink-3 mt-1.5 leading-relaxed">
                  Dựa trên câu trả lời, hệ thống đề xuất bạn học cấp độ bên cạnh. Bạn vẫn có thể đổi khi liên hệ giáo vụ.
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[13px] text-ink-3">Điểm ước lượng</span>
                  <span className="text-[20px] font-extrabold text-brand-navy tnum">{submittedResult.score}</span>
                  <span className="text-[13px] text-ink-4 tnum">/ 100</span>
                </div>
              </div>

              <div
                className={`relative overflow-hidden rounded-card p-5 md:w-[260px] flex-none text-white bg-gradient-to-br ${meta.grad} shadow-[0_18px_36px_-14px_rgb(20_51_110/0.7)]`}
              >
                <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-white/75">
                  Đề xuất cho bạn
                </span>
                <div className="flex items-baseline gap-2.5 mt-2">
                  <span className="text-[38px] font-extrabold leading-[0.9] tracking-[-0.04em] tnum">{meta.num}</span>
                  <span className="text-[17px] font-extrabold tracking-[-0.02em] leading-tight">{meta.name}</span>
                </div>
                <p className="text-[13px] text-white/85 mt-2.5 leading-snug">{meta.desc}</p>
              </div>
            </div>

            <div className="rounded-card p-5 bg-gradient-to-b from-[#F5F9FD] to-[#EAF1F8]">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-ink-4">
                Xác nhận thông tin gửi đi
              </span>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-3 text-[13.5px]">
                {[
                  ["Họ tên", formData.studentName],
                  ["Khoa / Phòng", formData.department],
                  ["Email", formData.email],
                  ["SĐT / Zalo", formData.phone],
                  ["Thời lượng", formData.q12_duration],
                  ["Ngày học", formData.q11_days.join(", ") || "Chưa chọn"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-ink-3 flex-none">{k}:</span>
                    <span className="font-semibold text-ink truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[12.5px] text-ink-4 leading-relaxed">
              Khi bấm gửi, kết quả khảo sát được lưu trên cơ sở dữ liệu bệnh viện để ban tổ chức lập danh sách phân lớp chính thức.
            </p>
          </div>
        )}

        {/* ══ THANH HÀNH ĐỘNG ══ */}
        <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-line-soft">
          {step > 1 ? (
            <button
              id="btn-back"
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="btn-secondary px-4 py-2.5 text-[14px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-4">
            {step < 4 && (
              <span className="hidden sm:block text-[13px] text-ink-3 tnum">
                {counter.done} / {counter.total} mục đã trả lời
              </span>
            )}

            {step < 4 ? (
              <button
                id="btn-next"
                type="button"
                onClick={handleNext}
                className="btn-primary px-6 py-3 text-[14.5px] flex items-center gap-1.5 cursor-pointer"
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
                className="btn-primary px-6 py-3 text-[14.5px] flex items-center gap-2 cursor-pointer"
              >
                {submitting ? "Đang gửi…" : "Xác nhận gửi kết quả"}
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
