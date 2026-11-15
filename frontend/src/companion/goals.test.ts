import { describe, expect, it } from "vitest";
import { GOALS, hasTextGoal, normalizeGoals, toggleGoal } from "./goals";

describe("goal selection", () => {
  it("offers exactly the four goals", () => {
    expect(GOALS.map((goal) => goal.label)).toEqual([
      "Improve my English",
      "Express my ideas clearly",
      "Improve my pacing",
      "Practice speaking clearly",
    ]);
  });

  it("toggles goals on and off, keeping a stable order", () => {
    let goals = toggleGoal([], "pacing");
    goals = toggleGoal(goals, "english");
    expect(goals).toEqual(["english", "pacing"]);
    expect(toggleGoal(goals, "pacing")).toEqual(["english"]);
    expect(toggleGoal(toggleGoal(goals, "english"), "pacing")).toEqual([]);
  });

  it("allows several goals at once", () => {
    const all = GOALS.reduce((goals, goal) => toggleGoal(goals, goal.id), [] as ReturnType<typeof toggleGoal>);
    expect(all).toEqual(["english", "clarity", "pacing", "clear_speech"]);
  });

  it("drops unknown or duplicate values (e.g. from old or edited storage)", () => {
    expect(normalizeGoals(["pacing", "fluency", "pacing", 3, null, "english"])).toEqual(["english", "pacing"]);
    expect(normalizeGoals("english")).toEqual([]);
    expect(normalizeGoals(undefined)).toEqual([]);
  });

  it("knows which goals need transcript feedback (pacing is measured locally)", () => {
    expect(hasTextGoal(["pacing"])).toBe(false);
    expect(hasTextGoal([])).toBe(false);
    expect(hasTextGoal(["pacing", "clarity"])).toBe(true);
  });
});
