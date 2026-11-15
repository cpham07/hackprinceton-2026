import type { PlayerResponse } from "../game/types/dialogue";
import {
  FeedbackError,
  requestSpeakingFeedback,
  type SpeakingFeedback,
  type SpeakingFeedbackRequest,
} from "../services/feedback/feedbackClient";
import { hasTextGoal, normalizeGoals, TEXT_GOALS, type GoalId } from "./goals";
import { approximateWpm, countWords, validDurationMs } from "./metrics";

/**
 * The Speaking Companion's state. Independent of the story: it never reads or writes the game state, so
 * nothing it does (or fails to do) can change quest progression.
 *
 * Persisted in this browser only: the chosen goals, panel preferences and aggregate practice totals.
 * Never persisted: audio (never reaches this module), transcripts, or feedback text. The latest turn's
 * measurements and feedback live in memory and are gone on reload.
 */

export interface CompanionPrefs {
  /** The goal picker has been completed or skipped. */
  onboarded: boolean;
  goals: GoalId[];
  /** Off: no measurements are taken and no feedback is requested. */
  enabled: boolean;
  /** The panel is open (otherwise only its small launcher button shows). */
  expanded: boolean;
  /** Show the optional details (rephrasing, vocabulary, clarity checks) under the main feedback. */
  detailed: boolean;
}

export interface PracticeMetrics {
  /** Voice replies confirmed and sent to a character. */
  voiceTurns: number;
  /** Of those, how many had a reliable recording time. */
  timedTurns: number;
  /** Sum of the reliable recording times (pauses included). */
  totalSpeakingMs: number;
  /** Words in the timed turns, for an overall approximate rate. */
  timedWords: number;
}

export type FeedbackState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; feedback: SpeakingFeedback }
  | { status: "error"; message: string }
  /** No transcript-based goal is selected, so nothing was requested. */
  | { status: "not-requested" };

export interface LatestTurn {
  id: number;
  npcName: string;
  words: number;
  /** null: the recording time was not reliably available. */
  durationMs: number | null;
  /** null: could not be measured (no time, or too short). */
  approximateWpm: number | null;
  feedback: FeedbackState;
}

export interface CompanionSnapshot {
  prefs: CompanionPrefs;
  metrics: PracticeMetrics;
  latest: LatestTurn | null;
  goalEditorOpen: boolean;
  /** New feedback arrived while the panel was collapsed. */
  unseen: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEY = "hackprinceton.speakingCompanion.v1";

export const DEFAULT_PREFS: CompanionPrefs = { onboarded: false, goals: [], enabled: true, expanded: false, detailed: false };
export const EMPTY_METRICS: PracticeMetrics = { voiceTurns: 0, timedTurns: 0, totalSpeakingMs: 0, timedWords: 0 };

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);

/** Reads stored data defensively: anything missing, corrupt or unknown falls back to the defaults. */
export function parseStored(raw: string | null): { prefs: CompanionPrefs; metrics: PracticeMetrics } {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    /* corrupt: use defaults */
  }
  const p = (typeof data.prefs === "object" && data.prefs !== null ? data.prefs : {}) as Record<string, unknown>;
  const m = (typeof data.metrics === "object" && data.metrics !== null ? data.metrics : {}) as Record<string, unknown>;
  const metrics: PracticeMetrics = {
    voiceTurns: count(m.voiceTurns),
    timedTurns: count(m.timedTurns),
    totalSpeakingMs: count(m.totalSpeakingMs),
    timedWords: count(m.timedWords),
  };
  metrics.timedTurns = Math.min(metrics.timedTurns, metrics.voiceTurns);
  return {
    prefs: {
      onboarded: bool(p.onboarded, DEFAULT_PREFS.onboarded),
      goals: normalizeGoals(p.goals),
      enabled: bool(p.enabled, DEFAULT_PREFS.enabled),
      expanded: bool(p.expanded, DEFAULT_PREFS.expanded),
      detailed: bool(p.detailed, DEFAULT_PREFS.detailed),
    },
    metrics,
  };
}

export type FeedbackRequester = (request: SpeakingFeedbackRequest, signal: AbortSignal) => Promise<SpeakingFeedback>;

export interface VoiceTurnContext {
  npcName: string;
  /** The character's line the player is replying to. */
  npcLine?: string;
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // storage blocked: the companion still works for this page
  }
}

