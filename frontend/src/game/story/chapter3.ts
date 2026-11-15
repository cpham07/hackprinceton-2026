import { getGameState, hasItem, type GameState } from "../state/gameState";
import { applyStoryActions, type StoryAction } from "./actions";
import { CH2_FLAGS, hasAllSeals } from "./chapter2";

/** Chapter 3 story data: flags, key items, rewards and the objectives shown in the HUD. */

export const CHAPTER_3_TITLE = "Chapter 3: The Forbidden Vault";

export const CH3_FLAGS = {
  palaceEntered: "palaceEntered",
  statuePuzzleSolved: "statuePuzzleSolved",
  guardsPassed: "guardsPassed",
  vaultOpen: "vaultOpen",
  zeusConfrontationComplete: "zeusConfrontationComplete",
  chapter3Complete: "chapter3Complete",
} as const;

/** The key item at the heart of the story. */
export const MASTER_BOLT = "masterLightningBolt";
export const CHAPTER_3_QUEST = "chapter3";

/** Applied when the player first arrives in the palace. */
export const PALACE_ENTERED: StoryAction[] = [{ type: "setFlag", flag: CH3_FLAGS.palaceEntered }];
/** Applied when both statues stand on their plates at the same time. */
export const PRESSURE_PUZZLE_REWARD: StoryAction[] = [{ type: "setFlag", flag: CH3_FLAGS.statuePuzzleSolved }];
/** Applied when the guards, having seen the badge, let the player through. */
export const GUARDS_PASSED: StoryAction[] = [{ type: "setFlag", flag: CH3_FLAGS.guardsPassed }];
/** Applied when the three seals open the vault door. */
export const VAULT_OPENED: StoryAction[] = [{ type: "setFlag", flag: CH3_FLAGS.vaultOpen }];
export const BOLT_COLLECTED: StoryAction[] = [{ type: "addItem", item: MASTER_BOLT }];
/** Applied when Zeus's last line is revealed: the escape route is now open. */
export const ZEUS_CONFRONTED: StoryAction[] = [{ type: "setFlag", flag: CH3_FLAGS.zeusConfrontationComplete }];
export const CHAPTER_3_COMPLETE_ACTIONS: StoryAction[] = [
  { type: "setFlag", flag: CH3_FLAGS.chapter3Complete },
  { type: "completeQuest", quest: CHAPTER_3_QUEST },
  { type: "setChapter", chapter: 4 },
];

const has = (state: Readonly<GameState>, flag: string) => state.flags[flag] === true;

/**
 * The guards accept the Warrior Badge, which is Ares's Seal of Courage: completing Ares's
 * challenge is the proof, so nobody has to repeat it and there is no second badge state to drift.
 */
export function hasWarriorBadge(state: Readonly<GameState>): boolean {
  return state.seals.ares;
}

/** The palace is entered only after all three seals are held and Chapter 2 has been completed. */
export function canEnterPalace(state: Readonly<GameState>): boolean {
  return hasAllSeals(state) && has(state, CH2_FLAGS.chapter2Complete);
}

/** The vault opens with the three seals. Returns true if it was opened by this call. */
export function tryOpenVault(): boolean {
  const state = getGameState();
  if (!hasAllSeals(state) || has(state, CH3_FLAGS.vaultOpen)) return false;
  applyStoryActions(VAULT_OPENED);
  return true;
}

/** The bolt can be taken once, and only from an open vault. Returns true if it was taken by this call. */
export function tryCollectBolt(): boolean {
  const state = getGameState();
  if (!hasAllSeals(state) || !has(state, CH3_FLAGS.vaultOpen) || hasItem(MASTER_BOLT)) return false;
  applyStoryActions(BOLT_COLLECTED);
  return true;
}

/**
 * Completes Chapter 3 if (and only if) the player holds the Master Lightning Bolt, has finished
 * the confrontation with Zeus, and the chapter is not already complete.
 * Returns true if the chapter was completed by this call.
 */
export function completeChapter3IfReady(): boolean {
  const state = getGameState();
  const ready =
    hasItem(MASTER_BOLT) && has(state, CH3_FLAGS.zeusConfrontationComplete) && !has(state, CH3_FLAGS.chapter3Complete);
  if (!ready) return false;
  applyStoryActions(CHAPTER_3_COMPLETE_ACTIONS);
  return true;
}

export interface ChapterStep {
  id: string;
  label: string;
  done: (state: Readonly<GameState>) => boolean;
}

/** The six objectives, in order. Each is derived from the game state. */
export const CHAPTER_3_STEPS: ChapterStep[] = [
  { id: "enter", label: "Enter Zeus's palace.", done: (s) => has(s, CH3_FLAGS.palaceEntered) },
  { id: "puzzle", label: "Solve the pressure-plate puzzle.", done: (s) => has(s, CH3_FLAGS.statuePuzzleSolved) },
  { id: "guards", label: "Bypass the palace guards.", done: (s) => has(s, CH3_FLAGS.guardsPassed) },
  { id: "bolt", label: "Retrieve the Master Lightning Bolt.", done: (s) => s.inventory.includes(MASTER_BOLT) },
  { id: "zeus", label: "Confront Zeus.", done: (s) => has(s, CH3_FLAGS.zeusConfrontationComplete) },
  { id: "escape", label: "Escape the palace.", done: (s) => has(s, CH3_FLAGS.chapter3Complete) },
];

export function getChapter3Objective(state: Readonly<GameState>): string {
  const next = CHAPTER_3_STEPS.find((step) => !step.done(state));
  if (!next) return "Chapter 3 complete.";
  if (next.id === "bolt" && !has(state, CH3_FLAGS.vaultOpen)) {
    return "Unlock the vault with the three seals, then retrieve the Master Lightning Bolt.";
  }
  return next.label;
}
