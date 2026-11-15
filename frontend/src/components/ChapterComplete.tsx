import { useState } from "react";
import { CHAPTER_2_TITLE } from "../game/story/chapter2";
import { CHAPTER_3_TITLE } from "../game/story/chapter3";
import { CHAPTER_4_TITLE } from "../game/story/chapter4";
import { CHAPTER_5_TITLE } from "../game/story/chapter5";

interface ChapterCompleteProps {
  /**
   * Which chapter was just completed. Passed explicitly because the game state has already
   * moved on to the next chapter by the time this screen is shown.
   */
  completedChapter: 1 | 2 | 3 | 4;
  /** Called once when the player continues, to start the next chapter's scene. */
  onContinue: () => void;
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
  3: {
    heading: "Chapter 3 Complete — The Forbidden Vault",
    body: "You escape Zeus's palace with the Master Lightning Bolt in your hands, and his warning still ringing in your ears.",
    next: `Next: ${CHAPTER_4_TITLE}`,
    button: "Continue",
  },
  4: {
    heading: "Chapter 4 Complete — The Betrayal",
    body: "Aphrodite holds the Master Lightning Bolt and Zeus is her prisoner. Olympus is hers, for now. But Athena and Ares stand with you.",
    next: `Next: ${CHAPTER_5_TITLE}`,
    button: "Continue",
  },
} as const;

/** Full-screen transition shown once a chapter is complete, until the player continues. */
export default function ChapterComplete({ completedChapter, onContinue }: ChapterCompleteProps) {
  const [continuing, setContinuing] = useState(false);
  const screen = SCREENS[completedChapter];

  const handleContinue = () => {
    if (continuing) return;
    setContinuing(true);
    onContinue();
  };

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
