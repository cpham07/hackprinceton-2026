import type { StoryAction } from "../story/actions";
import type { PlayerResponse } from "../types/dialogue";
import { containsPhrase } from "./phraseMatch";

/** One thing the other party says. Its actions apply when the line is actually shown. */
export interface DialogueStep {
  text: string;
  actions?: StoryAction[];
  /** The conversation is over once this line is shown (the input is hidden). */
  ends?: boolean;
}

/**
 * A scripted conversation. The opening is shown when it starts; each player reply
 * reveals the next entry of `replies`; after those run out, `fallback` repeats.
 * Scripted replies do not depend on what the player typed, except for `passphrase`.
 */
export interface Conversation {
  opening: DialogueStep;
  replies?: DialogueStep[];
  fallback?: string;
  /** Nothing to answer (inscriptions, a sleeping guard): the input is hidden. */
  readOnly?: boolean;
  /** Every reply is checked for this phrase instead of advancing the script. */
  passphrase?: { phrase: string; success: DialogueStep; failure: string };
  /**
   * One explicit action offered as a button beside the text field, e.g. handing over an item.
   * It is chosen by the player, never inferred from what they typed, so story beats that hinge on it
   * stay deterministic. Choosing it shows `playerLine` and then `step`, and ends the conversation.
   */
  choice?: DialogueChoice;
  /**
   * The character hears the player out: each reply before the last is answered freely (by the
   * conversation backend when the character is AI-eligible, otherwise by `replies[i]` / `fallback`),
   * and those answers never carry story actions. After `turns` replies the scripted `conclusion` is
   * shown with its actions. Progress depends only on the number of replies, never on their meaning.
   */
  hearOut?: { turns: number; conclusion: DialogueStep };
}

export interface DialogueChoice {
  label: string;
  playerLine: string;
  step: DialogueStep;
}

export interface ReplyResult {
  step: DialogueStep;
  /** The conversation has nothing further to respond to. */
  ended: boolean;
  /**
   * True when the script has nothing left to say and this is only its filler line. That is the one
   * place a conversational backend may answer instead. Scripted steps, which carry story actions,
   * and passphrase checks are never freeform.
   */
  freeform: boolean;
}

/**
 * Decides the scripted answer to a player response.
 * `repliesGiven` is how many responses the player has already made in this conversation.
 * A future LLM-backed version can replace this function; story progress still goes
 * through the returned step's actions.
 */
export function getReply(
  conversation: Conversation,
  repliesGiven: number,
  response: PlayerResponse,
): ReplyResult {
  if (conversation.hearOut) {
    const { turns, conclusion } = conversation.hearOut;
    if (repliesGiven + 1 >= turns) return { step: conclusion, ended: conclusion.ends === true, freeform: false };
    const line = conversation.replies?.[repliesGiven] ?? { text: conversation.fallback ?? "..." };
    return { step: { text: line.text }, ended: false, freeform: true }; // text only: never actions
  }
  if (conversation.passphrase) {
    const { phrase, success, failure } = conversation.passphrase;
    return containsPhrase(response.text, phrase)
      ? { step: success, ended: true, freeform: false }
      : { step: { text: failure }, ended: false, freeform: false };
  }
  const scripted = conversation.replies?.[repliesGiven];
  if (scripted) return { step: scripted, ended: scripted.ends === true, freeform: false };
  return { step: { text: conversation.fallback ?? "..." }, ended: false, freeform: true };
}
