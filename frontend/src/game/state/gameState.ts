/**
 * Authoritative story state. Plain TypeScript: no Phaser or React imports.
 * Phaser and React both read and write through the functions below.
 */

export type SealId = "athena" | "ares" | "hades";

export interface GameState {
  chapter: 1 | 2 | 3 | 4 | 5;
  inventory: string[];
  clues: string[];
  completedQuests: string[];
  seals: Record<SealId, boolean>;
  flags: Record<string, boolean>;
}

export function createInitialGameState(): GameState {
  return {
    chapter: 1,
    inventory: [],
    clues: [],
    completedQuests: [],
    seals: { athena: false, ares: false, hades: false },
    flags: {},
  };
}

let state: GameState = createInitialGameState();
const listeners = new Set<() => void>();

function update(next: GameState): void {
  state = next;
  for (const listener of [...listeners]) listener();
}

/** Current state. Treat as read-only; a new object is created on every change. */
export function getGameState(): Readonly<GameState> {
  return state;
}

/** Subscribe to changes. Returns an unsubscribe function (works with useSyncExternalStore). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setFlag(name: string, value = true): void {
  if (state.flags[name] === value) return;
  update({ ...state, flags: { ...state.flags, [name]: value } });
}

export function resetGameState(): void {
  update(createInitialGameState());
}
