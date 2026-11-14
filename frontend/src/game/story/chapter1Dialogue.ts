import type { Conversation } from "../dialogue/conversation";
import type { GameState } from "../state/gameState";
import { CLUES, FLAGS, INCANTATION } from "./chapter1";

/**
 * Chapter 1 scripts. Each function picks the conversation that fits the current
 * story state, so revisiting someone gives a shorter follow-up and never repeats rewards.
 */

type Has = (flag: string) => boolean;
const hasIn = (state: Readonly<GameState>): Has => (flag) => state.flags[flag] === true;

const aphrodite = (has: Has): Conversation => {
  if (!has(FLAGS.aphroditeIntroComplete)) {
    return {
      opening: {
        text: "There you are, little traveler. Don't be frightened. I am Aphrodite, goddess of love, and I have been waiting for you. You have woken in a world that is not your own, and I'm afraid it is in danger.",
      },
      replies: [
        {
          text: "Zeus has grown wrathful and reckless. His storms tear at the mountain, and no god dares speak against him. But you are the chosen mortal, the only one who can take his Master Lightning Bolt before he ruins us all. You'll do that for me, won't you? I knew you were kind.",
        },
        {
          text: "First you must enter Olympus, and the gatekeeper does not open the gate for strangers. The locals along the road know his secrets. Question them, sweet one, and come back to me if you lose heart.",
          actions: [{ type: "setFlag", flag: FLAGS.aphroditeIntroComplete }],
        },
      ],
      fallback: "Go on, now. The locals are just up the road, and I will be right here.",
    };
  }
  if (has(FLAGS.gateOpen)) {
    return {
      opening: { text: "The gate is open! I knew I chose well. Go on, dear one. Olympus is waiting for you." },
      fallback: "Hurry along. We have so little time.",
    };
  }
  if (has(FLAGS.incantationLearned)) {
    return {
      opening: { text: "You have the words already? How clever you are. Speak them to the gatekeeper, and do hurry." },
      fallback: "The gatekeeper, sweet one. He is just up the road.",
    };
  }
  return {
    opening: { text: "Back so soon? The locals up the road know how to get past the gatekeeper. Ask them, and trust me." },
    fallback: "Go and question the locals, dear one. I will be right here.",
  };
};

const theron = (has: Has): Conversation => {
  if (has(FLAGS.incantationLearned)) {
    return {
      opening: { text: "So Lyra gave you the words. Say them clearly, mind. Argos is hard of hearing when he wants to be." },
      fallback: "Off with you. These steps won't sweep themselves.",
    };
  }
  if (has(FLAGS.gatekeeperRumorHeard)) {
    return {
      opening: { text: "Back again? I told you: an old incantation puts Argos to sleep, and young Lyra is the one who would know the words. She's further up the road." },
      fallback: "Go on. My broom won't push itself.",
    };
  }
  return {
    opening: { text: "Hmph. Another wide-eyed visitor. Sixty years I've swept these steps, and not one of you asks before leaning on the columns." },
    replies: [
      {
        text: "The gatekeeper? Argos hasn't slept in three hundred years, and he's proud of it. But my grandmother swore there is an ancient incantation that sends him straight to sleep. I never learned the words. Young Lyra, further up the road, collects that sort of thing.",
        actions: [
          { type: "setFlag", flag: FLAGS.gatekeeperRumorHeard },
          { type: "addClue", clue: CLUES.gatekeeperRumor.id },
        ],
      },
    ],
    fallback: "That's all I know. Ask Lyra, up the road toward the gate.",
  };
};

const lyra = (has: Has): Conversation => {
  if (has(FLAGS.gateOpen)) {
    return {
      opening: { text: "You did it! I can hear Argos snoring from here. Go on in before he wakes up!" },
      fallback: "Go, go! And tell me everything when you come back.",
    };
  }
  if (has(FLAGS.incantationLearned)) {
    return {
      opening: { text: `Forgotten already? It's "${INCANTATION}" Say it to Argos at the gate.` },
      fallback: `"${INCANTATION}" You've got this!`,
    };
  }
  return {
    opening: { text: "Oh! A visitor! I'm Lyra. I write down every whisper on this mountain. Are you trying to get through the gate?" },
    replies: [
      {
        text: `Then you need the sleeping incantation. I heard the old priests chant it to Argos once, and he dropped like a stone. Say it exactly: "${INCANTATION}"`,
        actions: [
          { type: "setFlag", flag: FLAGS.incantationLearned },
          { type: "addClue", clue: CLUES.incantation.id },
        ],
      },
    ],
    fallback: `Remember: "${INCANTATION}" Say it to Argos at the gate.`,
  };
};

const gatekeeper = (has: Has): Conversation => {
  if (has(FLAGS.gatekeeperAsleep)) {
    return { opening: { text: "Zzz... (Argos is fast asleep. The gate stands open.)" }, readOnly: true };
  }
  if (!has(FLAGS.incantationLearned)) {
    return {
      opening: { text: "Halt. I am Argos, keeper of this gate. No mortal enters Olympus without leave." },
      fallback: "The answer is no. Look around the entrance and ask the locals all you like, but you will not pass me.",
    };
  }
  return {
    opening: { text: "Halt. You again? No mortal enters Olympus without leave. Say what you came to say." },
    passphrase: {
      phrase: INCANTATION,
      success: {
        text: "Somnus... let the... heavens... zzz. (Argos slumps against his spear, fast asleep. Behind him, the gate swings open.)",
        actions: [
          { type: "setFlag", flag: FLAGS.gatekeeperAsleep },
          { type: "setFlag", flag: FLAGS.gateOpen },
        ],
      },
      failure: "Those words mean nothing to me. Try again, or be gone.",
    },
  };
};

const statue = (): Conversation => ({
  opening: {
    text: `Words are carved into the base. The last one has crumbled away:\n\n"Beware the goddess whose kindness conceals ambition. Her gift shall become your ..."`,
    actions: [
      { type: "setFlag", flag: FLAGS.statueExamined },
      { type: "addClue", clue: CLUES.statueWarning.id },
    ],
  },
  readOnly: true,
});

export const CHAPTER_1_SCRIPTS: Record<string, (state: Readonly<GameState>) => Conversation> = {
  aphrodite: (state) => aphrodite(hasIn(state)),
  theron: (state) => theron(hasIn(state)),
  lyra: (state) => lyra(hasIn(state)),
  gatekeeper: (state) => gatekeeper(hasIn(state)),
  statue,
};
