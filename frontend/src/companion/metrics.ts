/**
 * Speaking measurements that come from real data: the recorder's elapsed time and the confirmed
 * transcript's word count. Nothing here is estimated from text alone, and nothing is a judgement.
 */

/** Shorter than this, a recording time is too unreliable to turn into a rate. */
export const MIN_WPM_DURATION_MS = 1_000;
/** A longer "recording" means the timer is wrong (e.g. a sleeping laptop), so it is not used. */
export const MAX_DURATION_MS = 10 * 60 * 1_000;

/** The recording time if it is a usable measurement, otherwise null ("unavailable"). Never guessed. */
export function validDurationMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_DURATION_MS) return null;
  return Math.round(value);
}

/** Words in the confirmed transcript: tokens that contain a letter or digit ("don't" and "well-known" are one each). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * Approximate words per minute, or null when it cannot be measured honestly.
 * Approximate because the recording time includes pauses, silence and the time before and after speaking.
 */
export function approximateWpm(words: number, durationMs: unknown): number | null {
  const duration = validDurationMs(durationMs);
  if (duration === null || duration < MIN_WPM_DURATION_MS || !Number.isFinite(words) || words < 1) return null;
  return Math.round(words / (duration / 60_000));
}

/** "42 s", "2 min 05 s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds} s` : `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}
