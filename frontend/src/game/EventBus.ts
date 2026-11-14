import type { SceneKey } from "./constants";

/**
 * The only channel between Phaser and React.
 *
 * Phaser -> React
 * - "dialogue:request": the player pressed E in range of an NPC or readable object.
 * - "puzzle:request": the player pressed E on a puzzle object.
 * - "scene:ready": a scene finished setting up and is now the active one.
 * - "challenge:complete": the player just finished a challenge for the first time.
 *
 * React -> Phaser
 * - "overlay:opened" / "overlay:closed": a gameplay-blocking overlay (dialogue, puzzle, ...)
 *   is shown or hidden. The active scene locks gameplay input while any overlay id is open.
 * - "scene:start": switch to another scene. The active scene handles it and shuts itself down.
 */
export interface GameEvents {
  "dialogue:request": { npcId: string };
  "puzzle:request": { puzzleId: string };
  "scene:ready": { key: SceneKey };
  "challenge:complete": { challengeId: string };
  "overlay:opened": { id: string };
  "overlay:closed": { id: string };
  "scene:start": { key: SceneKey };
}

type Listener<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

const listeners = new Map<keyof GameEvents, Set<unknown>>();

export const EventBus = {
  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof GameEvents>(event: K, listener: Listener<K>): () => void {
    let set = listeners.get(event);
    if (!set) listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  },

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = listeners.get(event) as Set<Listener<K>> | undefined;
    if (!set) return;
    for (const listener of [...set]) listener(payload);
  },

  /** Number of listeners for an event (used to check for leaks in development). */
  listenerCount(event: keyof GameEvents): number {
    return listeners.get(event)?.size ?? 0;
  },
};
