import { getGameState, type GameState, type SealId } from "../state/gameState";
import { applyStoryActions, type StoryAction } from "./actions";

/** Chapter 2 story data: flags, the three seals and the objective shown in the HUD. */

export const CHAPTER_2_TITLE = "Chapter 2: The Secrets of the Gods";

export const CH2_FLAGS = {
  athenaIntroComplete: "athenaIntroComplete",
  wisdomPuzzleSolved: "wisdomPuzzleSolved",
  aresIntroComplete: "aresIntroComplete",
  aresTrainingComplete: "aresTrainingComplete",
  hadesTrialComplete: "hadesTrialComplete",
  chapter2Complete: "chapter2Complete",
} as const;

export const SEAL_OF_WISDOM_QUEST = "sealOfWisdom";
export const SEAL_OF_COURAGE_QUEST = "sealOfCourage";
export const SEAL_OF_PASSAGE_QUEST = "sealOfPassage";
export const CHAPTER_2_QUEST = "chapter2";

/** Applied once when the player reaches the end of Ares's training arena. */
export const ARES_TRAINING_REWARD: StoryAction[] = [
  { type: "grantSeal", seal: "ares" },
  { type: "setFlag", flag: CH2_FLAGS.aresTrainingComplete },
  { type: "completeQuest", quest: SEAL_OF_COURAGE_QUEST },
];

/**
 * Applied when Hades's final line is revealed (his third question has been answered).
 * Triggered by that dialogue step, so it is not granted for merely opening the conversation.
 */
export const HADES_TRIAL_REWARD: StoryAction[] = [
  { type: "grantSeal", seal: "hades" },
  { type: "setFlag", flag: CH2_FLAGS.hadesTrialComplete },
  { type: "completeQuest", quest: SEAL_OF_PASSAGE_QUEST },
];

/** Applied once when the player walks through the unlocked palace gates. */
export const CHAPTER_2_COMPLETE_ACTIONS: StoryAction[] = [
  { type: "setFlag", flag: CH2_FLAGS.chapter2Complete },
  { type: "completeQuest", quest: CHAPTER_2_QUEST },
  { type: "setChapter", chapter: 3 },
];

/** Shown by the success overlay when a challenge is first completed. */
export const CHALLENGES: Record<string, { title: string; message: string }> = {
  aresTraining: {
    title: "Seal of Courage earned",
    message:
      "You cross the line untouched. Somewhere above the arena, Ares laughs: \"Not bad, little one.\" The Seal of Courage is yours.",
  },
};

export interface SealDefinition {
  id: SealId;
  name: string;
  owner: string;
}

/** The three seals that open Zeus's vault. Each is an independent reward in GameState.seals. */
export const SEALS: SealDefinition[] = [
  { id: "athena", name: "Seal of Wisdom", owner: "Athena" },
  { id: "ares", name: "Seal of Courage", owner: "Ares" },
  { id: "hades", name: "Seal of Passage", owner: "Hades" },
];

export function countSeals(state: Readonly<GameState>): number {
  return SEALS.filter((seal) => state.seals[seal.id]).length;
}

/** The palace unlocks when all three seals are held, in whatever order they were earned. */
export function hasAllSeals(state: Readonly<GameState>): boolean {
  return state.seals.athena && state.seals.ares && state.seals.hades;
}

/**
 * Completes Chapter 2 if (and only if) all three seals are held and it is not already complete.
 * The check lives here, not in the scene, so it cannot be bypassed by another caller.
 * Returns true if the chapter was completed by this call.
 */
export function completeChapter2IfReady(): boolean {
  const state = getGameState();
  if (!hasAllSeals(state) || state.flags[CH2_FLAGS.chapter2Complete]) return false;
  applyStoryActions(CHAPTER_2_COMPLETE_ACTIONS);
  return true;
}

/**
 * The next step toward each seal. The seals are independent, so each has its own track;
 * null means the seal is already held.
 */
export function getSealSteps(state: Readonly<GameState>): Record<SealId, { step: string; started: boolean } | null> {
  const has = (flag: string) => state.flags[flag] === true;
  return {
    athena: state.seals.athena
      ? null
      : has(CH2_FLAGS.athenaIntroComplete)
        ? { step: "Solve Athena's library puzzle.", started: true }
        : { step: "Speak with Athena.", started: false },
    ares: state.seals.ares
      ? null
      : has(CH2_FLAGS.aresIntroComplete)
        ? { step: "Complete Ares's training course.", started: true }
        : { step: "Speak with Ares.", started: false },
    hades: state.seals.hades ? null : { step: "Answer Hades's questions in his chamber.", started: false },
  };
}

/** One objective: a trial already under way comes first, then the next seal not yet started. */
export function getChapter2Objective(state: Readonly<GameState>): string {
  if (state.flags[CH2_FLAGS.chapter2Complete]) return "Chapter 2 complete.";
  if (hasAllSeals(state)) return "Enter Zeus's palace.";
  const steps = SEALS.map((seal) => getSealSteps(state)[seal.id]).filter((s) => s !== null);
  const next = steps.find((s) => s.started) ?? steps[0];
  return next ? next.step : "All three seals are yours.";
}
