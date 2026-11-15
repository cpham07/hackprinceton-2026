import { getCounter, getGameState, setCounter } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import { CH5_FLAGS, ENCHANTMENTS_BROKEN } from "../story/chapter5";

/**
 * Aphrodite's three enchantments must be broken in the order she wove them (shown on the plaque
 * by the barrier). Breaking one out of turn makes them all knit back together, so the puzzle can always
 * be restarted and never gets stuck. Progress lives in the game state.
 */
export interface Enchantment {
  id: string;
  name: string;
  numeral: string;
}

/** In the order they must be broken. */
export const ENCHANTMENTS: Enchantment[] = [
  { id: "enchantVanity", name: "Vanity", numeral: "I" },
  { id: "enchantJealousy", name: "Jealousy", numeral: "II" },
  { id: "enchantDesire", name: "Desire", numeral: "III" },
];

const COUNTER = "ch5.enchantmentsBroken";

const solved = () => getGameState().flags[CH5_FLAGS.enchantmentsBroken] === true;
const briefed = () => getGameState().flags[CH5_FLAGS.alliesBriefed] === true;

export function brokenCount(): number {
  return solved() ? ENCHANTMENTS.length : Math.min(Math.max(getCounter(COUNTER), 0), ENCHANTMENTS.length);
}

export function isEnchantmentBroken(id: string): boolean {
  const index = ENCHANTMENTS.findIndex((e) => e.id === id);
  return index >= 0 && index < brokenCount();
}

export type StrikeResult = "broken" | "wrong" | "ignored";

/** Strikes one enchantment. "ignored" before the briefing, after solving, or on one already broken. */
export function strikeEnchantment(id: string): StrikeResult {
  if (!briefed() || solved() || !ENCHANTMENTS.some((e) => e.id === id) || isEnchantmentBroken(id)) return "ignored";
  const count = brokenCount();
  if (ENCHANTMENTS[count].id !== id) {
    setCounter(COUNTER, 0); // out of turn: every charm knits back together
    return "wrong";
  }
  setCounter(COUNTER, count + 1);
  if (count + 1 === ENCHANTMENTS.length) applyStoryActions(ENCHANTMENTS_BROKEN);
  return "broken";
}
