import { CH2_FLAGS, SEAL_OF_WISDOM_QUEST } from "../story/chapter2";
import type { SequencePuzzle } from "./sequencePuzzle";

/** Athena's library puzzle. Its id matches the pedestal's interactable id. */
export const WISDOM_PUZZLE: SequencePuzzle = {
  id: "wisdomPuzzle",
  title: "The Pedestal of Wisdom",
  inscription: "Let wisdom guide peace; let courage stand before power.",
  symbols: [
    { id: "owl", name: "Owl", meaning: "Wisdom", glyph: "🦉" },
    { id: "olive", name: "Olive Branch", meaning: "Peace", glyph: "🌿" },
    { id: "shield", name: "Shield", meaning: "Courage", glyph: "🛡️" },
    { id: "bolt", name: "Lightning Bolt", meaning: "Power", glyph: "⚡" },
  ],
  solution: ["owl", "olive", "shield", "bolt"],
  rewardActions: [
    { type: "grantSeal", seal: "athena" },
    { type: "setFlag", flag: CH2_FLAGS.wisdomPuzzleSolved },
    { type: "completeQuest", quest: SEAL_OF_WISDOM_QUEST },
  ],
  solvedMessage: "The symbols lock into place and the pedestal opens. You have earned the Seal of Wisdom.",
};

export const PUZZLES: Record<string, SequencePuzzle> = {
  [WISDOM_PUZZLE.id]: WISDOM_PUZZLE,
};
