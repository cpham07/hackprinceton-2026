import { GUARDIAN_TITLE } from "../game/story/chapter5";

/** Starts the game over from Chapter 1 (also dropping any development shortcut in the URL). */
function restartGame(): void {
  window.location.assign(window.location.pathname);
}

/** The final screen. The story is over, so the only way on is to play again. */
export default function EndingScreen() {
  return (
    <div className="chapter-complete ending" role="dialog" aria-label="The end">
      <div className="chapter-complete-card ending-card">
        <p className="chapter-complete-kicker">The End</p>
        <h1>{GUARDIAN_TITLE}</h1>
        <p>
          Aphrodite's enchantments lie in pieces. She gave up the Master Lightning Bolt, Zeus is free and holds it
          once more, and golden light has washed the pink haze from every column on the mountain.
        </p>
        <p>
          For the first time in an age, Olympus has opened its gates to mortals. You woke here a stranger and a
          courier; you leave as the one who guards that welcome.
        </p>
        <ul className="ending-summary">
          <li>Seals of Wisdom, Courage and Passage</li>
          <li>The Master Lightning Bolt, returned to Zeus</li>
          <li>Mortals welcomed back to Olympus</li>
        </ul>
        <p className="chapter-complete-next">Thank you for playing.</p>
        <div className="chapter-complete-actions">
          <button type="button" className="primary" onClick={restartGame} autoFocus>
            Play again from the beginning
          </button>
        </div>
      </div>
    </div>
  );
}
