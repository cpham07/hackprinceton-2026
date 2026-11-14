import type { Conversation } from "../dialogue/conversation";
import type { GameState } from "../state/gameState";
import { CH2_FLAGS } from "./chapter2";

/** Chapter 2 scripts. Like Chapter 1, each picks the conversation that fits the current state. */

const athena = (state: Readonly<GameState>): Conversation => {
  if (state.seals.athena) {
    return {
      opening: {
        text: "The Seal of Wisdom is yours. You earned it; I did not give it. Ares holds the Seal of Courage and Hades the Seal of Passage. Their trials are not open to you yet.",
      },
      fallback: "Keep your eyes open, traveler. Not everything on this mountain is what it claims to be.",
    };
  }
  if (state.flags[CH2_FLAGS.athenaIntroComplete]) {
    return {
      opening: {
        text: "The pedestal waits in my library, through the door behind me. Read its inscription carefully. It tells you everything you need.",
      },
      fallback: "The library, traveler. Wisdom is shown, not claimed.",
    };
  }
  return {
    opening: {
      text: "You walk softly for a mortal. I am Athena. I know what brings Aphrodite's chosen through that gate: Zeus's vault. It is protected by three magical seals, and no one opens it without all three.",
    },
    replies: [
      {
        text: "The Seal of Wisdom is mine. The Seal of Courage belongs to Ares, and the Seal of Passage belongs to Hades. So tell me plainly: why do you seek the lightning bolt?",
      },
      {
        text: "I have heard your answer. I cannot yet weigh the truth of it, so I will weigh you instead. My library is open to you. Set the four symbols on the pedestal in their proper order, and the Seal of Wisdom is yours.",
        actions: [{ type: "setFlag", flag: CH2_FLAGS.athenaIntroComplete }],
      },
    ],
    fallback: "Enough words. The pedestal is in my library, through the door behind me.",
  };
};

const comingSoon = (place: string, trial: string) => (): Conversation => ({
  opening: {
    text: `The way to the ${place} is sealed. A notice hangs across it:\n\n"${trial} — Coming Soon."`,
  },
  readOnly: true,
});

export const CHAPTER_2_SCRIPTS: Record<string, (state: Readonly<GameState>) => Conversation> = {
  athena,
  aresPath: comingSoon("Arena of Ares", "The Trial of Courage"),
  hadesPath: comingSoon("Descent to Hades", "The Trial of Passage"),
};
