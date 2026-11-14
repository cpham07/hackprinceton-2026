import { SCENES, type SceneKey } from "./constants";
import { applyStoryActions } from "./story/actions";
import { WISDOM_PUZZLE } from "./puzzles/wisdomPuzzle";
import { CHAPTER_1_COMPLETE_ACTIONS, CLUES, FLAGS } from "./story/chapter1";
import { ARES_TRAINING_REWARD, CH2_FLAGS, CHAPTER_2_COMPLETE_ACTIONS, HADES_TRIAL_REWARD } from "./story/chapter2";

/**
 * Development only: `?chapter=2` starts in the Olympus hub with the state a player
 * would have after finishing Chapter 1. `?chapter=3` starts inside Zeus's palace with the state of a
 * player who has finished Chapter 2: all three seals earned and the Chapter 2 completion applied. Add `&seals=athena,ares,hades` (or `&seals=all`) to start
 * with those seals already earned. Returns null in production builds and when the parameter
 * is absent, so normal play always starts at the entrance. It only runs while the game is
 * being created, before any real progress exists.
 */
export function getDevStartScene(): SceneKey | null {
  if (!import.meta.env.DEV) return null;
  const chapter = new URLSearchParams(window.location.search).get("chapter");
  if (chapter !== "2" && chapter !== "3") return null;

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

  const requested = new URLSearchParams(window.location.search).get("seals") ?? "";
  const seals = requested === "all" || chapter === "3" ? ["athena", "ares", "hades"] : requested.split(",");
  if (seals.includes("athena")) {
    applyStoryActions([{ type: "setFlag", flag: CH2_FLAGS.athenaIntroComplete }, ...WISDOM_PUZZLE.rewardActions]);
  }
  if (seals.includes("ares")) {
    applyStoryActions([{ type: "setFlag", flag: CH2_FLAGS.aresIntroComplete }, ...ARES_TRAINING_REWARD]);
  }
  if (seals.includes("hades")) applyStoryActions(HADES_TRIAL_REWARD);
  if (chapter === "3") {
    applyStoryActions(CHAPTER_2_COMPLETE_ACTIONS);
    return SCENES.palace;
  }
  return SCENES.hub;
}
