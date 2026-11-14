import { useState } from "react";
import { CHAPTER_1_TITLE } from "../game/story/chapter1";
import { CHAPTER_2_TITLE } from "../game/story/chapter2";

interface ChapterCompleteProps {
  /** Called once when the player chooses to continue to Chapter 2. */
  onContinue: () => void;
}

/** Full-screen transition shown once Chapter 1 is complete, until the player continues. */
export default function ChapterComplete({ onContinue }: ChapterCompleteProps) {
  const [continuing, setContinuing] = useState(false);

  const handleContinue = () => {
    if (continuing) return;
    setContinuing(true);
    onContinue();
  };

  return (
    <div className="chapter-complete" role="dialog" aria-label="Chapter complete">
      <div className="chapter-complete-card">
        <p className="chapter-complete-kicker">Chapter complete</p>
        <h1>{CHAPTER_1_TITLE}</h1>
        <p>The gatekeeper sleeps, and you step through the gate into Olympus.</p>
        <p className="chapter-complete-next">Next: {CHAPTER_2_TITLE}</p>
        <div className="chapter-complete-actions">
          <button type="button" className="primary" onClick={handleContinue} disabled={continuing} autoFocus>
            Continue to Olympus
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
