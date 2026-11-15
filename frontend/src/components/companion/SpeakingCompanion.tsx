import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { speakingCompanion, type FeedbackState, type LatestTurn } from "../../companion/companionStore";
import { goalLabel, hasTextGoal } from "../../companion/goals";
import { approximateWpm, formatDuration } from "../../companion/metrics";
import { useSpeakingCompanion } from "../../hooks/useSpeakingCompanion";
import GoalPicker from "./GoalPicker";
import "./companion.css";

const store = speakingCompanion;

function FeedbackView({ turn, detailed, showPacing }: { turn: LatestTurn; detailed: boolean; showPacing: boolean }) {
  const feedback: FeedbackState = turn.feedback;
  return (
    <section className="companion-section" aria-label="Latest voice reply">
      <h3 className="companion-heading">Your last voice reply (to {turn.npcName})</h3>
      <p className="companion-measure" data-testid="companion-latest-measure">
        {turn.words} {turn.words === 1 ? "word" : "words"} ·{" "}
        {turn.durationMs === null ? "recording time unavailable" : `recorded ${formatDuration(turn.durationMs)}`}
      </p>
      {showPacing && (
        <p className="companion-measure" data-testid="companion-latest-wpm">
          {turn.approximateWpm === null
            ? "Pace: not measurable for this reply."
            : `Pace: ≈ ${turn.approximateWpm} words per minute (approximate: the recording time includes pauses).`}
        </p>
      )}

      {feedback.status === "loading" && (
        <p className="companion-pending" role="status">
          Preparing a tip… you can keep playing.
        </p>
      )}
      {feedback.status === "error" && (
        <p className="companion-error" role="status">
          No tip this time: {feedback.message}
        </p>
      )}
      {feedback.status === "ready" && (
        <div className="companion-feedback" data-testid="companion-feedback">
          <p>
            <span aria-hidden="true">👍 </span>
            {feedback.feedback.positive}
          </p>
          <p>
            <span aria-hidden="true">💡 </span>
            {feedback.feedback.suggestion}
          </p>
          {detailed && (
            <div className="companion-details">
              {feedback.feedback.rephrasing && (
                <p>
                  You could also say: <em>“{feedback.feedback.rephrasing}”</em>
                </p>
              )}
              {feedback.feedback.vocabulary.length > 0 && (
                <p>
                  Useful words:{" "}
                  {feedback.feedback.vocabulary.map((item, index) => (
                    <span key={item.word}>
                      {index > 0 && "; "}
                      <strong>{item.word}</strong> ({item.meaning})
                    </span>
                  ))}
                </p>
              )}
              {feedback.feedback.answersQuestion !== null && (
                <p>Responds to {turn.npcName}: {feedback.feedback.answersQuestion ? "yes" : "not quite yet"}</p>
              )}
              {feedback.feedback.givesReason !== null && (
                <p>Gives a reason or example: {feedback.feedback.givesReason ? "yes" : "not yet"}</p>
              )}
            </div>
          )}
          <p className="companion-source">Tip from an AI coach, based only on the words you confirmed. It can be wrong.</p>
        </div>
      )}
    </section>
  );
}

/**
 * The Speaking Companion: a small collapsible panel in the top-right corner, plus the goal picker. It is
 * optional, never blocks gameplay or dialogue (only the goal picker locks input, like any modal), and never
 * touches the story state.
 */
