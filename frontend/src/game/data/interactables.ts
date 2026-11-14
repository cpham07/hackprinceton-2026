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
  /** "puzzle" opens the puzzle with this id instead of a dialogue. Defaults to "dialogue". */
  kind?: "dialogue" | "puzzle";
  /** Tint of a soft pulsing glow drawn behind it. */
  glowColor?: number;
}

const TALK = "Press E to talk";

/** Chapter 1: the entrance to Olympus. */
export const ENTRANCE_INTERACTABLES: Record<string, InteractableDefinition> = {
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

/** Chapter 2: the Olympus hub and Athena's library (one continuous scene). */
export const HUB_INTERACTABLES: Record<string, InteractableDefinition> = {
  aresPath: {
    id: "aresPath",
    name: "Arena of Ares",
    textureKey: "arch-ares",
    x: 1750,
    displaySize: { width: 230, height: 300 },
    interactionRadius: 120,
    prompt: "Press E to enter",
  },
  hadesPath: {
    id: "hadesPath",
    name: "Descent to Hades",
    textureKey: "arch-hades",
    x: 2250,
    displaySize: { width: 230, height: 300 },
    interactionRadius: 120,
    prompt: "Press E to enter",
  },
  athena: {
    id: "athena",
    name: "Athena",
    textureKey: "npc-athena",
    x: 2760,
    displaySize: { width: 78, height: 140 },
    interactionRadius: 150,
    prompt: TALK,
  },
  wisdomPuzzle: {
    id: "wisdomPuzzle",
    name: "Puzzle Pedestal",
    textureKey: "object-pedestal",
    x: 3850,
    displaySize: { width: 90, height: 110 },
    interactionRadius: 120,
    prompt: "Press E to examine",
    kind: "puzzle",
    glowColor: 0xf2c94c,
  },
};

/** Every interactable by id, for lookups that don't care which scene it is in. */
export const INTERACTABLES: Record<string, InteractableDefinition> = {
  ...ENTRANCE_INTERACTABLES,
  ...HUB_INTERACTABLES,
};
