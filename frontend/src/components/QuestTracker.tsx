import { CHAPTER_1_TITLE, CLUES, getCurrentObjective } from "../game/story/chapter1";
import { CHAPTER_2_TITLE, countSeals, getChapter2Objective, hasAllSeals, SEALS } from "../game/story/chapter2";
import { CHAPTER_3_STEPS, CHAPTER_3_TITLE, getChapter3Objective, MASTER_BOLT } from "../game/story/chapter3";
import { APHRODITE_NECKLACE, CHAPTER_4_STEPS, CHAPTER_4_TITLE, getChapter4Objective } from "../game/story/chapter4";
import { CH5_FLAGS, CHAPTER_5_STEPS, CHAPTER_5_TITLE, getChapter5Objective, GUARDIAN_TITLE } from "../game/story/chapter5";
import { useGameState } from "../hooks/useGameState";

/** Compact HUD: the current chapter's objective, plus clues (Chapter 1) or seals (Chapter 2). */
export default function QuestTracker() {
  const state = useGameState();

  if (state.chapter >= 5) {
    const charms = state.flags[CH5_FLAGS.enchantmentsBroken] ? 3 : Math.min(Math.max(state.counters["ch5.enchantmentsBroken"] ?? 0, 0), 3);
    return (
      <aside className="quest-tracker" aria-label="Quest tracker">
        <div className="quest-chapter">{CHAPTER_5_TITLE}</div>
        <div className="quest-objective">
          <span className="quest-label">Current objective</span>
          {getChapter5Objective(state)}
        </div>
        <ol className="quest-steps">
          {CHAPTER_5_STEPS.map((step) => {
            const done = step.done(state);
            return (
              <li key={step.id} className={done ? "step-done" : "step-todo"} data-step={step.id}>
                <span aria-hidden="true">{done ? "✓" : "○"}</span> {step.label}
                {step.id === "charms" && !done && ` (${charms}/3)`}
              </li>
            );
          })}
        </ol>
        <p className="quest-seals-line">
          Seals: {countSeals(state)}/{SEALS.length}
          {state.inventory.includes(MASTER_BOLT) && <span className="quest-item"> · ⚡ Master Lightning Bolt</span>}
          {state.flags[CH5_FLAGS.guardianOfOlympus] && <span className="quest-item"> · ★ {GUARDIAN_TITLE}</span>}
        </p>
      </aside>
    );
  }

  if (state.chapter >= 4) {
    return (
      <aside className="quest-tracker" aria-label="Quest tracker">
        <div className="quest-chapter">{CHAPTER_4_TITLE}</div>
        <div className="quest-objective">
          <span className="quest-label">Current objective</span>
          {getChapter4Objective(state)}
        </div>
        <ol className="quest-steps">
          {CHAPTER_4_STEPS.map((step) => {
            const done = step.done(state);
            return (
              <li key={step.id} className={done ? "step-done" : "step-todo"} data-step={step.id}>
                <span aria-hidden="true">{done ? "✓" : "○"}</span> {step.label}
              </li>
            );
          })}
        </ol>
        <p className="quest-seals-line">
          Seals: {countSeals(state)}/{SEALS.length}
          {state.inventory.includes(MASTER_BOLT) && <span className="quest-item"> · ⚡ Master Lightning Bolt</span>}
          {state.inventory.includes(APHRODITE_NECKLACE) && <span className="quest-item quest-necklace"> · ✦ Aphrodite's necklace</span>}
        </p>
      </aside>
    );
  }

  if (state.chapter >= 3) {
    return (
      <aside className="quest-tracker" aria-label="Quest tracker">
        <div className="quest-chapter">{CHAPTER_3_TITLE}</div>
        <div className="quest-objective">
          <span className="quest-label">Current objective</span>
          {getChapter3Objective(state)}
        </div>
        <ol className="quest-steps">
          {CHAPTER_3_STEPS.map((step) => {
            const done = step.done(state);
            return (
              <li key={step.id} className={done ? "step-done" : "step-todo"} data-step={step.id}>
                <span aria-hidden="true">{done ? "✓" : "○"}</span> {step.label}
              </li>
            );
          })}
        </ol>
        <p className="quest-seals-line">
          Seals: {countSeals(state)}/{SEALS.length}
          {state.inventory.includes(MASTER_BOLT) && <span className="quest-item"> · ⚡ Master Lightning Bolt</span>}
        </p>
      </aside>
    );
  }

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
          {hasAllSeals(state) && <p className="quest-all-seals">All three seals collected.</p>}
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
