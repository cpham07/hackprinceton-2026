import { SCENES, type SceneKey } from "./constants";
import { applyStoryActions } from "./story/actions";
import { CHAPTER_1_COMPLETE_ACTIONS, CLUES, FLAGS } from "./story/chapter1";

/**
 * Development only: `?chapter=2` starts in the Olympus hub with the state a player
 * would have after finishing Chapter 1. Returns null in production builds and
 * when the parameter is absent, so normal play always starts at the entrance.
 */
export function getDevStartScene(): SceneKey | null {
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(window.location.search).get("chapter") !== "2") return null;

  applyStoryActions([
    { type: "setFlag", flag: FLAGS.aphroditeIntroComplete },
    { type: "setFlag", flag: FLAGS.gatekeeperRumorHeard },
    { type: "addClue", clue: CLUES.gatekeeperRumor.id },
    { type: "setFlag", flag: FLAGS.incantationLearned },
    { type: "addClue", clue: CLUES.incantation.id },
    { type: "setFlag", flag: FLAGS.gatekeeperAsleep },
    { type: "setFlag", flag: FLAGS.gateOpen },
    ...CHAPTER_1_COMPLETE_ACTIONS,
  ]);
  return SCENES.hub;
}
