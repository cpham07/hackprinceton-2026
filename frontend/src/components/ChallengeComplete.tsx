import { useEffect, useRef, type KeyboardEvent } from "react";

interface ChallengeCompleteProps {
  title: string;
  message: string;
  onReturn: () => void;
  onStay: () => void;
}

/** Success overlay after a challenge. Blocks gameplay input while open (via App's overlay lock). */
export default function ChallengeComplete({ title, message, onReturn, onStay }: ChallengeCompleteProps) {
  const returnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    returnRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation(); // keys never reach the game
    if (event.key === "Escape") {
      event.preventDefault();
      onStay();
    }
  };

  return (
    <div className="chapter-complete" role="dialog" aria-label={title} onKeyDown={handleKeyDown} onKeyUp={(e) => e.stopPropagation()}>
      <div className="chapter-complete-card">
        <p className="chapter-complete-kicker">Trial complete</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="chapter-complete-actions">
          <button ref={returnRef} type="button" className="primary" onClick={onReturn}>
            Return to Olympus
          </button>
          <button type="button" onClick={onStay}>
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}
