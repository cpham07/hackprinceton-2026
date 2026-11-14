import type { Conversation } from "../dialogue/conversation";
import type { GameState } from "../state/gameState";
import { CHAPTER_1_SCRIPTS } from "./chapter1Dialogue";
import { CHAPTER_2_SCRIPTS } from "./chapter2Dialogue";
import { CHAPTER_3_SCRIPTS } from "./chapter3Dialogue";

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
  return SCRIPTS[id]?.(state) ?? null;
}
