import { describe, expect, it } from "vitest";
import { buildConfirmedResponse } from "./confirmedResponse";

describe("recording duration reaches the confirmed PlayerResponse", () => {
  it("a confirmed real transcription carries the recorder's elapsed time", () => {
    expect(buildConfirmedResponse("athena", "I will help you.", "real", 4210)).toEqual({
      npcId: "athena",
      text: "I will help you.",
      method: "voice",
      durationMs: 4210,
    });
  });

  it("an edited transcript keeps the recording's time (only the text changed)", () => {
    expect(buildConfirmedResponse("zeus", "Edited words", "real", 3000).durationMs).toBe(3000);
  });

  it.each([undefined, 0, -20, Number.NaN, Number.POSITIVE_INFINITY, 11 * 60 * 1000])(
    "an unusable duration (%s) is left out, not estimated",
    (duration) => {
      const response = buildConfirmedResponse("zeus", "Hello there", "real", duration);
      expect(response.method).toBe("voice");
      expect("durationMs" in response).toBe(false);
    },
  );

  it("the dev sample transcript is voice without a duration (no real recording)", () => {
    const response = buildConfirmedResponse("athena", "Sample", "mock", 5000);
    expect(response).toEqual({ npcId: "athena", text: "Sample", method: "voice" });
  });

  it("typed text is a text reply and never has a duration", () => {
    const response = buildConfirmedResponse("athena", "Typed", "typed", 5000);
    expect(response).toEqual({ npcId: "athena", text: "Typed", method: "text" });
  });
});
