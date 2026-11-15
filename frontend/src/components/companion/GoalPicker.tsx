import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { GOALS, toggleGoal, type GoalId } from "../../companion/goals";
import { EventBus } from "../../game/EventBus";

interface GoalPickerProps {
  /** First visit: worded as a welcome, and closing it means "skip". */
  onboarding: boolean;
  initialGoals: GoalId[];
  onSave: (goals: GoalId[]) => void;
  /** Skip (onboarding) or cancel (editing): goals are unchanged. */
  onClose: () => void;
}

/** Shared input-lock id: the active scene freezes gameplay while any overlay id is open. */
export const GOAL_PICKER_OVERLAY_ID = "speaking-companion-goals";

/** Compact modal to choose speaking goals. Locks gameplay input while open, like the dialogue box. */
export default function GoalPicker({ onboarding, initialGoals, onSave, onClose }: GoalPickerProps) {
  const [goals, setGoals] = useState<GoalId[]>(initialGoals);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  // Lock gameplay through the same mechanism as the dialogue and puzzles. Re-announced when a scene becomes
  // ready, because a scene that starts while this is open begins with an empty lock list.
  useEffect(() => {
    EventBus.emit("overlay:opened", { id: GOAL_PICKER_OVERLAY_ID });
    const offReady = EventBus.on("scene:ready", () => EventBus.emit("overlay:opened", { id: GOAL_PICKER_OVERLAY_ID }));
    return () => {
      offReady();
      EventBus.emit("overlay:closed", { id: GOAL_PICKER_OVERLAY_ID });
    };
  }, []);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Escape closes this picker even if focus has left it (it is modal), and never reaches a dialogue behind it.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      if (active && active !== document.body && boxRef.current?.contains(active)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation(); // keys never reach the game or the dialogue underneath
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="companion-backdrop">
      <div
        ref={boxRef}
        className="companion-goals"
        role="dialog"
        aria-modal="true"
        aria-labelledby="companion-goals-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => event.stopPropagation()}
      >
        <h2 id="companion-goals-title" className="companion-goals-title">
          {onboarding ? "Your Speaking Companion" : "Speaking goals"}
        </h2>
        {onboarding && (
          <p className="companion-goals-intro">
            Talk to the gods by voice or by typing. If you reply by voice, the companion can give you a short tip
            afterwards. Choose what you'd like to practise. You can change this, skip it, or turn the companion off at
            any time.
          </p>
        )}
        <fieldset className="companion-goals-list">
          <legend>I'd like to… (choose any)</legend>
          {GOALS.map((goal, index) => (
            <label key={goal.id} className="companion-goal">
              <input
                ref={index === 0 ? firstRef : undefined}
                type="checkbox"
                checked={goals.includes(goal.id)}
                onChange={() => setGoals((current) => toggleGoal(current, goal.id))}
              />
              <span>
                <strong>{goal.label}</strong>
                <span className="companion-goal-hint">{goal.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="companion-privacy">
          Feedback looks only at the words you confirm, never your accent or voice. This browser keeps only your goals
          and practice totals; recordings and transcripts aren't saved.
        </p>
        <div className="companion-actions">
          <button type="button" className="companion-btn" onClick={() => onSave(goals)}>
            {onboarding ? "Start with these goals" : "Save goals"}
          </button>
          <button type="button" className="companion-btn companion-btn-secondary" onClick={onClose}>
            {onboarding ? "Skip for now" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
