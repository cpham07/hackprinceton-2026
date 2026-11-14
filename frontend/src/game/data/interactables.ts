/**
 * Everything the player can walk up to and press E on: characters and objects.
 * No Phaser imports, so React can read names too.
 *
 * displaySize and interactionRadius are in world pixels and are independent of the
 * texture's own dimensions: swap the art by loading an image under `textureKey`.
 */
export interface InteractableDefinition {
  id: string;
  name: string;
  textureKey: string;
  /** Feet position: x in world pixels. y is the ground line of the scene. */
  x: number;
  displaySize: { width: number; height: number };
  /** Distance from the feet position to the player's feet within which E works. */
  interactionRadius: number;
  /** Shown above it when the player is in range. */
  prompt: string;
  /** Tint of a soft pulsing glow drawn behind it. */
  glowColor?: number;
}

const TALK = "Press E to talk";

export const INTERACTABLES: Record<string, InteractableDefinition> = {
  aphrodite: {
    id: "aphrodite",
    name: "Aphrodite",
    textureKey: "npc-aphrodite",
    x: 720,
    displaySize: { width: 72, height: 132 },
    interactionRadius: 150,
    prompt: TALK,
  },
  theron: {
    id: "theron",
    name: "Old Theron",
    textureKey: "npc-theron",
    x: 1180,
    displaySize: { width: 66, height: 110 },
    interactionRadius: 140,
    prompt: TALK,
  },
  statue: {
    id: "statue",
    name: "Glowing Statue",
    textureKey: "object-statue",
    x: 1640,
    displaySize: { width: 96, height: 190 },
    interactionRadius: 130,
    prompt: "Press E to investigate",
    glowColor: 0x9fe8ff,
  },
  lyra: {
    id: "lyra",
    name: "Lyra",
    textureKey: "npc-lyra",
    x: 2120,
    displaySize: { width: 60, height: 108 },
    interactionRadius: 140,
    prompt: TALK,
  },
  gatekeeper: {
    id: "gatekeeper",
    name: "Argos the Gatekeeper",
    textureKey: "npc-gatekeeper",
    x: 3110,
    displaySize: { width: 90, height: 150 },
    interactionRadius: 150,
    prompt: TALK,
  },
};
