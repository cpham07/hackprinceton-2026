import { getGameState, type GameState } from "../state/gameState";
import { applyStoryActions, type StoryAction } from "./actions";
import { hasAllSeals } from "./chapter2";
import { CH3_FLAGS, MASTER_BOLT } from "./chapter3";

/**
 * Chapter 4 story data: flags, key items, reward actions, the betrayal's beat order, and the
 * objectives shown in the HUD.
 *
 * Who holds the Master Lightning Bolt is recorded in exactly one place: the inventory. The flags
 * below record events (the bolt WAS surrendered), never ownership.
 */

export const CHAPTER_4_TITLE = "Chapter 4: The Betrayal";

export const CH4_FLAGS = {
  chapter4Entered: "chapter4Entered",
  aphroditeConfronted: "aphroditeConfronted",
  boltSurrendered: "boltSurrendered",
  betrayalRevealed: "betrayalRevealed",
  zeusImprisoned: "zeusImprisoned",
  playerRescued: "playerRescued",
  chapter4Complete: "chapter4Complete",
} as const;

/** Aphrodite's "gift". The id matches what the backend's story rules already expect. */
export const APHRODITE_NECKLACE = "aphroditeNecklace";
export const CHAPTER_4_QUEST = "chapter4";

export const CHAPTER_4_ENTERED: StoryAction[] = [{ type: "setFlag", flag: CH4_FLAGS.chapter4Entered }];
/** Shown when Aphrodite greets the player: she fastens her necklace on them and asks for the bolt. */
export const APHRODITE_CONFRONTED: StoryAction[] = [
  { type: "setFlag", flag: CH4_FLAGS.aphroditeConfronted },
  { type: "addItem", item: APHRODITE_NECKLACE },
];
/** The bolt leaves the inventory (the only record of ownership) and the event is recorded. */
export const BOLT_SURRENDERED: StoryAction[] = [
  { type: "removeItem", item: MASTER_BOLT },
  { type: "setFlag", flag: CH4_FLAGS.boltSurrendered },
];
export const BETRAYAL_REVEALED: StoryAction[] = [{ type: "setFlag", flag: CH4_FLAGS.betrayalRevealed }];
export const ZEUS_IMPRISONED: StoryAction[] = [{ type: "setFlag", flag: CH4_FLAGS.zeusImprisoned }];
/** Athena and Ares shatter the necklace: it leaves the inventory and the player can move again. */
export const PLAYER_RESCUED: StoryAction[] = [
  { type: "removeItem", item: APHRODITE_NECKLACE },
  { type: "setFlag", flag: CH4_FLAGS.playerRescued },
];
export const CHAPTER_4_COMPLETE_ACTIONS: StoryAction[] = [
  { type: "setFlag", flag: CH4_FLAGS.chapter4Complete },
  { type: "completeQuest", quest: CHAPTER_4_QUEST },
  { type: "setChapter", chapter: 5 },
];

const has = (state: Readonly<GameState>, flag: string) => state.flags[flag] === true;

/**
 * Chapter 4 is entered only from a completed Chapter 3: all three seals, the chapter-3 completion,
 * and the bolt either still in hand or already surrendered within this chapter.
 */
export function canEnterChapter4(state: Readonly<GameState>): boolean {
  return (
    hasAllSeals(state) &&
    has(state, CH3_FLAGS.chapter3Complete) &&
    (state.inventory.includes(MASTER_BOLT) || has(state, CH4_FLAGS.boltSurrendered))
  );
}

/**
 * The necklace holds the player still from the betrayal until the rescue. Derived from the story
 * state, never stored, so no transition, reload or interruption can leave the player frozen: the
 * rescue is always reachable from where the player stands.
 */
export function isImmobilized(state: Readonly<GameState>): boolean {
  return has(state, CH4_FLAGS.betrayalRevealed) && !has(state, CH4_FLAGS.playerRescued);
}

/** The next scripted beat once the bolt has changed hands, in strict order. */
export type Chapter4Beat = "reveal" | "imprison" | "rescue" | "complete";

export function nextChapter4Beat(state: Readonly<GameState>): Chapter4Beat | null {
  if (!has(state, CH4_FLAGS.boltSurrendered)) return null; // nothing happens before the transfer
  if (!has(state, CH4_FLAGS.betrayalRevealed)) return "reveal";
  if (!has(state, CH4_FLAGS.zeusImprisoned)) return "imprison";
  if (!has(state, CH4_FLAGS.playerRescued)) return "rescue";
  if (!has(state, CH4_FLAGS.chapter4Complete)) return "complete";
  return null;
}

/** Completes Chapter 4 once, and only after every beat has happened. Returns true if it did. */
export function completeChapter4IfReady(): boolean {
  const state = getGameState();
  if (nextChapter4Beat(state) !== "complete") return false;
  applyStoryActions(CHAPTER_4_COMPLETE_ACTIONS);
  return true;
}

export interface Chapter4Step {
  id: string;
  label: string;
  done: (state: Readonly<GameState>) => boolean;
}

export const CHAPTER_4_STEPS: Chapter4Step[] = [
  { id: "meet", label: "Meet Aphrodite outside Zeus's palace.", done: (s) => has(s, CH4_FLAGS.aphroditeConfronted) },
  { id: "bolt", label: "Give Aphrodite the Master Lightning Bolt.", done: (s) => has(s, CH4_FLAGS.boltSurrendered) },
  { id: "betrayal", label: "Survive Aphrodite's betrayal.", done: (s) => has(s, CH4_FLAGS.zeusImprisoned) },
  { id: "rescue", label: "Break free with Athena and Ares.", done: (s) => has(s, CH4_FLAGS.playerRescued) },
];

export function getChapter4Objective(state: Readonly<GameState>): string {
  if (has(state, CH4_FLAGS.chapter4Complete)) return "Chapter 4 complete.";
  if (isImmobilized(state)) {
    return has(state, CH4_FLAGS.zeusImprisoned) ? "You cannot move. Talk to Athena." : "You cannot move!";
  }
  const next = CHAPTER_4_STEPS.find((step) => !step.done(state));
  return next ? next.label : "Catch your breath with Athena and Ares.";
}
