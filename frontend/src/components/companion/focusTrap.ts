/** Elements a modal's Tab cycle visits. */
export const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Where Tab / Shift+Tab should move focus to keep it inside a modal, as an index into its focusable
 * elements, or null to let the browser move focus normally (it stays inside on its own).
 * `currentIndex` is -1 when focus is not on one of them (e.g. on the modal container or outside it).
 */
export function wrapFocusIndex(currentIndex: number, count: number, backwards: boolean): number | null {
  if (count <= 0) return null;
  if (currentIndex < 0) return backwards ? count - 1 : 0;
  if (backwards && currentIndex === 0) return count - 1;
  if (!backwards && currentIndex === count - 1) return 0;
  return null;
}

/** Applies wrapFocusIndex to a Tab key press inside `container`. Returns true when it moved focus itself. */
export function trapTab(container: HTMLElement, backwards: boolean): boolean {
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = wrapFocusIndex(index, items.length, backwards);
  if (next === null) return false;
  items[next].focus();
  return true;
}
