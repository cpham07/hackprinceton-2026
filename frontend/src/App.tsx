import { useCallback, useEffect, useState } from "react";
import DialogueBox from "./components/DialogueBox";
import GameCanvas from "./components/GameCanvas";
import { EventBus } from "./game/EventBus";
import { NPCS } from "./game/data/npcs";
import { getMockNpcLine } from "./game/dialogue/mockDialogue";
import { setFlag } from "./game/state/gameState";
import type { DialogueLine, PlayerResponse } from "./game/types/dialogue";

interface DialogueSession {
  npcId: string;
  lines: DialogueLine[];
  /** Number of player replies so far; picks the NPC's next scripted line. */
  turn: number;
}

export default function App() {
  const [dialogue, setDialogue] = useState<DialogueSession | null>(null);

  // Phaser asks for a dialogue; React decides whether to open one.
  useEffect(() => {
    return EventBus.on("dialogue:request", ({ npcId }) => {
      if (!NPCS[npcId]) return;
      setDialogue(
        (current) =>
          current ?? {
            npcId,
            lines: [{ speaker: "npc", text: getMockNpcLine(npcId, 0) }],
            turn: 0,
          },
      );
    });
  }, []);

  // Tell Phaser when the overlay is actually shown or hidden.
  const openNpcId = dialogue?.npcId ?? null;
  useEffect(() => {
    if (!openNpcId) return;
    EventBus.emit("dialogue:opened", { npcId: openNpcId });
    setFlag(`met:${openNpcId}`);
    return () => EventBus.emit("dialogue:closed");
  }, [openNpcId]);

  /**
   * The single entry point for player replies. Typed text comes through here now;
   * voice transcriptions will call it later with method "voice".
   */
  const submitPlayerResponse = useCallback((response: PlayerResponse) => {
    const text = response.text.trim();
    if (!text) return;
    setDialogue((current) => {
      if (!current || current.npcId !== response.npcId) return current;
      const turn = current.turn + 1;
      return {
        ...current,
        turn,
        lines: [
          ...current.lines,
          { speaker: "player", text },
          { speaker: "npc", text: getMockNpcLine(current.npcId, turn) },
        ],
      };
    });
  }, []);

  const closeDialogue = useCallback(() => setDialogue(null), []);

  return (
    <div className="game-shell">
      <GameCanvas />
      {dialogue && (
        <DialogueBox
          key={dialogue.npcId}
          npcName={NPCS[dialogue.npcId].name}
          lines={dialogue.lines}
          onSubmit={(text) =>
            submitPlayerResponse({ npcId: dialogue.npcId, text, method: "text" })
          }
          onClose={closeDialogue}
        />
      )}
    </div>
  );
}
