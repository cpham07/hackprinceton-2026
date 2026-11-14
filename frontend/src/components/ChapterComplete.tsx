import { CHAPTER_1_TITLE, CHAPTER_2_TEASER } from "../game/story/chapter1";

/** Full-screen transition shown once Chapter 1 is complete. */
export default function ChapterComplete() {
  return (
    <div className="chapter-complete" role="dialog" aria-label="Chapter complete">
      <div className="chapter-complete-card">
        <p className="chapter-complete-kicker">Chapter complete</p>
        <h1>{CHAPTER_1_TITLE}</h1>
        <p>The gatekeeper sleeps, and you step through the gate into Olympus.</p>
        <p className="chapter-complete-next">{CHAPTER_2_TEASER}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Play again
        </button>
      </div>
    </div>
  );
}
