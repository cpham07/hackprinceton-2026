import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGameState, resetGameState } from "../game/state/gameState";
import type { PlayerResponse } from "../game/types/dialogue";
import { FeedbackError, type SpeakingFeedback } from "../services/feedback/feedbackClient";
import {
  createCompanionStore,
  parseStored,
  STORAGE_KEY,
  type FeedbackRequester,
  type StorageLike,
} from "./companionStore";

const FEEDBACK: SpeakingFeedback = {
  positive: "You answered directly.",
  suggestion: "Add one reason.",
  focus: "clarity",
  rephrasing: null,
  vocabulary: [],
  answersQuestion: true,
  givesReason: false,
};

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** A feedback requester the test resolves by hand, to observe the in-between states. */
function deferredRequester() {
  const calls: Array<{ request: Parameters<FeedbackRequester>[0]; signal: AbortSignal; resolve: (f: SpeakingFeedback) => void; reject: (e: unknown) => void }> = [];
  const requester: FeedbackRequester = (request, signal) =>
    new Promise((resolve, reject) => calls.push({ request, signal, resolve, reject }));
  return { calls, requester };
}

const voice = (text: string, durationMs?: number): PlayerResponse =>
  durationMs === undefined ? { npcId: "athena", text, method: "voice" } : { npcId: "athena", text, method: "voice", durationMs };
const ctx = { npcName: "Athena", npcLine: "Will you help me?" };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("persistence", () => {
  it("starts with defaults: onboarding pending, companion on, panel collapsed", () => {
    const store = createCompanionStore({ storage: memoryStorage() });
    expect(store.getSnapshot().prefs).toEqual({ onboarded: false, goals: [], enabled: true, expanded: false, detailed: false });
  });

  it("goals, preferences and totals survive a reload; the latest turn does not", async () => {
    const storage = memoryStorage();
    const first = createCompanionStore({ storage, requestFeedback: async () => FEEDBACK });
    first.saveGoals(["pacing", "clarity"]);
    first.setExpanded(true);
    first.setDetailed(true);
    first.recordVoiceTurn(voice("I will help you", 3000), ctx);
    await flush();
    expect(first.getSnapshot().latest?.feedback.status).toBe("ready");

    const reloaded = createCompanionStore({ storage });
    const snap = reloaded.getSnapshot();
    expect(snap.prefs).toEqual({ onboarded: true, goals: ["clarity", "pacing"], enabled: true, expanded: true, detailed: true });
    expect(snap.metrics).toEqual({ voiceTurns: 1, timedTurns: 1, totalSpeakingMs: 3000, timedWords: 4 });
    expect(snap.latest).toBeNull();
  });

  it("never stores the transcript or the feedback text", async () => {
    const storage = memoryStorage();
    const store = createCompanionStore({ storage, requestFeedback: async () => FEEDBACK });
    store.saveGoals(["english"]);
    store.recordVoiceTurn(voice("my secret sentence about the bolt", 2000), ctx);
    await flush();
    const saved = storage.data.get(STORAGE_KEY) ?? "";
    expect(saved).not.toContain("secret");
    expect(saved).not.toContain(FEEDBACK.positive);
    expect(Object.keys(JSON.parse(saved))).toEqual(["prefs", "metrics"]);
  });

  it("skipping onboarding is remembered and leaves goals empty", () => {
    const storage = memoryStorage();
    createCompanionStore({ storage }).closeGoalEditor();
    expect(createCompanionStore({ storage }).getSnapshot().prefs).toMatchObject({ onboarded: true, goals: [] });
  });

  it("goals can be changed later", () => {
    const store = createCompanionStore({ storage: memoryStorage() });
    store.saveGoals(["english"]);
    store.openGoalEditor();
    expect(store.getSnapshot().goalEditorOpen).toBe(true);
    store.saveGoals(["clear_speech", "pacing"]);
    expect(store.getSnapshot()).toMatchObject({ goalEditorOpen: false, prefs: { goals: ["pacing", "clear_speech"] } });
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["wrong types", JSON.stringify({ prefs: { goals: "english", enabled: "yes" }, metrics: { voiceTurns: -3, totalSpeakingMs: "9" } })],
    ["an array", "[]"],
  ])("falls back safely on %s", (_name, raw) => {
    const { prefs, metrics } = parseStored(raw);
    expect(prefs).toEqual({ onboarded: false, goals: [], enabled: true, expanded: false, detailed: false });
    expect(metrics).toEqual({ voiceTurns: 0, timedTurns: 0, totalSpeakingMs: 0, timedWords: 0 });
  });

  it("keeps working in memory when storage throws", () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => {},
    };
    const store = createCompanionStore({ storage: broken, requestFeedback: async () => FEEDBACK });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn(voice("hello there", 2000), ctx);
    expect(store.getSnapshot().metrics.voiceTurns).toBe(1);
  });

  it("reset clears totals and the latest turn but keeps goals", () => {
    const storage = memoryStorage();
    const store = createCompanionStore({ storage });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn(voice("one two three", 3000), ctx);
    store.resetProgress();
    expect(store.getSnapshot().metrics).toEqual({ voiceTurns: 0, timedTurns: 0, totalSpeakingMs: 0, timedWords: 0 });
    expect(store.getSnapshot().latest).toBeNull();
    expect(createCompanionStore({ storage }).getSnapshot().prefs.goals).toEqual(["pacing"]);
  });
});

