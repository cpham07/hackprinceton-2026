import type { GameState, SealId } from "../state/gameState";

/** Chapter 2 story data: flags, the three seals and the objective shown in the HUD. */

export const CHAPTER_2_TITLE = "Chapter 2: The Secrets of the Gods";

export const CH2_FLAGS = {
  athenaIntroComplete: "athenaIntroComplete",
  wisdomPuzzleSolved: "wisdomPuzzleSolved",
} as const;

export const SEAL_OF_WISDOM_QUEST = "sealOfWisdom";

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

export function getChapter2Objective(state: Readonly<GameState>): string {
  if (!state.flags[CH2_FLAGS.athenaIntroComplete]) return "Speak with Athena.";
  if (!state.seals.athena) return "Solve Athena's library puzzle.";
  return "Seek the remaining seals from Ares and Hades.";
}
