/**
 * Validation boundary for AI-proposed actions. Pure functions: nothing here
 * touches GameState or applies anything. The caller applies the returned
 * StoryAction through applyStoryActions only when `ok` is true.
 */
import type { GameState } from "../../game/state/gameState";
import type { StoryAction } from "../../game/story/actions";
import { toStoryAction, type ProposedAction } from "./contract";

/** One action an NPC is allowed to propose, with its conditions. */
export interface AllowedAction {
  action: ProposedAction;
  chapters: number[];
  requiresFlags?: string[];
  requiresClues?: string[];
  requiresQuests?: string[];
}

/** Per-NPC allowlist. Anything not listed is rejected, so the default is "nothing". */
export type ActionPolicy = Record<string, AllowedAction[]>;

export type ActionVerdict = { ok: true; action: StoryAction } | { ok: false; reason: string };

function sameAction(a: ProposedAction, b: ProposedAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function alreadyGranted(action: ProposedAction, state: Readonly<GameState>): boolean {
  switch (action.type) {
    case "setFlag":
      return state.flags[action.flag] === true;
    case "addClue":
      return state.clues.includes(action.clue);
    case "completeQuest":
      return state.completedQuests.includes(action.quest);
    case "grantSeal":
      return state.seals[action.seal];
  }
}

export function validateProposedAction(
  proposed: ProposedAction | null,
  npcId: string,
  state: Readonly<GameState>,
  policy: ActionPolicy,
): ActionVerdict {
  if (!proposed) return { ok: false, reason: "No action proposed." };
  const rule = (policy[npcId] ?? []).find((entry) => sameAction(entry.action, proposed));
  if (!rule) return { ok: false, reason: `${npcId} is not allowed to propose this action.` };
  if (!rule.chapters.includes(state.chapter)) return { ok: false, reason: "Not permitted in this chapter." };
  if (rule.requiresFlags?.some((flag) => state.flags[flag] !== true)) {
    return { ok: false, reason: "A required flag is not set." };
  }
  if (rule.requiresClues?.some((clue) => !state.clues.includes(clue))) {
    return { ok: false, reason: "A required clue has not been found." };
  }
  if (rule.requiresQuests?.some((quest) => !state.completedQuests.includes(quest))) {
    return { ok: false, reason: "A required quest is not complete." };
  }
  if (alreadyGranted(proposed, state)) return { ok: false, reason: "Already granted." };
  return { ok: true, action: toStoryAction(proposed) };
}

/**
 * Empty until the story teams decide which conversations may unlock progress.
 * Seals (Chapter 2) must keep coming from deterministic quests/puzzles first.
 */
export const DEFAULT_ACTION_POLICY: ActionPolicy = {};
