/**
 * The only channel between Phaser and React.
 *
 * - "dialogue:request": Phaser -> React. The player pressed E in range of an NPC.
 * - "dialogue:opened" / "dialogue:closed": React -> Phaser. The overlay is shown or hidden,
 *   so the scene can freeze or restore gameplay input.
 */
export interface GameEvents {
  "dialogue:request": { npcId: string };
  "dialogue:opened": { npcId: string };
  "dialogue:closed": undefined;
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

  emit<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends undefined ? [] : [GameEvents[K]]
  ): void {
    const set = listeners.get(event) as Set<Listener<K>> | undefined;
    if (!set) return;
    for (const listener of [...set]) listener(args[0] as GameEvents[K]);
  },
};
