import type { Conversation } from "../dialogue/conversation";
import type { GameState } from "../state/gameState";
import { CH2_FLAGS, HADES_TRIAL_REWARD, SEALS } from "./chapter2";

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

const ares = (state: Readonly<GameState>): Conversation => {
  if (state.seals.ares) {
    return {
      opening: {
        text: "Ha! There's my little warrior. You crossed my arena without a scratch. Keep the Seal of Courage close, and keep your chin up.",
      },
      fallback: "Go on. Hades won't be as friendly as I am.",
    };
  }
  if (state.flags[CH2_FLAGS.aresIntroComplete]) {
    return {
      opening: {
        text: "Still here? The arena is through the gate beside me. Cross it untouched and the seal is yours. Fall, and you start again. Simple.",
      },
      fallback: "Less talking, more running.",
    };
  }
  return {
    opening: {
      text: "So, Aphrodite's errand runner wanders into my plaza. I am Ares, god of war, and I don't hand out favors. Why should I help you steal from Zeus?",
    },
    replies: [
      {
        text: "Hmph. Words are cheap on this mountain. Tell me about a time you showed courage.",
      },
      {
        text: "Brave talk. Let's see if your feet match your tongue. My training arena is open: three swinging hammers stand between you and the far wall. Reach it, and the Seal of Courage is yours.",
        actions: [{ type: "setFlag", flag: CH2_FLAGS.aresIntroComplete }],
      },
    ],
    fallback: "Enough chatter. The arena gate is right beside me.",
  };
};

/** The arena gate before Ares lets the player in. Once he does, the scene handles E as a portal. */
const aresGateLocked = (): Conversation => ({
  opening: {
    text: "The arena gate is barred, and a voice booms from beside it: \"Nobody trains in my arena without talking to me first!\"",
  },
  readOnly: true,
});

/**
 * Hades asks three questions, one per player reply. Each scripted answer is deliberately generic:
 * it does not claim to know what the player said. Only his last line carries the reward, so the
 * seal is granted when that line is revealed. Closing the dialogue earlier loses nothing and
 * the conversation simply starts over (the reward is tracked in the game state, not here).
 */
const hades = (state: Readonly<GameState>): Conversation => {
  if (state.seals.hades) {
    return {
      opening: {
        text: "You again. The Seal of Passage is yours. Do try to deserve it. Not every door in the universe is worth opening, mortal.",
      },
      fallback: "Go. The living have no business lingering in my halls.",
    };
  }
  return {
    opening: {
      text: "A living mortal in my halls. How refreshing, and how reckless. I am Hades, lord of the Underworld, and I do not give anything away without answers.\n\nWhy should I help you steal from my own brother?",
    },
    replies: [
      {
        text: "An interesting argument, mortal. But I have another question.\n\nWhat makes you think Zeus deserves to lose his lightning bolt?",
      },
      {
        text: "Hm. Every mortal has a reason, and most of them are wrong. I will keep listening. One last question.\n\nWho sent you on this ridiculous mission?",
      },
      {
        text: "So. You have answered all three of my questions, and I have heard enough. Whoever sent you, be careful with the generous. Nothing on that mountain is given freely, and Aphrodite least of all. Still, I am willing to grant you passage. Take the Seal of Passage.",
        actions: HADES_TRIAL_REWARD,
      },
    ],
    fallback: "You have what you came for. Go.",
  };
};

/** The sealed gates of Zeus's palace. Once all three seals are held, the hub scene handles E instead. */
const zeusPalace = (state: Readonly<GameState>): Conversation => {
  const missing = SEALS.filter((seal) => !state.seals[seal.id]);
  return {
    opening: {
      text: `The palace gates are sealed by three magical locks, each shaped like a seal. Seals held: ${SEALS.length - missing.length}/${SEALS.length}.\n\nStill missing: ${missing.map((seal) => `${seal.name} (${seal.owner})`).join(", ")}.`,
    },
    readOnly: true,
  };
};

export const CHAPTER_2_SCRIPTS: Record<string, (state: Readonly<GameState>) => Conversation> = {
  athena,
  ares,
  aresPath: aresGateLocked,
  hades,
  zeusPalace,
};
