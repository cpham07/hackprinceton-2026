import type { Conversation, DialogueStep } from "../dialogue/conversation";
import type { GameState } from "../state/gameState";
import {
  APHRODITE_CONFRONTED,
  BETRAYAL_REVEALED,
  BOLT_SURRENDERED,
  CH4_FLAGS,
  PLAYER_RESCUED,
  ZEUS_IMPRISONED,
} from "./chapter4";

/**
 * Chapter 4 scripts, picked by state. Every story beat here is a scripted step with explicit
 * actions: no reply text is interpreted, and no AI reply can move the bolt or trigger the betrayal.
 * Aphrodite's motives stay hidden until the "reveal" line, which only exists after the bolt
 * has changed hands.
 */

type State = Readonly<GameState>;
const has = (state: State, flag: string) => state.flags[flag] === true;

/** The explicit, deterministic way to hand over the bolt. */
const HAND_OVER: Conversation["choice"] = {
  label: "Hand over the Master Lightning Bolt",
  playerLine: "(You hold out the Master Lightning Bolt.)",
  step: {
    text: "Aphrodite's fingers close around the bolt, and the whole plaza seems to hold its breath. \"At last,\" she whispers. \"Oh, at last.\"",
    actions: BOLT_SURRENDERED,
    ends: true,
  },
};

/**
 * Refusing does not loop forever: she grows impatient with each reply, whatever it says, and on the
 * third one the necklace takes the bolt for her. The count is of replies, not of their meaning.
 */
const IMPATIENCE: DialogueStep[] = [
  {
    text: "Aphrodite's smile holds, but her eyes keep drifting to the bolt. \"Of course, of course. You have had such a long road. But the bolt is not safe in mortal hands. Give it to me.\"",
  },
  {
    text: "\"Sweet one.\" The word comes out sharp. \"I did not guide you through Hades's halls and Zeus's vault to argue on the palace steps. Hand. It. Over.\"",
  },
  {
    text: "\"Enough.\" The necklace at your throat flares hot. Your fingers open on their own, and the Master Lightning Bolt drifts into Aphrodite's hand. \"If you will not give it, I will simply take it.\"",
    actions: BOLT_SURRENDERED,
    ends: true,
  },
];

const aphrodite = (state: State): Conversation => {
  if (has(state, CH4_FLAGS.zeusImprisoned)) {
    return { opening: { text: "Only a faint scent of roses remains where Aphrodite stood." }, readOnly: true };
  }
  if (has(state, CH4_FLAGS.betrayalRevealed)) {
    return {
      opening: {
        text: "Zeus bursts out of the palace gate, roaring her name. Aphrodite only smiles and lifts the Master Lightning Bolt.\n\n\"Behold your king, mortal!\" Lightning splits the sky. Bars of blazing gold slam down around Zeus and lock him in a cage of his own power.\n\n\"Olympus answers to me now. Thank you for carrying my crown so far, little courier.\" She rises into the darkened sky and is gone.",
        actions: ZEUS_IMPRISONED,
      },
      readOnly: true,
    };
  }
  if (has(state, CH4_FLAGS.boltSurrendered)) {
    return {
      opening: {
        text: "Aphrodite laughs, and every bit of warmth drains out of it.\n\n\"Did you truly think I cared about Zeus's temper? I needed hands the bolt would not burn. I told you he was dangerous. I sent you to the seals. I guided every single step. You were never my champion, mortal. You were my courier.\"\n\nThe necklace at your throat blazes pink and gold. Your arms lock at your sides. You cannot move.",
        actions: BETRAYAL_REVEALED,
      },
      readOnly: true,
    };
  }
  if (has(state, CH4_FLAGS.aphroditeConfronted)) {
    return {
      opening: { text: "\"Back again, darling? Then let us finish this. The Master Lightning Bolt, please.\" She holds out her hand." },
      replies: IMPATIENCE,
      choice: HAND_OVER,
    };
  }
  return {
    opening: {
      text: "\"My champion! You did it, you truly did it.\" Aphrodite glides toward you, all warmth and light, and fastens a delicate pink-gold necklace around your neck before you can answer.\n\n\"A gift, so all of Olympus knows whose hero you are. Now, darling: the Master Lightning Bolt. Give it to me, and I will keep it safe from Zeus.\"",
      actions: APHRODITE_CONFRONTED,
    },
    replies: IMPATIENCE,
    choice: HAND_OVER,
  };
};

const athena = (state: State): Conversation => {
  if (has(state, CH4_FLAGS.playerRescued)) {
    return {
      opening: {
        text: "\"Aphrodite holds the Master Lightning Bolt, and Zeus is her prisoner. Olympus is hers, for now. Rest while you can, mortal. When you are ready, we take it back together.\"",
      },
      fallback: "\"We will need every ounce of your courage. Ares and I will be ready.\"",
    };
  }
  if (has(state, CH4_FLAGS.zeusImprisoned)) {
    return {
      opening: {
        text: "Athena lands beside you, Ares a heartbeat behind her with his spear raised.\n\n\"Do not struggle. That necklace answers to Aphrodite.\" She studies the glowing chain. \"I suspected it from the moment I saw it on you: a tracking charm. Through it she has known every step you took, and now it binds you.\"",
      },
      replies: [
        {
          text: "Ares glares at the sky where Aphrodite vanished. \"She took the bolt and caged Zeus, and she used our seals to do it. I do not care who started this, mortal. I will help you take it back.\"",
        },
        {
          text: "Athena lays two fingers on the necklace and speaks a single word. Ares brings the butt of his spear down on the clasp. The chain shatters into pink sparks, and your arms are your own again.\n\n\"Listen well,\" Athena says. \"Aphrodite holds the Master Lightning Bolt, and Olympus answers to her now. But she made one mistake: she left you standing, with the two of us beside you.\"",
          actions: PLAYER_RESCUED,
        },
      ],
      fallback: "\"Breathe. You are free, and you are not alone.\"",
    };
  }
  return { opening: { text: "Athena is nowhere to be seen." }, readOnly: true };
};

const ares = (state: State): Conversation => {
  if (has(state, CH4_FLAGS.playerRescued)) {
    return {
      opening: { text: "\"When you are ready, we march on Aphrodite. Bring that courage of yours. You will need all of it.\"" },
      fallback: "\"Less talk. More planning.\"",
    };
  }
  return { opening: { text: "\"Hold still and let Athena work. Magic is her battlefield, not mine.\"" }, readOnly: true };
};

const zeus = (state: State): Conversation => ({
  opening: {
    text: has(state, CH4_FLAGS.zeusImprisoned)
      ? "Zeus grips the golden bars. \"I warned you, mortal. Now you know who sent you. Free me, and we will finish this together.\""
      : "Zeus is not here.",
  },
  readOnly: true,
});

export const CHAPTER_4_SCRIPTS: Record<string, (state: State) => Conversation> = { aphrodite, athena, ares, zeus };
