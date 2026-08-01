/* Ba cấp độ dùng chung một dải xanh đậm dần trên toàn app. Giữ nguyên
   bảng này ở mọi nơi (ô số, biểu đồ, nhãn trong bảng) để người xem nối
   được ô số ↔ lát biểu đồ ↔ dòng dữ liệu chỉ bằng màu. */
export const LEVEL_RAMP = {
  L1: { name: "Daily Work AI", solid: "#2E86C8", rail: "from-lv1-light to-lv1", from: "#7CD0F5", to: "#4FC3F0", pill: "from-[#E4F4FD] to-[#D3EDFB] text-[#14607F]" },
  L2: { name: "AI Automation", solid: "#4A7EB5", rail: "from-lv2-light to-lv2-deep", from: "#6B9FD4", to: "#4A7EB5", pill: "from-[#DDE9F6] to-[#CBDDF0] text-[#274E7A]" },
  L3: { name: "Vibe Coding", solid: "#14336E", rail: "from-lv3-light to-lv3-deep", from: "#2A5FB4", to: "#14336E", pill: "from-[#D6E0F2] to-[#C2D1EA] text-[#14336E]" },
} as const;

export type LevelId = keyof typeof LEVEL_RAMP;

export const LEVEL_LABEL: Record<LevelId, string> = {
  L1: "Cấp độ 1",
  L2: "Cấp độ 2",
  L3: "Cấp độ 3",
};

export const LEVEL_IDS: LevelId[] = ["L1", "L2", "L3"];
