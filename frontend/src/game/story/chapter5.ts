import { getGameState, hasItem, type GameState } from "../state/gameState";
import { applyStoryActions, type StoryAction } from "./actions";
import { hasAllSeals } from "./chapter2";
import { MASTER_BOLT } from "./chapter3";
import { CH4_FLAGS } from "./chapter4";

/**
 * Chapter 5 story data: the final chapter.
 *
 * Who holds the Master Lightning Bolt is still recorded only in the inventory. At the start of this
 * chapter Aphrodite has it (it left the inventory in Chapter 4); the player takes it back
 * (`boltRetrieved`) and hands it to Zeus (`boltReturned`), which removes it again.
 */

export const CHAPTER_5_TITLE = "Chapter 5: Guardian of Olympus";
export const GUARDIAN_TITLE = "Guardian of Olympus";

export const CH5_FLAGS = {
  chapter5Entered: "chapter5Entered",
  alliesBriefed: "alliesBriefed",
  enchantmentsBroken: "enchantmentsBroken",
  aphroditeYielded: "aphroditeYielded",
  boltRetrieved: "boltRetrieved",
  zeusFreed: "zeusFreed",
  boltReturned: "boltReturned",
  mortalsWelcomed: "mortalsWelcomed",
  guardianOfOlympus: "guardianOfOlympus",
  chapter5Complete: "chapter5Complete",
} as const;

export const CHAPTER_5_QUEST = "chapter5";

export const CHAPTER_5_ENTERED: StoryAction[] = [{ type: "setFlag", flag: CH5_FLAGS.chapter5Entered }];
export const ALLIES_BRIEFED: StoryAction[] = [{ type: "setFlag", flag: CH5_FLAGS.alliesBriefed }];
export const ENCHANTMENTS_BROKEN: StoryAction[] = [{ type: "setFlag", flag: CH5_FLAGS.enchantmentsBroken }];
export const APHRODITE_YIELDED: StoryAction[] = [{ type: "setFlag", flag: CH5_FLAGS.aphroditeYielded }];
export const BOLT_RETRIEVED: StoryAction[] = [
  { type: "addItem", item: MASTER_BOLT },
  { type: "setFlag", flag: CH5_FLAGS.boltRetrieved },
];
export const ZEUS_FREED: StoryAction[] = [{ type: "setFlag", flag: CH5_FLAGS.zeusFreed }];
export const BOLT_RETURNED: StoryAction[] = [
  { type: "removeItem", item: MASTER_BOLT },
  { type: "setFlag", flag: CH5_FLAGS.boltReturned },
];
export const OLYMPUS_RESTORED: StoryAction[] = [
  { type: "setFlag", flag: CH5_FLAGS.mortalsWelcomed },
  { type: "setFlag", flag: CH5_FLAGS.guardianOfOlympus },
];
export const CHAPTER_5_COMPLETE_ACTIONS: StoryAction[] = [
  { type: "setFlag", flag: CH5_FLAGS.chapter5Complete },
  { type: "completeQuest", quest: CHAPTER_5_QUEST },
];

const has = (state: Readonly<GameState>, flag: string) => state.flags[flag] === true;

/** Chapter 5 follows a completed Chapter 4: rescued, the bolt with Aphrodite, all three seals held. */
export function canEnterChapter5(state: Readonly<GameState>): boolean {
  return (
    hasAllSeals(state) &&
    has(state, CH4_FLAGS.chapter4Complete) &&
    has(state, CH4_FLAGS.playerRescued) &&
    (has(state, CH4_FLAGS.boltSurrendered) || has(state, CH5_FLAGS.boltRetrieved))
  );
}

/** Takes the bolt from the foot of the throne, once, and only after Aphrodite has set it down. */
export function tryRetrieveBolt(): boolean {
  const state = getGameState();
  if (!has(state, CH5_FLAGS.aphroditeYielded) || has(state, CH5_FLAGS.boltRetrieved) || hasItem(MASTER_BOLT)) return false;
  applyStoryActions(BOLT_RETRIEVED);
  return true;
}

/** Breaks Zeus's cage with his own bolt: only while holding it, and only once. */
export function tryFreeZeus(): boolean {
  const state = getGameState();
  if (!has(state, CH5_FLAGS.boltRetrieved) || !hasItem(MASTER_BOLT) || has(state, CH5_FLAGS.zeusFreed)) return false;
  applyStoryActions(ZEUS_FREED);
  return true;
}

/** The ending is due once Zeus has named the Guardian (and has not happened yet). */
export function isEndingDue(state: Readonly<GameState>): boolean {
  return has(state, CH5_FLAGS.guardianOfOlympus) && !has(state, CH5_FLAGS.chapter5Complete);
}

/** Completes the game once, and only if every step happened, in order. Returns true if it did. */
export function completeChapter5IfReady(): boolean {
  const state = getGameState();
  const everyStep = CHAPTER_5_STEPS.every((step) => step.done(state));
  if (!everyStep || !isEndingDue(state)) return false;
  applyStoryActions(CHAPTER_5_COMPLETE_ACTIONS);
  return true;
}

export interface Chapter5Step {
  id: string;
  label: string;
  done: (state: Readonly<GameState>) => boolean;
}

export const CHAPTER_5_STEPS: Chapter5Step[] = [
  { id: "allies", label: "Talk to Athena and Ares.", done: (s) => has(s, CH5_FLAGS.alliesBriefed) },
  { id: "charms", label: "Break Aphrodite's three enchantments.", done: (s) => has(s, CH5_FLAGS.enchantmentsBroken) },
  { id: "aphrodite", label: "Confront Aphrodite in the throne room.", done: (s) => has(s, CH5_FLAGS.aphroditeYielded) },
  { id: "bolt", label: "Take back the Master Lightning Bolt.", done: (s) => has(s, CH5_FLAGS.boltRetrieved) },
  { id: "free", label: "Free Zeus.", done: (s) => has(s, CH5_FLAGS.zeusFreed) },
  { id: "return", label: "Return the bolt to Zeus.", done: (s) => has(s, CH5_FLAGS.boltReturned) },
  { id: "mortals", label: "Speak with Zeus for mortalkind.", done: (s) => has(s, CH5_FLAGS.guardianOfOlympus) },
];

export function getChapter5Objective(state: Readonly<GameState>): string {
  if (has(state, CH5_FLAGS.chapter5Complete)) return `You are the ${GUARDIAN_TITLE}.`;
  const next = CHAPTER_5_STEPS.find((step) => !step.done(state));
  if (!next) return "Olympus is restored.";
  if (next.id === "free") return "Free Zeus: strike his cage with the bolt (press E at the cage).";
  return next.label;
}
