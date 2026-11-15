import { SCENES, type SceneKey } from "./constants";
import { applyStoryActions } from "./story/actions";
import { WISDOM_PUZZLE } from "./puzzles/wisdomPuzzle";
import { CHAPTER_1_COMPLETE_ACTIONS, CLUES, FLAGS } from "./story/chapter1";
import { ARES_TRAINING_REWARD, CH2_FLAGS, CHAPTER_2_COMPLETE_ACTIONS, HADES_TRIAL_REWARD } from "./story/chapter2";
import {
  BOLT_COLLECTED,
  CHAPTER_3_COMPLETE_ACTIONS,
  GUARDS_PASSED,
  PALACE_ENTERED,
  PRESSURE_PUZZLE_REWARD,
  VAULT_OPENED,
  ZEUS_CONFRONTED,
} from "./story/chapter3";
import {
  APHRODITE_CONFRONTED,
  BETRAYAL_REVEALED,
  BOLT_SURRENDERED,
  CHAPTER_4_COMPLETE_ACTIONS,
  CHAPTER_4_ENTERED,
  PLAYER_RESCUED,
  ZEUS_IMPRISONED,
} from "./story/chapter4";

/**
 * Development only: `?chapter=2` starts in the Olympus hub with the state a player
 * would have after finishing Chapter 1. `?chapter=3` starts inside Zeus's palace with the state of a
 * player who has finished Chapter 2: all three seals earned and the Chapter 2 completion applied.
 * `?chapter=4` starts in front of Zeus's palace as a player who has just finished Chapter 3: every
 * Chapter 3 step done and the Master Lightning Bolt in hand. `?chapter=5` starts the final chapter as a
 * player who has just finished Chapter 4: betrayed, rescued, the bolt in Aphrodite's hands. Add `&seals=athena,ares,hades` (or `&seals=all`) to start
 * with those seals already earned. Returns null in production builds and when the parameter
 * is absent, so normal play always starts at the entrance. It only runs while the game is
 * being created, before any real progress exists.
 */
export function getDevStartScene(): SceneKey | null {
  if (!import.meta.env.DEV) return null;
  const chapter = new URLSearchParams(window.location.search).get("chapter");
  if (!["2", "3", "4", "5"].includes(chapter ?? "")) return null;

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
  const seals = requested === "all" || chapter !== "2" ? ["athena", "ares", "hades"] : requested.split(",");
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
  if (chapter === "4" || chapter === "5") {
    applyStoryActions([
      ...CHAPTER_2_COMPLETE_ACTIONS,
      ...PALACE_ENTERED,
      ...PRESSURE_PUZZLE_REWARD,
      ...GUARDS_PASSED,
      ...VAULT_OPENED,
      ...BOLT_COLLECTED,
      ...ZEUS_CONFRONTED,
      ...CHAPTER_3_COMPLETE_ACTIONS,
    ]);
    if (chapter === "4") return SCENES.betrayal;
    applyStoryActions([
      ...CHAPTER_4_ENTERED,
      ...APHRODITE_CONFRONTED,
      ...BOLT_SURRENDERED,
      ...BETRAYAL_REVEALED,
      ...ZEUS_IMPRISONED,
      ...PLAYER_RESCUED,
      ...CHAPTER_4_COMPLETE_ACTIONS,
    ]);
    return SCENES.battle;
  }
  return SCENES.hub;
}
