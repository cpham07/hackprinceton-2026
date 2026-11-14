/**
 * Deterministic phrase matching on normalized text. Works the same for typed text
 * and for speech-to-text transcriptions.
 */

/** Lowercases, strips accents and punctuation, and collapses whitespace: "Somnus,  LET" -> "somnus let". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * True when `input` contains every word of `phrase`, in order and adjacent,
 * ignoring case, punctuation, spacing and any surrounding words.
 * A single keyword or a phrase with words missing does not match.
 */
export function containsPhrase(input: string, phrase: string): boolean {
  const target = normalizeText(phrase);
  if (!target) return false;
  return ` ${normalizeText(input)} `.includes(` ${target} `);
}
