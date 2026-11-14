import { CHAPTER_1_TITLE, CLUES, getCurrentObjective } from "../game/story/chapter1";
import { CHAPTER_2_TITLE, countSeals, getChapter2Objective, SEALS } from "../game/story/chapter2";
import { useGameState } from "../hooks/useGameState";

/** Compact HUD: the current chapter's objective, plus clues (Chapter 1) or seals (Chapter 2). */
export default function QuestTracker() {
  const state = useGameState();

  if (state.chapter >= 2) {
    return (
      <aside className="quest-tracker" aria-label="Quest tracker">
        <div className="quest-chapter">{CHAPTER_2_TITLE}</div>
        <div className="quest-objective">
          <span className="quest-label">Current objective</span>
          {getChapter2Objective(state)}
        </div>
        <div className="quest-seals">
          <span className="quest-label">
            Magical Seals: {countSeals(state)}/{SEALS.length}
          </span>
          <ul>
            {SEALS.map((seal) => {
              const obtained = state.seals[seal.id];
              return (
                <li key={seal.id} className={obtained ? "seal-obtained" : "seal-missing"} data-seal={seal.id}>
                  <span aria-hidden="true">{obtained ? "◆" : "◇"}</span> {seal.name} ({seal.owner}):{" "}
                  {obtained ? "obtained" : "not yet obtained"}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    );
  }

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
