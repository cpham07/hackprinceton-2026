import type { Conversation } from "../dialogue/conversation";
import { hasItem, type GameState } from "../state/gameState";
import { MASTER_BOLT } from "./chapter3";
import { ALLIES_BRIEFED, APHRODITE_YIELDED, BOLT_RETURNED, CH5_FLAGS, OLYMPUS_RESTORED } from "./chapter5";

/**
 * Chapter 5 scripts, picked by state.
 *
 * The two big conversations (Aphrodite on the throne, Zeus about mortals) are "hear out" conversations:
 * each of the player's replies is answered in context by the conversation backend when it is available
 * (scripted lines otherwise), and after three replies a fixed, scripted conclusion carries the story
 * action. Nothing evaluates how persuasive the player was, so the conclusions only refer to things that
 * are true whatever was said.
 */

type State = Readonly<GameState>;
const has = (state: State, flag: string) => state.flags[flag] === true;

const athena = (state: State): Conversation => {
  if (has(state, CH5_FLAGS.guardianOfOlympus)) {
    return { opening: { text: "\"Guardian of Olympus. It suits you.\"" }, readOnly: true };
  }
  if (!has(state, CH5_FLAGS.alliesBriefed)) {
    return {
      opening: {
        text: "Athena keeps her voice low. \"Olympus answers to Aphrodite now. She sits on Zeus's throne, and she has wrapped the palace in three enchantments: Vanity, Jealousy and Desire. While they hold, no one can reach her.\"\n\n\"Break them in the order she wove them. The plaque by the barrier shows it. Strike one out of turn and they all knit back together. Ares and I will hold the courtyard.\"",
        actions: ALLIES_BRIEFED,
      },
      fallback: "\"Vanity first, then Jealousy, then Desire. Go.\"",
    };
  }
  if (!has(state, CH5_FLAGS.enchantmentsBroken)) {
    return {
      opening: { text: "\"Vanity first, then Jealousy, then Desire. If you break one out of turn, they all knit back together, and you simply start again.\"" },
      fallback: "\"The plaque by the barrier shows the order.\"",
    };
  }
  return { opening: { text: "\"The way is open. She is waiting on Zeus's throne. Talk first, if you can.\"" }, fallback: "\"Go.\"" };
};

const ares = (state: State): Conversation => ({
  opening: {
    text: has(state, CH5_FLAGS.alliesBriefed)
      ? "\"We hold the courtyard. You go and end this.\""
      : "\"Talk to Athena. She has the plan. I have the spear.\"",
  },
  readOnly: true,
});

/** The three enchantments say why they will not break (the scene handles E once the player is briefed). */
const enchantment = (state: State): Conversation => ({
  opening: {
    text: has(state, CH5_FLAGS.alliesBriefed)
      ? "The enchantment hums and holds. It will only break in its turn."
      : "Pink light sears your palm the moment you touch it. Athena and Ares are in the courtyard; they may know how to undo it.",
  },
  readOnly: true,
});

const aphrodite = (state: State): Conversation => {
  if (!has(state, CH5_FLAGS.enchantmentsBroken)) {
    return { opening: { text: "Aphrodite's charms still shield the throne room." }, readOnly: true };
  }
  if (has(state, CH5_FLAGS.aphroditeYielded)) {
    return { opening: { text: "Aphrodite sits on the throne steps, quiet for once. She does not look at the bolt." }, readOnly: true };
  }
  return {
    opening: {
      text: "Aphrodite lounges on Zeus's throne, the Master Lightning Bolt across her knees.\n\n\"So my little courier broke my charms. Clever. And now? Will you fight a goddess for this? Or do you think you can talk me off this throne?\"",
    },
    replies: [
      { text: "\"Pretty words. Zeus never listened to pretty words either. Why should I?\"" },
      { text: "\"You think I do not know what I have done? I know exactly what I have done. Keep talking.\"" },
    ],
    fallback: "\"Keep talking, mortal.\"",
    hearOut: {
      turns: 3,
      conclusion: {
        text: "Aphrodite looks at you for a long moment. \"You broke my charms, walked into my throne room unarmed, and still you chose to talk instead of fight. No one on this mountain has ever simply talked to me.\"\n\nShe sets the Master Lightning Bolt down at the foot of the throne. \"Take it, before I change my mind.\"",
        actions: APHRODITE_YIELDED,
        ends: true,
      },
    },
  };
};

const zeus = (state: State): Conversation => {
  if (has(state, CH5_FLAGS.guardianOfOlympus)) {
    return { opening: { text: "\"Guard them well, Guardian. And keep an eye on her.\" Zeus nods toward the throne steps." }, readOnly: true };
  }
  if (has(state, CH5_FLAGS.boltReturned)) {
    return {
      opening: {
        text: "Zeus turns the bolt in his hand. \"Mortals. You steal fire, break promises, and forget us the moment you no longer need us. Long ago I closed Olympus to your kind.\"\n\n\"Tell me why it should open its gates to you again.\"",
      },
      replies: [
        { text: "\"Hm. Mortals were always good with words. Go on.\"" },
        { text: "\"One brave mortal does not make a worthy people. Convince me otherwise.\"" },
      ],
      fallback: "\"Go on.\"",
      hearOut: {
        turns: 3,
        conclusion: {
          text: "Zeus is silent for a long time. Then he lifts the Master Lightning Bolt, and gold light pours across the palace, washing the pink haze from every column.\n\n\"You broke a goddess's spell, freed a king, and gave back a power you could have kept. Mortals are welcome on Olympus again, and you will guard that welcome. Rise, Guardian of Olympus.\"",
          actions: OLYMPUS_RESTORED,
          ends: true,
        },
      },
    };
  }
  if (has(state, CH5_FLAGS.zeusFreed)) {
    return {
      opening: { text: "Zeus steps out of the broken cage and looks at the bolt in your hands. \"Freed by a mortal. And you hold my bolt. Well?\"" },
      replies: [{ text: "\"The bolt, mortal.\"" }, { text: "\"I am waiting.\"" }],
      fallback: "\"The bolt.\"",
      choice: {
        label: "Return the Master Lightning Bolt to Zeus",
        playerLine: "(You hold out the Master Lightning Bolt to Zeus.)",
        step: {
          text: "Zeus closes his hand around the Master Lightning Bolt. Thunder rolls over Olympus, soft as a sigh. \"So. A mortal who gives back what they could have kept.\"",
          actions: BOLT_RETURNED,
          ends: true,
        },
      },
    };
  }
  return {
    opening: {
      text: hasItem(MASTER_BOLT)
        ? "Zeus grips the golden bars. \"These bars are forged from my own lightning. Strike them with the bolt, mortal!\""
        : "Zeus grips the golden bars. \"She has my bolt, and these bars are made of it. Get it back.\"",
    },
    readOnly: true,
  };
};

export const CHAPTER_5_SCRIPTS: Record<string, (state: State) => Conversation> = {
  athena,
  ares,
  aphrodite,
  zeus,
  enchantVanity: enchantment,
  enchantJealousy: enchantment,
  enchantDesire: enchantment,
};
