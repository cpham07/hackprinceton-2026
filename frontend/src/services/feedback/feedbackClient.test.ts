import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackError, parseSpeakingFeedback, requestSpeakingFeedback } from "./feedbackClient";

const VALID = {
  positive: "You answered directly.",
  suggestion: "Add a reason.",
  focus: "clarity",
  rephrasing: null,
  vocabulary: [],
  answersQuestion: true,
  givesReason: false,
};

describe("parseSpeakingFeedback validates the structured feedback", () => {
  it("accepts the documented shape and drops unknown fields", () => {
    const parsed = parseSpeakingFeedback({ ...VALID, score: 9, extra: "x" });
    expect(parsed).toEqual(VALID);
    expect("score" in parsed).toBe(false);
  });

  it("caps vocabulary at two items", () => {
    const vocabulary = ["a", "b", "c"].map((word) => ({ word, meaning: "m" }));
    expect(parseSpeakingFeedback({ ...VALID, focus: "english", vocabulary }).vocabulary).toHaveLength(2);
  });

  it.each([
    ["not an object", "text"],
    ["an array", []],
    ["missing positive", { ...VALID, positive: undefined }],
    ["blank suggestion", { ...VALID, suggestion: "  " }],
    ["pacing as focus", { ...VALID, focus: "pacing" }],
    ["unknown focus", { ...VALID, focus: "accent" }],
    ["non-boolean flag", { ...VALID, answersQuestion: "yes" }],
    ["vocabulary not a list", { ...VALID, vocabulary: "brave" }],
    ["vocabulary item missing meaning", { ...VALID, vocabulary: [{ word: "brave" }] }],
    ["oversized text", { ...VALID, positive: "x".repeat(500) }],
  ])("rejects %s", (_name, data) => {
    expect(() => parseSpeakingFeedback(data)).toThrow();
  });
});

describe("requestSpeakingFeedback", () => {
  afterEach(() => vi.unstubAllGlobals());
  const request = { transcript: "I will help.", goals: ["clarity" as const] };

  it("posts the confirmed transcript and goals as JSON", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(VALID), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestSpeakingFeedback(request, { config: { baseUrl: "http://api.test/" } })).resolves.toEqual(VALID);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.test/speaking/feedback");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it.each([
    ["http", () => new Response('{"detail":"no"}', { status: 502 })],
    ["malformed", () => new Response("not json", { status: 200 })],
    ["malformed", () => new Response(JSON.stringify({ ...VALID, focus: "pacing" }), { status: 200 })],
  ])("reports a %s failure as a FeedbackError", async (kind, respond) => {
    vi.stubGlobal("fetch", vi.fn(async () => respond()));
    await expect(requestSpeakingFeedback(request)).rejects.toMatchObject({ name: "FeedbackError", kind });
  });

  it("reports an unreachable server as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(requestSpeakingFeedback(request)).rejects.toMatchObject({ kind: "network" });
  });

  it("reports a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })),
    );
    await expect(requestSpeakingFeedback(request, { config: { timeoutMs: 10 } })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("reports a caller cancellation as cancelled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })),
    );
    const controller = new AbortController();
    const pending = requestSpeakingFeedback(request, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(FeedbackError);
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
  });
});
