import { TEXT_GOALS, type GoalId } from "../../companion/goals";

/** Mirrors backend/speaking_feedback.py (SpeakingFeedbackRequest / SpeakingFeedback). */
export interface SpeakingFeedbackRequest {
  /** The transcript the player confirmed (possibly edited), not the raw speech-recognition output. */
  transcript: string;
  goals: GoalId[];
  npcName?: string;
  /** What the character said just before: lets the feedback say whether the reply answers it. */
  npcLine?: string;
}

export interface SpeakingFeedback {
  positive: string;
  suggestion: string;
  focus: GoalId;
  rephrasing: string | null;
  vocabulary: Array<{ word: string; meaning: string }>;
  answersQuestion: boolean | null;
  givesReason: boolean | null;
}

export interface FeedbackConfig {
  baseUrl: string;
  path: string;
  timeoutMs: number;
}

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000",
  path: "/speaking/feedback",
  timeoutMs: 30_000,
};

export type FeedbackErrorKind = "network" | "http" | "malformed" | "timeout" | "cancelled";

export class FeedbackError extends Error {
  constructor(
    public readonly kind: FeedbackErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FeedbackError";
  }
}

const MAX_TEXT = 400;

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  if (value.length > MAX_TEXT) throw new Error(`${field} is too long`);
  return value.trim();
}

function flag(value: unknown, field: string): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean or null`);
  return value;
}

/** Runtime validation of the backend's answer. Throws Error with a reason when malformed. Extra fields are dropped. */
export function parseSpeakingFeedback(data: unknown): SpeakingFeedback {
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("response is not an object");
  const record = data as Record<string, unknown>;
  const focus = record.focus;
  if (typeof focus !== "string" || !TEXT_GOALS.includes(focus as GoalId)) throw new Error("focus is not a text goal");
  const rawVocabulary = record.vocabulary ?? [];
  if (!Array.isArray(rawVocabulary)) throw new Error("vocabulary must be a list");
  return {
    positive: text(record.positive, "positive"),
    suggestion: text(record.suggestion, "suggestion"),
    focus: focus as GoalId,
    rephrasing: record.rephrasing === null || record.rephrasing === undefined ? null : text(record.rephrasing, "rephrasing"),
    vocabulary: rawVocabulary.slice(0, 2).map((item, index) => {
      if (typeof item !== "object" || item === null) throw new Error(`vocabulary[${index}] is not an object`);
      const entry = item as Record<string, unknown>;
      return { word: text(entry.word, "vocabulary word"), meaning: text(entry.meaning, "vocabulary meaning") };
    }),
    answersQuestion: flag(record.answersQuestion, "answersQuestion"),
    givesReason: flag(record.givesReason, "givesReason"),
  };
}

export interface FeedbackRequestOptions {
  signal?: AbortSignal;
  config?: Partial<FeedbackConfig>;
}

/** Ask the backend for feedback on one confirmed transcript. Failures throw FeedbackError; nothing is faked. */
export async function requestSpeakingFeedback(
  request: SpeakingFeedbackRequest,
  options: FeedbackRequestOptions = {},
): Promise<SpeakingFeedback> {
  const config = { ...DEFAULT_FEEDBACK_CONFIG, ...options.config };
  const url = config.baseUrl.replace(/\/+$/, "") + (config.path.startsWith("/") ? config.path : `/${config.path}`);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  const abortError = () =>
    timedOut
      ? new FeedbackError("timeout", "The feedback service took too long to answer.")
      : new FeedbackError("cancelled", "The request was cancelled.");

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new FeedbackError("network", "Could not reach the feedback service.");
    }
    if (!response.ok) {
      throw new FeedbackError("http", `The feedback service returned an error (${response.status}).`, response.status);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new FeedbackError("malformed", "The feedback service sent an unreadable response.");
    }
    try {
      return parseSpeakingFeedback(data);
    } catch (error) {
      throw new FeedbackError("malformed", `Invalid feedback: ${(error as Error).message}.`);
    }
  } catch (error) {
    if (error instanceof FeedbackError) throw error;
    throw controller.signal.aborted ? abortError() : new FeedbackError("network", "The request failed.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
