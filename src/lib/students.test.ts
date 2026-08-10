import { describe, it, expect } from "vitest";
import {
  normalizeEmail, normalizeName, buildStudentsFromSubmissions, findDuplicateGroups,
} from "./students";
import { SurveySubmission, Student } from "../types";

const stu = (over: Partial<Student> & { id: string }): Student => ({
  email: over.id,
  fullName: "Nguyễn Văn A",
  department: "Khoa Nội",
  phone: "",
  currentLevel: "L1",
  latestSubmissionId: "",
  submissionCount: 1,
  availability: { timeframes: [], days: [], duration: "" },
  notDuplicateOf: [],
  mergedFrom: [],
  createdAt: null,
  updatedAt: null,
  ...over,
} as Student);

const sub = (over: Partial<SurveySubmission> & { id: string }): SurveySubmission => ({
  studentName: "Nguyễn Văn A",
  department: "Khoa Nội",
  email: "a@bvhv.vn",
  phone: "0900000000",
  score: 50,
  assignedLevel: "L1",
  answers: {
    q1_tools: [], q2_paid: [], q3_frequency: "", q4_past_tasks: [], q5_concepts: [],
    q7_goals: [], q8_orientation: "", q9_repetitive_tasks: "",
    q10_timeframe: ["Tối"], q11_days: ["T3"], q12_duration: "90 phút",
  },
  submittedAt: { seconds: 1000, nanoseconds: 0 },
  ...over,
} as SurveySubmission);

