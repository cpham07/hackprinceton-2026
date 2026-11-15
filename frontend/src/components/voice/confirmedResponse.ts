import { validDurationMs } from "../../companion/metrics";
import type { PlayerResponse } from "../../game/types/dialogue";

/** Where the text under review came from: a real transcription, the dev sample, or typed from scratch. */
export type TranscriptSource = "real" | "mock" | "typed";

/**
 * The response sent when the player confirms. Typed text is honestly a text reply and never carries a
 * duration. A voice reply carries the real recording time only when it came from an actual recording and
 * that time is valid; otherwise `durationMs` is left out (unavailable), never estimated from the text.
 */
export function buildConfirmedResponse(
  npcId: string,
  text: string,
  source: TranscriptSource,
  recordingDurationMs?: number,
): PlayerResponse {
  if (source === "typed") return { npcId, text, method: "text" };
  const durationMs = source === "real" ? validDurationMs(recordingDurationMs) : null;
  return durationMs === null ? { npcId, text, method: "voice" } : { npcId, text, method: "voice", durationMs };
}
