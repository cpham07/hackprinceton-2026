import { SCENES, type SceneKey } from "../constants";
import type { GameState } from "../state/gameState";
import { canEnterPalace } from "./chapter3";
import { canEnterChapter4 } from "./chapter4";

/**
 * Story requirements for entering a scene. Checked by every scene change, so a stray
 * `scene:start` request cannot skip ahead. Based on what the player has earned,
 * not only on the chapter number.
 */
export function canEnterScene(key: SceneKey, state: Readonly<GameState>): boolean {
  if (key === SCENES.palace) return canEnterPalace(state);
  if (key === SCENES.betrayal) return canEnterChapter4(state);
  return true;
}