describe("normalizeEmail", () => {
  it("bỏ khoảng trắng thừa và đưa về chữ thường", () => {
    expect(normalizeEmail("  Nguyen.Van.A@BvHV.vn ")).toBe("nguyen.van.a@bvhv.vn");
  });

  it("trả null khi rỗng hoặc toàn khoảng trắng", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("trả null khi có dấu gạch chéo, vì Firestore không cho phép trong Document ID", () => {
    expect(normalizeEmail("a/b@bvhv.vn")).toBeNull();
  });

  it("trả null với '.' và '..', là hai Document ID bị Firestore cấm", () => {
    expect(normalizeEmail(".")).toBeNull();
    expect(normalizeEmail("..")).toBeNull();
  });

  it("trả null khi thiếu ký tự @, vì đó không phải email", () => {
    expect(normalizeEmail("nguyenvana")).toBeNull();
  });

  it("trả null khi dài quá giới hạn 1500 byte của Document ID", () => {
    expect(normalizeEmail("a".repeat(1500) + "@bvhv.vn")).toBeNull();
  });
});

describe("normalizeName", () => {
  it("gộp khoảng trắng thừa và đưa về chữ thường, giữ nguyên dấu tiếng Việt", () => {
    expect(normalizeName("  Nguyễn   Văn  A ")).toBe("nguyễn văn a");
  });

  it("trả chuỗi rỗng cho đầu vào rỗng", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("buildStudentsFromSubmissions", () => {
  it("mỗi email một hồ sơ, id là email đã chuẩn hóa", () => {
    const { drafts, skipped } = buildStudentsFromSubmissions([
      sub({ id: "s1", email: "A@BvHV.vn" }),
      sub({ id: "s2", email: "b@bvhv.vn", studentName: "Trần Thị B" }),
    ]);
    expect(skipped).toEqual([]);
    expect(drafts.map(d => d.id).sort()).toEqual(["a@bvhv.vn", "b@bvhv.vn"]);
  });

  it("giữ email bản gốc người dùng gõ, không phải bản chuẩn hóa", () => {
    const { drafts } = buildStudentsFromSubmissions([sub({ id: "s1", email: "A@BvHV.vn" })]);
    expect(drafts[0].email).toBe("A@BvHV.vn");
    expect(drafts[0].id).toBe("a@bvhv.vn");
  });

  it("trùng email thì giữ phiếu mới nhất và đếm số phiếu", () => {
    const { drafts } = buildStudentsFromSubmissions([
      sub({ id: "cu", department: "Khoa cũ", submittedAt: { seconds: 100, nanoseconds: 0 } }),
      sub({ id: "moi", department: "Khoa mới", submittedAt: { seconds: 900, nanoseconds: 0 } }),
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].department).toBe("Khoa mới");
    expect(drafts[0].latestSubmissionId).toBe("moi");
    expect(drafts[0].submissionCount).toBe(2);
  });

  it("phiếu thiếu submittedAt không được coi là mới hơn phiếu có ngày", () => {
    const { drafts } = buildStudentsFromSubmissions([
      sub({ id: "co-ngay", department: "Có ngày", submittedAt: { seconds: 100, nanoseconds: 0 } }),
      sub({ id: "khong-ngay", department: "Không ngày", submittedAt: undefined }),
    ]);
    expect(drafts[0].latestSubmissionId).toBe("co-ngay");
  });

  it("bỏ qua phiếu thiếu email và nói rõ lý do", () => {
    const { drafts, skipped } = buildStudentsFromSubmissions([
      sub({ id: "s1", email: "  ", studentName: "Không Email" }),
    ]);
    expect(drafts).toEqual([]);
    expect(skipped).toEqual([
      { submissionId: "s1", studentName: "Không Email", reason: "Thiếu email hợp lệ" },
    ]);
  });

  it("chép lịch rảnh từ phiếu mới nhất để xếp lớp dùng", () => {
    const { drafts } = buildStudentsFromSubmissions([sub({ id: "s1" })]);
    expect(drafts[0].availability).toEqual({
      timeframes: ["Tối"], days: ["T3"], duration: "90 phút",
    });
  });

  it("currentLevel khởi tạo bằng assignedLevel của phiếu mới nhất", () => {
    const { drafts } = buildStudentsFromSubmissions([
      sub({ id: "cu", assignedLevel: "L1", submittedAt: { seconds: 100, nanoseconds: 0 } }),
      sub({ id: "moi", assignedLevel: "L3", submittedAt: { seconds: 900, nanoseconds: 0 } }),
    ]);
    expect(drafts[0].currentLevel).toBe("L3");
  });
});

describe("findDuplicateGroups", () => {
  it("gom hai hồ sơ cùng tên cùng khoa nhưng khác email", () => {
    const groups = findDuplicateGroups([stu({ id: "a@x.vn" }), stu({ id: "b@x.vn" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].students.map(s => s.id).sort()).toEqual(["a@x.vn", "b@x.vn"]);
  });

  it("không gom khi khác khoa, vì trùng tên giữa hai khoa là chuyện bình thường", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", department: "Khoa Nội" }),
      stu({ id: "b@x.vn", department: "Khoa Ngoại" }),
    ])).toEqual([]);
  });

  it("không gom khi khác tên", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", fullName: "Nguyễn Văn A" }),
      stu({ id: "b@x.vn", fullName: "Trần Thị B" }),
    ])).toEqual([]);
  });

  it("bỏ qua khác biệt hoa/thường và khoảng trắng thừa khi so tên", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", fullName: "Nguyễn Văn A" }),
      stu({ id: "b@x.vn", fullName: "  nguyễn   văn a " }),
    ])).toHaveLength(1);
  });

  it("không báo lại cặp đã được đánh dấu không trùng", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", notDuplicateOf: ["b@x.vn"] }),
      stu({ id: "b@x.vn", notDuplicateOf: ["a@x.vn"] }),
    ])).toEqual([]);
  });

  it("đánh dấu một chiều cũng đủ để im lặng, vì giáo vụ đã quyết một lần", () => {
    expect(findDuplicateGroups([
      stu({ id: "a@x.vn", notDuplicateOf: ["b@x.vn"] }),
      stu({ id: "b@x.vn" }),
    ])).toEqual([]);
  });

  it("nhóm ba người còn một cặp chưa xử lý thì vẫn báo", () => {
    const groups = findDuplicateGroups([
      stu({ id: "a@x.vn", notDuplicateOf: ["b@x.vn"] }),
      stu({ id: "b@x.vn", notDuplicateOf: ["a@x.vn"] }),
      stu({ id: "c@x.vn" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].students).toHaveLength(3);
  });

  it("hồ sơ lẻ loi không tạo nhóm", () => {
    expect(findDuplicateGroups([stu({ id: "a@x.vn" })])).toEqual([]);
  });
});
