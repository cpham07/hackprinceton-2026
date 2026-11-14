export type InputMethod = "text" | "voice";

/** A normalized player reply. Typed text and (later) voice transcriptions both use this shape. */
export interface PlayerResponse {
  npcId: string;
  text: string;
  method: InputMethod;
}

export interface DialogueLine {
  speaker: "npc" | "player";
  text: string;
}
