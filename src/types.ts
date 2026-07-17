export interface SurveySubmission {
  id?: string;
  studentName: string;
  department: string;
  email: string;
  phone: string;
  score: number;
  assignedLevel: "L1" | "L2" | "L3";
  answers: {
    // Q1-Q6: Part B (Placement & experience)
    q1_tools: string[]; // ['ChatGPT', 'Gemini', etc]
    q2_paid: string[]; // ['ChatGPT', 'Gemini', etc]
    q3_frequency: string; // 'Chưa bao giờ' | 'Thỉnh thoảng' | 'Hàng tuần' | 'Hàng ngày'
    q4_past_tasks: string[]; // list of past accomplishments
    q5_concepts: string[]; // list of known terms
    q6_coding_exp: string; // 'Không có' | 'Biết cơ bản' | 'Thành thạo >= 1 ngôn ngữ'
    // Q7-Q9: Part C (Expectations)
    q7_goals: string[]; // desired levels
    q8_orientation: string; // learning path direction
    q9_repetitive_tasks: string; // description of manual tasks to automate
    // Q10-Q12: Part D (Logistics)
    q10_timeframe: string[]; // morning, afternoon, evening, etc.
    q11_days: string[]; // days of the week T2, T3...
    q12_duration: string; // '90 phút' | '120 phút'
  };
  submittedAt: any; // Firestore Timestamp
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  category: "important" | "schedule" | "general";
  date: string;
  createdAt: any;
}

export interface ClassSession {
  id?: string;
  level: "L1" | "L2" | "L3";
  name: string;
  schedule: string;
  instructor: string;
  room: string;
  studentsCount: number;
}
