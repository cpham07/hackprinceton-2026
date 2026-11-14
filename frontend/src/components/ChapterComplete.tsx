import { useState } from "react";
import { CHAPTER_2_TITLE } from "../game/story/chapter2";
import { CHAPTER_3_TEASER, CHAPTER_3_TITLE } from "../game/story/chapter3";

interface ChapterCompleteProps {
  /**
   * Which chapter was just completed. Passed explicitly because the game state has already
   * moved on to the next chapter by the time this screen is shown.
   */
  completedChapter: 1 | 2;
  /** Chapter 1: called once when the player continues, to start the next scene. */
  onContinue?: () => void;
  /** Chapter 2: called when the player leaves the Chapter 3 placeholder and goes back to Olympus. */
  onClose?: () => void;
}

const SCREENS = {
  1: {
    heading: "Chapter 1 Complete — Welcome to Olympus",
    body: "The gatekeeper sleeps, and you step through the gate into Olympus.",
    next: `Next: ${CHAPTER_2_TITLE}`,
    button: "Continue to Olympus",
  },
  2: {
    heading: "Chapter 2 Complete — The Secrets of the Gods",
    body: "The three magical seals of Wisdom, Courage and Passage are yours, and the path to Zeus's palace is open.",
    next: `Next: ${CHAPTER_3_TITLE}`,
    button: "Continue to Zeus's Palace",
  },
} as const;

/** Full-screen transition shown once a chapter is complete, until the player continues. */
export default function ChapterComplete({ completedChapter, onContinue, onClose }: ChapterCompleteProps) {
  const [continuing, setContinuing] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const screen = SCREENS[completedChapter];

  const handleContinue = () => {
    if (continuing) return;
    setContinuing(true);
    if (completedChapter === 2) setShowPlaceholder(true); // Chapter 3 is not playable yet: no scene change.
    else onContinue?.();
  };

  if (showPlaceholder) {
    return (
      <div className="chapter-complete" role="dialog" aria-label="Chapter 3 coming next">
        <div className="chapter-complete-card">
          <p className="chapter-complete-kicker">The story continues</p>
          <h1>{CHAPTER_3_TEASER}</h1>
          <p>The gates of Zeus's palace are open, and the three seals are safe in your hands.</p>
          <div className="chapter-complete-actions">
            <button type="button" className="primary" onClick={onClose} autoFocus>
              Back to Olympus
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              Play again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chapter-complete" role="dialog" aria-label="Chapter complete">
      <div className="chapter-complete-card">
        <p className="chapter-complete-kicker">Chapter complete</p>
        <h1>{screen.heading}</h1>
        <p>{screen.body}</p>
        <p className="chapter-complete-next">{screen.next}</p>
        <div className="chapter-complete-actions">
          <button type="button" className="primary" onClick={handleContinue} disabled={continuing} autoFocus>
            {screen.button}
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
