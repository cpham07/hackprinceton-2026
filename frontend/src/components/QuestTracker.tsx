import { CHAPTER_1_TITLE, CLUES, getCurrentObjective } from "../game/story/chapter1";
import { useGameState } from "../hooks/useGameState";

/** Compact HUD: the current objective plus the clues found so far. */
export default function QuestTracker() {
  const state = useGameState();
  const clues = state.clues.map((id) => CLUES[id]).filter(Boolean);

  return (
    <aside className="quest-tracker" aria-label="Quest tracker">
      <div className="quest-chapter">{CHAPTER_1_TITLE}</div>
      <div className="quest-objective">
        <span className="quest-label">Objective</span>
        {getCurrentObjective(state)}
      </div>
      {clues.length > 0 && (
        <ul className="quest-clues">
          {clues.map((clue) => (
            <li key={clue.id}>
              <strong>{clue.title}{clue.optional ? " (optional)" : ""}:</strong> {clue.text}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
