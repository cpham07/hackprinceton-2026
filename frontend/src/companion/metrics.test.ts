import { describe, expect, it } from "vitest";
import { approximateWpm, countWords, formatDuration, MAX_DURATION_MS, validDurationMs } from "./metrics";

describe("validDurationMs: recording time is used only when it is a real, usable measurement", () => {
  it.each([
    [undefined, null],
    [null, null],
    ["4000", null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [0, null],
    [-500, null],
    [MAX_DURATION_MS + 1, null],
    [1, 1],
    [4321.6, 4322],
    [MAX_DURATION_MS, MAX_DURATION_MS],
  ])("%s -> %s", (input, expected) => {
    expect(validDurationMs(input)).toBe(expected);
  });
});

describe("countWords counts the confirmed transcript's words", () => {
  it.each([
    ["", 0],
    ["   ", 0],
    ["Zeus", 1],
    ["Aphrodite, Athena, Ares", 3],
    ["I   seek\tthe\nbolt.", 4],
    ["Don't go, well-known hero!", 4],
    ["... — !", 0],
    ["I have 3 seals", 4],
    ["Ich möchte helfen", 3],
  ])("%j -> %d", (text, expected) => {
    expect(countWords(text)).toBe(expected);
  });
});

describe("approximateWpm", () => {
  it("is words per minute of recording time", () => {
    expect(approximateWpm(60, 30_000)).toBe(120);
    expect(approximateWpm(10, 6_000)).toBe(100);
    expect(approximateWpm(7, 4_200)).toBe(100);
  });

  it("includes pauses (slower is reported as slower, never as an error)", () => {
    expect(approximateWpm(10, 20_000)).toBe(30);
  });

  it("is unavailable rather than invented when the duration is missing, invalid or too short", () => {
    expect(approximateWpm(10, undefined)).toBeNull();
    expect(approximateWpm(10, 0)).toBeNull();
    expect(approximateWpm(10, -1)).toBeNull();
    expect(approximateWpm(10, Number.NaN)).toBeNull();
    expect(approximateWpm(10, 999)).toBeNull();
    expect(approximateWpm(10, MAX_DURATION_MS + 1)).toBeNull();
  });

  it("is unavailable without words", () => {
    expect(approximateWpm(0, 5_000)).toBeNull();
    expect(approximateWpm(Number.NaN, 5_000)).toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 s"],
    [400, "0 s"],
    [42_000, "42 s"],
    [60_000, "1 min 00 s"],
    [125_400, "2 min 05 s"],
  ])("%d ms -> %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
