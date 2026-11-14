/**
 * NPC definitions. No Phaser imports, so React can read names and lines too.
 *
 * displaySize and interactionRadius are in world pixels and are independent of the
 * texture's own dimensions: swap the art by loading an image under `textureKey`.
 */
export interface NpcDefinition {
  id: string;
  name: string;
  textureKey: string;
  /** Feet position: x in world pixels. y is the ground line of the scene. */
  x: number;
  displaySize: { width: number; height: number };
  /** Distance from the NPC's feet to the player's feet within which E works. */
  interactionRadius: number;
  /** Deterministic mock script. Line 0 is the greeting; each player reply advances one line. */
  mockLines: string[];
}

export const NPCS: Record<string, NpcDefinition> = {
  aphrodite: {
    id: "aphrodite",
    name: "Aphrodite",
    textureKey: "npc-aphrodite",
    x: 2900,
    displaySize: { width: 72, height: 132 },
    interactionRadius: 150,
    mockLines: [
      "Welcome, mortal. I am Aphrodite. Olympus is in danger, and I need your help.",
      "Zeus has become dangerous. His temper shakes the mountain, and none of us can reason with him. I need you to retrieve his lightning bolt before he destroys us all.",
      "Speak with the locals near the gate. The gatekeeper will not open it without the right words.",
    ],
  },
};
