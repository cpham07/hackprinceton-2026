import { CH2_FLAGS } from "../story/chapter2";
import { CH3_FLAGS } from "../story/chapter3";
import { DEFAULT_ACTION_POLICY, type ActionPolicy } from "../../services/npc/proposedAction";

/**
 * Which characters' free conversation may be answered by the conversation backend.
 *
 * The backend is only consulted once a character's script has nothing left to say (see
 * `ReplyResult.freeform`). Every scripted step, including all the ones that carry story actions
 * (Hades's three questions and his seal, Zeus's confrontation, the gatekeeper's passphrase, the puzzles),
 * stays deterministic, so generated text can never stand in for a story beat.
 *
 * To make another character AI-enabled, add an entry here. Only the listed flag names are ever sent.
 */
export interface AiNpcPolicy {
  /** Flag names the backend may see for this character (only those set to true are sent). */
  relevantFlags: string[];
}

export const AI_ELIGIBLE_NPCS: Record<string, AiNpcPolicy> = {
  hades: { relevantFlags: [CH2_FLAGS.hadesTrialComplete] },
  zeus: {
    relevantFlags: [CH3_FLAGS.guardsPassed, CH3_FLAGS.vaultOpen, CH3_FLAGS.zeusConfrontationComplete],
  },
};

/**
 * What AI replies may do to the story: nothing. Replies are informational only. Any action a reply
 * proposes goes through `validateProposedAction` against this policy and is rejected unless it is
 * listed. Add entries here only together with tests for that specific character and action.
 */
export const AI_ACTION_POLICY: ActionPolicy = DEFAULT_ACTION_POLICY;

export function isAiEligible(npcId: string): boolean {
  return npcId in AI_ELIGIBLE_NPCS;
}

/** How free conversation is answered. "mock" exists only in development builds. */
export type AiMode = "backend" | "mock" | "off";