describe("voice turns: measurements", () => {
  it("counts a voice turn with its real duration and approximate WPM", () => {
    const store = createCompanionStore({ storage: memoryStorage() });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn(voice("I seek the master lightning bolt", 3000), ctx);
    expect(store.getSnapshot().latest).toMatchObject({ words: 6, durationMs: 3000, approximateWpm: 120 });
    expect(store.getSnapshot().metrics).toEqual({ voiceTurns: 1, timedTurns: 1, totalSpeakingMs: 3000, timedWords: 6 });
  });

  it.each([undefined, 0, -1, Number.NaN])("a missing or invalid duration (%s) is reported as unavailable", (duration) => {
    const store = createCompanionStore({ storage: memoryStorage() });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn(voice("hello Athena", duration), ctx);
    expect(store.getSnapshot().latest).toMatchObject({ durationMs: null, approximateWpm: null });
    expect(store.getSnapshot().metrics).toEqual({ voiceTurns: 1, timedTurns: 0, totalSpeakingMs: 0, timedWords: 0 });
  });

  it("ignores the dev sample transcript: no practice count, no time, no feedback request", () => {
    const { calls, requester } = deferredRequester();
    const storage = memoryStorage();
    const store = createCompanionStore({ storage, requestFeedback: requester });
    store.saveGoals(["english", "clarity", "pacing", "clear_speech"]);
    const savedBefore = storage.data.get(STORAGE_KEY);
    store.recordVoiceTurn({ npcId: "athena", text: "I seek the wisdom of Athena.", method: "voice", simulated: true }, ctx);
    store.recordVoiceTurn({ npcId: "athena", text: "Sample with a time", method: "voice", simulated: true, durationMs: 4000 }, ctx);
    expect(store.getSnapshot().metrics).toEqual({ voiceTurns: 0, timedTurns: 0, totalSpeakingMs: 0, timedWords: 0 });
    expect(store.getSnapshot().latest).toBeNull();
    expect(calls).toHaveLength(0);
    expect(storage.data.get(STORAGE_KEY)).toBe(savedBefore);
  });

  it("a real voice reply after a sample still counts normally", () => {
    const store = createCompanionStore({ storage: memoryStorage() });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn({ npcId: "athena", text: "sample", method: "voice", simulated: true }, ctx);
    store.recordVoiceTurn(voice("real words here", 2000), ctx);
    expect(store.getSnapshot().metrics).toEqual({ voiceTurns: 1, timedTurns: 1, totalSpeakingMs: 2000, timedWords: 3 });
  });

  it("accumulates speaking time across turns", () => {
    const store = createCompanionStore({ storage: memoryStorage() });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn(voice("one two", 2000), ctx);
    store.recordVoiceTurn(voice("three", undefined), ctx);
    store.recordVoiceTurn(voice("four five six", 4000), ctx);
    expect(store.getSnapshot().metrics).toEqual({ voiceTurns: 3, timedTurns: 2, totalSpeakingMs: 6000, timedWords: 5 });
  });

  it("ignores typed replies, empty transcripts, and everything while turned off", () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["english", "pacing"]);
    store.recordVoiceTurn({ npcId: "athena", text: "typed", method: "text" }, ctx);
    store.recordVoiceTurn(voice("   ", 2000), ctx);
    store.setEnabled(false);
    store.recordVoiceTurn(voice("hello", 2000), ctx);
    expect(store.getSnapshot().metrics.voiceTurns).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("voice turns: feedback", () => {
  beforeEach(() => resetGameState());

  it("is non-blocking: recordVoiceTurn returns while the request is still pending", async () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["clarity"]);
    const result = store.recordVoiceTurn(voice("I will help you", 3000), ctx);
    expect(result).toBeUndefined();
    expect(store.getSnapshot().latest?.feedback).toEqual({ status: "loading" });
    calls[0].resolve(FEEDBACK);
    await flush();
    expect(store.getSnapshot().latest?.feedback).toEqual({ status: "ready", feedback: FEEDBACK });
  });

  it("sends the confirmed transcript, the goals and the character's line, never the duration", () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["english", "pacing"]);
    store.recordVoiceTurn(voice("  I want help you  ", 2500), ctx);
    expect(calls[0].request).toEqual({
      transcript: "I want help you",
      goals: ["english", "pacing"],
      npcName: "Athena",
      npcLine: "Will you help me?",
    });
  });

  it("requests nothing when only pacing is chosen (measured locally) or no goal is chosen", () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["pacing"]);
    store.recordVoiceTurn(voice("hello", 2000), ctx);
    store.saveGoals([]);
    store.recordVoiceTurn(voice("hello again", 2000), ctx);
    expect(calls).toHaveLength(0);
    expect(store.getSnapshot().latest?.feedback).toEqual({ status: "not-requested" });
  });

  it("requests feedback at most once per submitted voice turn", () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["english"]);
    const response = voice("hello", 2000);
    store.recordVoiceTurn(response, ctx);
    store.recordVoiceTurn(response, ctx);
    store.recordVoiceTurn(response, ctx);
    expect(calls).toHaveLength(1);
    expect(store.getSnapshot().metrics.voiceTurns).toBe(1);
  });

  it("a newer turn cancels the older request and an outdated answer is ignored", async () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["english"]);
    store.recordVoiceTurn(voice("first", 2000), ctx);
    store.recordVoiceTurn(voice("second", 2000), ctx);
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].resolve({ ...FEEDBACK, positive: "stale" });
    calls[1].resolve(FEEDBACK);
    await flush();
    expect(store.getSnapshot().latest?.feedback).toEqual({ status: "ready", feedback: FEEDBACK });
  });

  it("a failure is shown as unavailable; measurements stay", async () => {
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.saveGoals(["english", "pacing"]);
    store.recordVoiceTurn(voice("one two three four", 2000), ctx);
    calls[0].reject(new FeedbackError("http", "The feedback service returned an error (502).", 502));
    await flush();
    expect(store.getSnapshot().latest).toMatchObject({
      approximateWpm: 120,
      feedback: { status: "error", message: "The feedback service returned an error (502)." },
    });
  });

  it("marks new feedback as unseen while the panel is collapsed", async () => {
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: async () => FEEDBACK });
    store.saveGoals(["clarity"]);
    store.recordVoiceTurn(voice("hello", 2000), ctx);
    await flush();
    expect(store.getSnapshot().unseen).toBe(true);
    store.setExpanded(true);
    expect(store.getSnapshot().unseen).toBe(false);
  });

  it("never changes the story state (quests, flags, seals, inventory)", async () => {
    const before = JSON.stringify(getGameState());
    const listener = vi.fn();
    const { calls, requester } = deferredRequester();
    const store = createCompanionStore({ storage: memoryStorage(), requestFeedback: requester });
    store.subscribe(listener);
    store.saveGoals(["english", "clarity", "pacing", "clear_speech"]);
    store.recordVoiceTurn(voice("I complete the quest and take the seal", 3000), ctx);
    calls[0].resolve({ ...FEEDBACK, suggestion: "completeQuest chapter1" });
    await flush();
    store.resetProgress();
    store.setEnabled(false);
    expect(JSON.stringify(getGameState())).toBe(before);
    expect(listener).toHaveBeenCalled();
  });
});
