import { describe, expect, it } from "vitest";
import { wrapFocusIndex } from "./focusTrap";

describe("wrapFocusIndex keeps Tab focus inside a modal", () => {
  it("Tab on the last control wraps to the first", () => {
    expect(wrapFocusIndex(5, 6, false)).toBe(0);
  });

  it("Shift+Tab on the first control wraps to the last", () => {
    expect(wrapFocusIndex(0, 6, true)).toBe(5);
  });

  it("in between, the browser's normal order is kept", () => {
    expect(wrapFocusIndex(2, 6, false)).toBeNull();
    expect(wrapFocusIndex(2, 6, true)).toBeNull();
    expect(wrapFocusIndex(0, 6, false)).toBeNull();
    expect(wrapFocusIndex(5, 6, true)).toBeNull();
  });

  it("focus on the container or outside moves to the first (Tab) or last (Shift+Tab) control", () => {
    expect(wrapFocusIndex(-1, 6, false)).toBe(0);
    expect(wrapFocusIndex(-1, 6, true)).toBe(5);
  });

  it("a single control keeps focus on itself", () => {
    expect(wrapFocusIndex(0, 1, false)).toBe(0);
    expect(wrapFocusIndex(0, 1, true)).toBe(0);
  });

  it("nothing focusable: leave focus alone", () => {
    expect(wrapFocusIndex(-1, 0, false)).toBeNull();
  });
});
