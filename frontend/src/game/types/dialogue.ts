export type InputMethod = "text" | "voice";

/** A normalized player reply. Typed text and voice transcriptions both use this shape. */
export interface PlayerResponse {
  npcId: string;
  text: string;
  method: InputMethod;
  /**
   * Voice only: the real elapsed recording time (from the recorder's clock, pauses included) of the
   * recording this transcript came from. Absent for typed replies and whenever it is not reliably known.
   */
  durationMs?: number;
}

/**
 * Where a line of dialogue came from, so the UI never presents generated text as scripted.
 * - scripted: the game's own deterministic script (all story-progressing lines)
 * - ai: a reply from the conversation backend
 * - simulated: a development-only mock reply
 */
export type LineSource = "scripted" | "ai" | "simulated";

export interface DialogueLine {
  /** "system" is a note from the game itself (e.g. a server error), not something a character says. */
  speaker: "npc" | "player" | "system";
  text: string;
  source?: LineSource;
  /** How a player line was entered. */
  method?: InputMethod;
}