export default function SpeakingCompanion() {
  const { prefs, metrics, latest, goalEditorOpen, unseen } = useSpeakingCompanion();
  const [confirmingReset, setConfirmingReset] = useState(false);
  // The control that opened the goal editor from the keyboard, so focus can return to it when it closes. A mouse
  // click is different: the panel hands the keyboard back to the game after clicks, so focus is not pulled back
  // into the panel (WASD would stop moving the player). Onboarding opens by itself and has no trigger.
  const goalTriggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const showPicker = goalEditorOpen || (prefs.enabled && !prefs.onboarded);
  const showPacing = prefs.goals.includes("pacing");
  const overallWpm = approximateWpm(metrics.timedWords, metrics.totalSpeakingMs);

  useEffect(() => {
    if (!prefs.expanded) setConfirmingReset(false);
  }, [prefs.expanded]);

  /** Collapses the panel and hands the keyboard back to the game (focus would otherwise trap WASD in the UI). */
  const collapse = () => {
    store.setExpanded(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  // Keys pressed in the panel stay in the panel (Tab, Enter and Space work on its controls, the player
  // doesn't move). Escape collapses it and returns the keyboard to the game.
  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      collapse();
    }
  };
  const keyGuard = {
    onKeyDown: handleKeyDown,
    onKeyUp: (event: KeyboardEvent) => event.stopPropagation(),
  };

  return (
    <>
      {!prefs.expanded ? (
        <div className="companion-launcher-wrap" {...keyGuard}>
          <button
            type="button"
            className={`companion-launcher${prefs.enabled ? "" : " companion-launcher-off"}`}
            aria-label={`Open Speaking Companion${prefs.enabled ? "" : " (turned off)"}${unseen ? ", new tip" : ""}`}
            title="Speaking Companion"
            aria-expanded={false}
            onClick={(event) => {
              store.setExpanded(true);
              if (event.detail > 0) event.currentTarget.blur();
              else requestAnimationFrame(() => panelRef.current?.focus());
            }}
          >
            <span aria-hidden="true">🗣</span>
            {unseen && <span className="companion-dot" aria-hidden="true" />}
          </button>
        </div>
      ) : (
        <aside
          ref={panelRef}
          className="companion-panel"
          aria-label="Speaking Companion"
          tabIndex={-1}
          {...keyGuard}
          onClick={(event) => {
            // After a mouse click on any control, give the keyboard back to the game. Keyboard users
            // (click detail 0) keep focus so they can carry on navigating the panel.
            const control = (event.target as HTMLElement).closest("button, input, label");
            if (event.detail > 0 && control && document.activeElement instanceof HTMLElement) document.activeElement.blur();
          }}
        >
          <header className="companion-header">
            <span className="companion-title">Speaking Companion</span>
            <button type="button" className="companion-icon-btn" aria-label="Collapse Speaking Companion" onClick={collapse}>
              ✕
            </button>
          </header>

          {!prefs.enabled ? (
            <div className="companion-section">
              <p>The companion is off. Nothing is measured and no tips are requested.</p>
              <button
                type="button"
                className="companion-btn"
                onClick={() => store.setEnabled(true)}
              >
                Turn on
              </button>
            </div>
          ) : (
            <>
              <section className="companion-section" aria-label="Goals">
                <h3 className="companion-heading">Goals</h3>
                {prefs.goals.length > 0 ? (
                  <ul className="companion-chips">
                    {prefs.goals.map((goal) => (
                      <li key={goal} className="companion-chip">
                        {goalLabel(goal)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="companion-muted">No goals chosen yet.</p>
                )}
                <button
                  type="button"
                  className="companion-link"
                  onClick={(event) => {
                    goalTriggerRef.current = event.detail === 0 ? event.currentTarget : null;
                    store.openGoalEditor();
                  }}
                >
                  {prefs.goals.length > 0 ? "Change goals" : "Choose goals"}
                </button>
              </section>

              {latest ? (
                <FeedbackView turn={latest} detailed={prefs.detailed} showPacing={showPacing} />
              ) : (
                <p className="companion-muted companion-section">
                  {hasTextGoal(prefs.goals) || showPacing
                    ? "Reply to a character by voice and your measurements and a short tip appear here. Typing always works too."
                    : "Choose a goal to get tips after your voice replies. Typing always works too."}
                </p>
              )}

              <section className="companion-section" aria-label="Practice so far">
                <h3 className="companion-heading">Practice so far</h3>
                <p className="companion-measure" data-testid="companion-totals">
                  Voice replies: {metrics.voiceTurns} · Speaking time:{" "}
                  {metrics.timedTurns > 0 ? formatDuration(metrics.totalSpeakingMs) : "unavailable"}
                  {metrics.timedTurns > 0 && metrics.timedTurns < metrics.voiceTurns && " (some replies had no recording time)"}
                </p>
                {showPacing && overallWpm !== null && (
                  <p className="companion-measure">
                    Overall pace: ≈ {overallWpm} words per minute. There's no “right” speed; this is only for noticing your
                    own pace over time.
                  </p>
                )}
              </section>

              <section className="companion-section companion-settings" aria-label="Companion settings">
                <label className="companion-toggle">
                  <input
                    type="checkbox"
                    checked={prefs.detailed}
                    onChange={(event) => store.setDetailed(event.target.checked)}
                  />{" "}
                  Show detailed tips
                </label>
                {confirmingReset ? (
                  <div className="companion-confirm" role="group" aria-label="Confirm reset">
                    <span>Reset your practice totals?</span>
                    <button
                      type="button"
                      className="companion-link"
                      onClick={() => {
                        store.resetProgress();
                        setConfirmingReset(false);
                      }}
                    >
                      Yes, reset
                    </button>
                    <button type="button" className="companion-link" onClick={() => setConfirmingReset(false)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <button type="button" className="companion-link" onClick={() => setConfirmingReset(true)}>
                    Reset progress
                  </button>
                )}
                <button
                  type="button"
                  className="companion-link"
                  onClick={() => store.setEnabled(false)}
                >
                  Turn companion off
                </button>
              </section>
            </>
          )}
        </aside>
      )}

      {showPicker && (
        <GoalPicker
          onboarding={!prefs.onboarded}
          initialGoals={prefs.goals}
          onSave={(goals) => store.saveGoals(goals)}
          onClose={() => store.closeGoalEditor()}
          returnFocusTo={prefs.onboarded ? goalTriggerRef.current : null}
        />
      )}
    </>
  );
}
