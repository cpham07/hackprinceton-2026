/**
 * Contextual NPC dialogue contract (Speech S2).
 * PROVISIONAL: the backend has no dialogue route yet (only GET /health), so the
 * path and shape below are a proposal for the backend team to confirm.
 */
import type { Chapter, GameState } from "../../game/state/gameState";
import type { StoryAction } from "../../game/story/actions";

export type NpcId = "aphrodite" | "athena" | "ares" | "hades" | "zeus";

export interface ConversationTurn {
  speaker: "npc" | "player";
  text: string;
}

/** The only slice of GameState the backend sees. Never the whole state. */
export interface StoryContext {
  /** Only flags the caller explicitly whitelisted, value true. */
  relevantFlags: Record<string, boolean>;
  clues: string[];
  inventory: string[];
  completedQuests: string[];
  seals: GameState["seals"];
}

export interface NpcDialogueRequest {
  npcId: string;
  playerText: string;
  chapter: Chapter;
  /** Recent turns only (capped by buildNpcDialogueRequest). */
  conversationHistory: ConversationTurn[];
  storyContext: StoryContext;
}

/**
 * What the backend may *suggest*. It is untrusted: see proposedAction.ts.
 * Mirrors the shape of StoryAction on purpose, but is a separate type so an
 * unvalidated value can never be passed to applyStoryActions by accident.
 */
export type ProposedAction =
  | { type: "setFlag"; flag: string }
  | { type: "addClue"; clue: string }
  | { type: "completeQuest"; quest: string }
  | { type: "grantSeal"; seal: "athena" | "ares" | "hades" };

export interface NpcDialogueResponse {
  npcResponse: string;
  proposedAction: ProposedAction | null;
}

/** Where a reply came from. A mock reply must never be presented as a real one. */
export type ReplySource = "api" | "mock";

export interface NpcReply extends NpcDialogueResponse {
  source: ReplySource;
}

export const MAX_HISTORY_TURNS = 8;

export interface BuildRequestInput {
  npcId: string;
  playerText: string;
  state: Readonly<GameState>;
  history: ConversationTurn[];
  /** Flag names this NPC's conversation may depend on. Others are not sent. */
  relevantFlagNames: string[];
}

export function buildNpcDialogueRequest(input: BuildRequestInput): NpcDialogueRequest {
  const { state } = input;
  const relevantFlags: Record<string, boolean> = {};
  for (const name of input.relevantFlagNames) {
    if (state.flags[name] === true) relevantFlags[name] = true;
  }
  return {
    npcId: input.npcId,
    playerText: input.playerText.trim(),
    chapter: state.chapter,
    conversationHistory: input.history.slice(-MAX_HISTORY_TURNS),
    storyContext: {
      relevantFlags,
      clues: [...state.clues],
      inventory: [...state.inventory],
      completedQuests: [...state.completedQuests],
      seals: { ...state.seals },
    },
  };
}

/** Convert a validated proposal into the game's StoryAction (only called after validation). */
export function toStoryAction(action: ProposedAction): StoryAction {
  return action;
}
