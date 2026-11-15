import type { Conversation } from "../dialogue/conversation";
import type { GameState } from "../state/gameState";
import { CHAPTER_1_SCRIPTS } from "./chapter1Dialogue";
import { CHAPTER_2_SCRIPTS } from "./chapter2Dialogue";
import { CHAPTER_3_SCRIPTS } from "./chapter3Dialogue";
import { CH4_FLAGS } from "./chapter4";
import { CHAPTER_4_SCRIPTS } from "./chapter4Dialogue";
import { CH5_FLAGS } from "./chapter5";
import { CHAPTER_5_SCRIPTS } from "./chapter5Dialogue";

/**
 * Scripts by interactable id. A character who appears in several chapters gets one
 * entry here that picks by state (or delegates per chapter).
 */
const SCRIPTS: Record<string, (state: Readonly<GameState>) => Conversation> = {
  ...CHAPTER_1_SCRIPTS,
  ...CHAPTER_2_SCRIPTS,
  ...CHAPTER_3_SCRIPTS,
};

export function getConversation(id: string, state: Readonly<GameState>): Conversation | null {
  // Characters who return in later chapters get that chapter's scripts once the player has arrived there.
  if (state.flags[CH5_FLAGS.chapter5Entered] === true && CHAPTER_5_SCRIPTS[id]) return CHAPTER_5_SCRIPTS[id](state);
  if (state.flags[CH4_FLAGS.chapter4Entered] === true && CHAPTER_4_SCRIPTS[id]) return CHAPTER_4_SCRIPTS[id](state);
  return SCRIPTS[id]?.(state) ?? null;
}
