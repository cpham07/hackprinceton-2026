/**
 * Authoritative story state. Plain TypeScript: no Phaser or React imports.
 * Phaser and React both read and write through the functions below.
 * Every mutation is idempotent (adding a clue twice changes nothing) and notifies subscribers.
 */

export type SealId = "athena" | "ares" | "hades";
export type Chapter = 1 | 2 | 3 | 4 | 5;

export interface GameState {
  chapter: Chapter;
  inventory: string[];
  clues: string[];
  completedQuests: string[];
  seals: Record<SealId, boolean>;
  flags: Record<string, boolean>;
  /** Small numeric progress values, e.g. which position each puzzle statue is in. */
  counters: Record<string, number>;
}

export function createInitialGameState(): GameState {
  return {
    chapter: 1,
    inventory: [],
    clues: [],
    completedQuests: [],
    seals: { athena: false, ares: false, hades: false },
    flags: {},
    counters: {},
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
  if ((state.flags[name] ?? false) === value) return;
  update({ ...state, flags: { ...state.flags, [name]: value } });
}

export function hasFlag(name: string): boolean {
  return state.flags[name] === true;
}

/** Returns true if the clue was new. */
export function addClue(clueId: string): boolean {
  if (state.clues.includes(clueId)) return false;
  update({ ...state, clues: [...state.clues, clueId] });
  return true;
}

export function hasClue(clueId: string): boolean {
  return state.clues.includes(clueId);
}

/** Returns true if the quest was not already complete. */
export function completeQuest(questId: string): boolean {
  if (state.completedQuests.includes(questId)) return false;
  update({ ...state, completedQuests: [...state.completedQuests, questId] });
  return true;
}

export function hasCompletedQuest(questId: string): boolean {
  return state.completedQuests.includes(questId);
}

/** Adds a unique key item to the inventory. Returns true if it was not already held. */
export function addItem(itemId: string): boolean {
  if (state.inventory.includes(itemId)) return false;
  update({ ...state, inventory: [...state.inventory, itemId] });
  return true;
}

/** Removes an item from the inventory. Returns true if it was held. */
export function removeItem(itemId: string): boolean {
  if (!state.inventory.includes(itemId)) return false;
  update({ ...state, inventory: state.inventory.filter((item) => item !== itemId) });
  return true;
}

export function hasItem(itemId: string): boolean {
  return state.inventory.includes(itemId);
}

export function getCounter(name: string): number {
  return state.counters[name] ?? 0;
}

export function setCounter(name: string, value: number): void {
  if (getCounter(name) === value) return;
  update({ ...state, counters: { ...state.counters, [name]: value } });
}

/** Marks a seal as obtained. Returns true if it was not already held. */
export function grantSeal(sealId: SealId): boolean {
  if (state.seals[sealId]) return false;
  update({ ...state, seals: { ...state.seals, [sealId]: true } });
  return true;
}

export function hasSeal(sealId: SealId): boolean {
  return state.seals[sealId];
}

export function setChapter(chapter: Chapter): void {
  if (state.chapter === chapter) return;
  update({ ...state, chapter });
}

export function resetGameState(): void {
  update(createInitialGameState());
}