export function createCompanionStore(options: { storage?: StorageLike | null; requestFeedback?: FeedbackRequester } = {}) {
  const storage = options.storage ?? null;
  const requestFeedback: FeedbackRequester =
    options.requestFeedback ?? ((request, signal) => requestSpeakingFeedback(request, { signal }));

  const stored = parseStored(safeRead());
  let snapshot: CompanionSnapshot = { ...stored, latest: null, goalEditorOpen: false, unseen: false };
  const listeners = new Set<() => void>();
  // Each confirmed response object is processed at most once, so one voice turn never triggers two requests.
  const seen = new WeakSet<PlayerResponse>();
  let nextTurnId = 1;
  let inFlight: AbortController | null = null;

  function safeRead(): string | null {
    try {
      return storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  function persist(): void {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify({ prefs: snapshot.prefs, metrics: snapshot.metrics }));
    } catch {
      /* quota or blocked storage: keep working in memory */
    }
  }

  function set(next: Partial<CompanionSnapshot>, save = false): void {
    snapshot = { ...snapshot, ...next };
    if (save) persist();
    listeners.forEach((listener) => listener());
  }

  const setPrefs = (prefs: Partial<CompanionPrefs>) => set({ prefs: { ...snapshot.prefs, ...prefs } }, true);

  function cancelFeedback(): void {
    inFlight?.abort();
    inFlight = null;
  }

  function updateLatestFeedback(turnId: number, feedback: FeedbackState): void {
    if (snapshot.latest?.id !== turnId) return; // a newer turn has replaced it
    set({ latest: { ...snapshot.latest, feedback }, unseen: !snapshot.prefs.expanded });
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: (): CompanionSnapshot => snapshot,

    /** Save the chosen goals (from onboarding or editing) and close the picker. */
    saveGoals(goals: readonly GoalId[]): void {
      set({ prefs: { ...snapshot.prefs, goals: normalizeGoals(goals), onboarded: true }, goalEditorOpen: false }, true);
    },
    /** Close the picker without changing goals. From onboarding, this is "skip": it is not shown again. */
    closeGoalEditor(): void {
      set({ prefs: { ...snapshot.prefs, onboarded: true }, goalEditorOpen: false }, true);
    },
    openGoalEditor: () => set({ goalEditorOpen: true }),
    setExpanded: (expanded: boolean) => {
      snapshot = { ...snapshot, unseen: expanded ? false : snapshot.unseen };
      setPrefs({ expanded });
    },
    setDetailed: (detailed: boolean) => setPrefs({ detailed }),
    /** Turning off cancels pending feedback and clears the latest turn; totals are kept until reset. */
    setEnabled(enabled: boolean): void {
      if (!enabled) cancelFeedback();
      snapshot = { ...snapshot, latest: enabled ? snapshot.latest : null, unseen: false };
      setPrefs({ enabled });
    },
    /** Clears practice totals and the latest turn. Goals and preferences stay. */
    resetProgress(): void {
      cancelFeedback();
      set({ metrics: { ...EMPTY_METRICS }, latest: null, unseen: false }, true);
    },

    /**
     * Call once per confirmed voice reply that was accepted by the dialogue. Returns immediately: feedback
     * is fetched in the background and never blocks or alters the conversation. Typed replies are ignored.
     */
    recordVoiceTurn(response: PlayerResponse, context: VoiceTurnContext): void {
      if (response.method !== "voice" || seen.has(response)) return;
      seen.add(response);
      if (!snapshot.prefs.enabled) return;
      const transcript = response.text.trim();
      if (!transcript) return;

      const words = countWords(transcript);
      const durationMs = validDurationMs(response.durationMs);
      const metrics: PracticeMetrics = {
        voiceTurns: snapshot.metrics.voiceTurns + 1,
        timedTurns: snapshot.metrics.timedTurns + (durationMs === null ? 0 : 1),
        totalSpeakingMs: snapshot.metrics.totalSpeakingMs + (durationMs ?? 0),
        timedWords: snapshot.metrics.timedWords + (durationMs === null ? 0 : words),
      };

      cancelFeedback();
      const goals = snapshot.prefs.goals;
      const wantsFeedback = hasTextGoal(goals);
      const turnId = nextTurnId++;
      set(
        {
          metrics,
          latest: {
            id: turnId,
            npcName: context.npcName,
            words,
            durationMs,
            approximateWpm: approximateWpm(words, durationMs),
            feedback: wantsFeedback ? { status: "loading" } : { status: "not-requested" },
          },
        },
        true,
      );
      if (!wantsFeedback) return;

      const controller = new AbortController();
      inFlight = controller;
      const request: SpeakingFeedbackRequest = {
        transcript,
        goals: goals.filter((goal) => TEXT_GOALS.includes(goal) || goal === "pacing"),
        npcName: context.npcName,
        ...(context.npcLine ? { npcLine: context.npcLine } : {}),
      };
      requestFeedback(request, controller.signal).then(
        (feedback) => updateLatestFeedback(turnId, { status: "ready", feedback }),
        (error: unknown) => {
          if (error instanceof FeedbackError && error.kind === "cancelled") return;
          const message = error instanceof Error ? error.message : "Feedback is unavailable right now.";
          updateLatestFeedback(turnId, { status: "error", message });
        },
      ).finally(() => {
        if (inFlight === controller) inFlight = null;
      });
    },
  };
}

export type CompanionStore = ReturnType<typeof createCompanionStore>;

/** The app's companion, backed by this browser's localStorage. */
export const speakingCompanion: CompanionStore = createCompanionStore({ storage: browserStorage() });
