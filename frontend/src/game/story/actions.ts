import { addClue, completeQuest, setChapter, setFlag, type Chapter } from "../state/gameState";

/**
 * A change to story progress. Dialogue steps, scene triggers and (later) validated
 * LLM conversations all make progress by handing these to applyStoryActions.
 */
export type StoryAction =
  | { type: "setFlag"; flag: string }
  | { type: "addClue"; clue: string }
  | { type: "completeQuest"; quest: string }
  | { type: "setChapter"; chapter: Chapter };

/** Safe to call repeatedly: the underlying state operations ignore duplicates. */
export function applyStoryActions(actions: StoryAction[] | undefined): void {
  for (const action of actions ?? []) {
    switch (action.type) {
      case "setFlag":
        setFlag(action.flag);
        break;
      case "addClue":
        addClue(action.clue);
        break;
      case "completeQuest":
        completeQuest(action.quest);
        break;
      case "setChapter":
        setChapter(action.chapter);
        break;
    }
  }
}
