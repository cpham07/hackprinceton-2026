/** Speaking goals a player can choose. Ids match the backend's /speaking/feedback contract. */
export type GoalId = "english" | "clarity" | "pacing" | "clear_speech";

export interface GoalDefinition {
  id: GoalId;
  label: string;
  hint: string;
}

export const GOALS: readonly GoalDefinition[] = [
  { id: "english", label: "Improve my English", hint: "Gentle grammar fixes, more natural phrasing and useful words." },
  { id: "clarity", label: "Express my ideas clearly", hint: "Whether you answered the question and backed it up." },
  { id: "pacing", label: "Improve my pacing", hint: "An approximate words-per-minute measure from your recordings." },
  {
    id: "clear_speech",
    label: "Practice speaking clearly",
    hint: "Word choice and sentence organisation (from your words, not your voice).",
  },
];

const GOAL_IDS = new Set<string>(GOALS.map((goal) => goal.id));

/** Goals analysed from the transcript by the feedback service. Pacing is measured locally instead. */
export const TEXT_GOALS: readonly GoalId[] = ["english", "clarity", "clear_speech"];

export function isGoalId(value: unknown): value is GoalId {
  return typeof value === "string" && GOAL_IDS.has(value);
}

/** Known goals only, no duplicates, in the canonical order. Anything else (e.g. stale storage) is dropped. */
export function normalizeGoals(values: unknown): GoalId[] {
  if (!Array.isArray(values)) return [];
  const chosen = new Set(values.filter(isGoalId));
  return GOALS.map((goal) => goal.id).filter((id) => chosen.has(id));
}

export function toggleGoal(goals: readonly GoalId[], id: GoalId): GoalId[] {
  return normalizeGoals(goals.includes(id) ? goals.filter((goal) => goal !== id) : [...goals, id]);
}

export function hasTextGoal(goals: readonly GoalId[]): boolean {
  return goals.some((goal) => TEXT_GOALS.includes(goal));
}

export function goalLabel(id: GoalId): string {
  return GOALS.find((goal) => goal.id === id)?.label ?? id;
}
