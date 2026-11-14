import type { Conversation } from "../dialogue/conversation";
import { getGameState, type GameState } from "../state/gameState";
import { SEALS } from "./chapter2";
import { CH3_FLAGS, GUARDS_PASSED, hasWarriorBadge, MASTER_BOLT, VAULT_OPENED, ZEUS_CONFRONTED } from "./chapter3";

/** Chapter 3 scripts. Each picks the conversation that fits the current state. */

type State = Readonly<GameState>;
const has = (state: State, flag: string) => state.flags[flag] === true;

/**
 * The guards ask for proof of a warrior. The Warrior Badge is Ares's Seal of Courage, so anyone who
 * completed his course qualifies, but the checkpoint only opens once the player has spoken to the
 * guards and the line granting permission is shown.
 */
const palaceGuards = (state: State): Conversation => {
  if (has(state, CH3_FLAGS.guardsPassed)) {
    return {
      opening: { text: "The guards stand aside, spears upright. \"Move along. The vault is just ahead.\"" },
      readOnly: true,
    };
  }
  if (hasWarriorBadge(state)) {
    return {
      opening: {
        text: "Two spears cross in front of you. \"Halt. Palace business only.\"\n\nThen the guard's eyes find the Seal of Courage at your belt. \"That is Ares's warrior badge. He does not hand those out. Pass, friend, and mind the vault.\"\n\nThe spears lift, and the corridor opens.",
        actions: GUARDS_PASSED,
      },
      readOnly: true,
    };
  }
  return {
    opening: {
      text: "Two spears cross in front of you. \"Halt. Only warriors carrying Ares's badge may pass this corridor. Return when you have earned the Seal of Courage.\"",
    },
    readOnly: true,
  };
};

/** The vault door has three seal-shaped sockets. */
const vaultDoor = (state: State): Conversation => {
  if (has(state, CH3_FLAGS.vaultOpen)) {
    return { opening: { text: "The vault door stands open. Golden light spills from within." }, readOnly: true };
  }
  const held = SEALS.filter((seal) => state.seals[seal.id]);
  if (held.length === SEALS.length) {
    return {
      opening: {
        text: "Three sockets glow on the vault door. The Seals of Wisdom, Courage and Passage hum in your hands and fly into place, one by one.\n\nThe door grinds open.",
        actions: VAULT_OPENED,
      },
      readOnly: true,
    };
  }
  return {
    opening: {
      text: `Three seal-shaped sockets are carved into the vault door. You hold ${held.length}/${SEALS.length} seals, and the door will not open until all three are in place.`,
    },
    readOnly: true,
  };
};

/** Shown if the bolt is examined before the vault is open (the scene collects it otherwise). */
const masterBolt = (state: State): Conversation => ({
  opening: {
    text: has(state, CH3_FLAGS.vaultOpen)
      ? "The Master Lightning Bolt hums, bright enough to hurt."
      : "Something golden pulses behind the vault's wards. You cannot reach it while the door is sealed.",
  },
  readOnly: true,
});

/**
 * Zeus questions the player, doubts Aphrodite's account and warns of manipulation without
 * revealing everything. Scripted replies are generic and do not claim to know what the player said.
 * His last line carries the story action that opens the escape route.
 */
const zeus = (state: State): Conversation => {
  if (has(state, CH3_FLAGS.zeusConfrontationComplete)) {
    return {
      opening: { text: "You still linger? The way out is open. Remember what I told you." },
      fallback: "Go.",
    };
  }
  return {
    opening: {
      text: "Thunder rolls through the vault as a towering figure steps out of the light.\n\n\"You have no idea who sent you here, mortal.\"\n\nTell me, thief: what do you want with my bolt?",
    },
    replies: [
      {
        text: "Hm. Aphrodite told you I have grown dangerous, that Olympus trembles at my temper. Did it never strike you that she is the one who gains if the bolt leaves my hands? Tell me: why did you believe her?",
      },
      {
        text: "I hear you, mortal. I will not tell you everything now. You would not believe me, and she has had a long head start at your ear. But understand this much: you are being used, and the sweetest voices on this mountain often hide the sharpest knives. Do you understand what I am telling you?",
      },
      {
        text: "Then go. The way out is open, and I will not stop you. Carry the bolt wherever you intend, but keep my warning close. When you finally see who you are carrying it for, remember that I told you first.",
        actions: ZEUS_CONFRONTED,
      },
    ],
    fallback: "Go. The way out is open.",
  };
};

/** Shown when the player tries to leave while carrying the bolt but has not finished with Zeus. */
const palaceExit = (state: State): Conversation => ({
  opening: {
    text: state.inventory.includes(MASTER_BOLT)
      ? "A voice like thunder fills the hall. \"Not yet, thief. We are not finished.\""
      : "The palace gate stands before you.",
  },
  readOnly: true,
});

export const CHAPTER_3_SCRIPTS: Record<string, (state: State) => Conversation> = {
  palaceGuards,
  vaultDoor,
  masterBolt,
  zeus,
  palaceExit,
};

/** For tests and tools that want a script against the live state. */
export function getLiveConversation(id: string): Conversation | null {
  return CHAPTER_3_SCRIPTS[id]?.(getGameState()) ?? null;
}
