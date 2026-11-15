import type { StoryAction } from "../story/actions";
import type { PlayerResponse } from "../types/dialogue";
import { containsPhrase } from "./phraseMatch";

/** One thing the other party says. Its actions apply when the line is actually shown. */
export interface DialogueStep {
  text: string;
  actions?: StoryAction[];
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
  if (conversation.passphrase) {
    const { phrase, success, failure } = conversation.passphrase;
    return containsPhrase(response.text, phrase)
      ? { step: success, ended: true, freeform: false }
      : { step: { text: failure }, ended: false, freeform: false };
  }
  const scripted = conversation.replies?.[repliesGiven];
  if (scripted) return { step: scripted, ended: false, freeform: false };
  return { step: { text: conversation.fallback ?? "..." }, ended: false, freeform: true };
}
