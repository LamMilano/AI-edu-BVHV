import { describe, it, expect } from "vitest";
import { canStudy, LEVEL_RANK, LEVEL_IDS } from "./levels";

describe("canStudy", () => {
  it("ai cũng học được lớp Cấp độ 1", () => {
    for (const ref of LEVEL_IDS) expect(canStudy(ref, "L1")).toBe(true);
  });

  it("học viên C3 học được cả lớp C1 và C2 — cấp khảo sát chỉ là đích lộ trình", () => {
    expect(canStudy("L3", "L1")).toBe(true);
    expect(canStudy("L3", "L2")).toBe(true);
    expect(canStudy("L3", "L3")).toBe(true);
  });

  it("không với lên lớp cao hơn cấp tham chiếu", () => {
    expect(canStudy("L1", "L2")).toBe(false);
    expect(canStudy("L1", "L3")).toBe(false);
    expect(canStudy("L2", "L3")).toBe(false);
  });

  it("thiếu cấp tham chiếu (dữ liệu cũ) thì coi như C1, không biến mất khỏi mọi lớp", () => {
    expect(canStudy(undefined as never, "L1")).toBe(true);
    expect(canStudy(undefined as never, "L2")).toBe(false);
  });

  it("thứ hạng tăng dần theo cấp độ", () => {
    expect(LEVEL_RANK.L1).toBeLessThan(LEVEL_RANK.L2);
    expect(LEVEL_RANK.L2).toBeLessThan(LEVEL_RANK.L3);
  });
});
