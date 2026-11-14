import type { GameState } from "../state/gameState";
import type { StoryAction } from "./actions";

/** Chapter 1 story data: flags, clues, the incantation and the objective shown in the HUD. */

export const CHAPTER_1_TITLE = "Chapter 1: Welcome to Olympus";
export const CHAPTER_2_TEASER = "Chapter 2: The Secrets of the Gods — Coming Next";
export const CHAPTER_1_QUEST = "chapter1";

export const INCANTATION = "Somnus, let the heavens dream.";

export const FLAGS = {
  aphroditeIntroComplete: "aphroditeIntroComplete",
  gatekeeperRumorHeard: "gatekeeperRumorHeard",
  incantationLearned: "incantationLearned",
  statueExamined: "statueExamined",
  gatekeeperAsleep: "gatekeeperAsleep",
  gateOpen: "gateOpen",
  chapter1Complete: "chapter1Complete",
} as const;

export interface ClueDefinition {
  id: string;
  title: string;
  text: string;
  optional?: boolean;
}

export const CLUES: Record<string, ClueDefinition> = {
  gatekeeperRumor: {
    id: "gatekeeperRumor",
    title: "Gatekeeper rumor",
    text: "An ancient incantation can put the gatekeeper to sleep.",
  },
  incantation: {
    id: "incantation",
    title: "Sleeping incantation",
    text: `"${INCANTATION}"`,
  },
  statueWarning: {
    id: "statueWarning",
    title: "Statue's warning",
    text: "Beware the goddess whose kindness conceals ambition.",
    optional: true,
  },
};

/** Applied once when the player crosses the exit beyond the open gate. */
export const CHAPTER_1_COMPLETE_ACTIONS: StoryAction[] = [
  { type: "setFlag", flag: FLAGS.chapter1Complete },
  { type: "completeQuest", quest: CHAPTER_1_QUEST },
  { type: "setChapter", chapter: 2 },
];

/** The next thing the player should do, derived from state (works in any order of discovery). */
export function getCurrentObjective(state: Readonly<GameState>): string {
  const has = (flag: string) => state.flags[flag] === true;
  if (has(FLAGS.chapter1Complete)) return "Chapter 1 complete.";
  if (has(FLAGS.gateOpen)) return "Enter Olympus through the open gate.";
  if (has(FLAGS.incantationLearned)) return "Put the gatekeeper to sleep: speak the incantation to him.";
  if (!has(FLAGS.aphroditeIntroComplete)) return "Speak with Aphrodite.";
  if (has(FLAGS.gatekeeperRumorHeard)) return "Learn the gatekeeper's incantation.";
  return "Question the locals.";
}
