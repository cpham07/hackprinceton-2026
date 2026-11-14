import { useSyncExternalStore } from "react";
import { getGameState, subscribe, type GameState } from "../game/state/gameState";

/** Re-renders the component whenever the story state changes. */
export function useGameState(): Readonly<GameState> {
  return useSyncExternalStore(subscribe, getGameState);
}
