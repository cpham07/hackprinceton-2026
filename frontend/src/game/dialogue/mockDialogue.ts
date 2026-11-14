import { NPCS } from "../data/npcs";

/**
 * Deterministic mock: returns the NPC's scripted line for a given turn.
 * Turn 0 is the greeting. It does not look at what the player said.
 * Replace this with the real dialogue backend later.
 */
export function getMockNpcLine(npcId: string, turn: number): string {
  const npc = NPCS[npcId];
  if (!npc) return "...";
  return (
    npc.mockLines[turn] ??
    `(${npc.name} has no more scripted lines in this prototype.)`
  );
}
