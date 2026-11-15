import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { SequencePuzzle } from "../game/puzzles/sequencePuzzle";

interface SymbolPuzzleProps {
  puzzle: SequencePuzzle;
  /** Current arrangement (symbol ids). Owned by the parent so it survives closing the puzzle. */
  order: string[];
  /** From the game state: the reward has already been earned. */
  solved: boolean;
  onReorder: (order: string[]) => void;
  /** Checks the arrangement. Returns whether it was correct. */
  onSubmit: (order: string[]) => boolean;
  onClose: () => void;
}

/** Arrange symbols in order: click two tiles to swap them, or use the arrow buttons. */
export default function SymbolPuzzle({ puzzle, order, solved, onReorder, onSubmit, onClose }: SymbolPuzzleProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Escape must close the puzzle even when focus has left it: solving it removes the Submit button the
  // player just clicked, which drops focus to the page. Keys pressed inside the box use its own handler.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      if (active && active !== document.body && boxRef.current?.contains(active)) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Once solved, the Submit button is gone: keep focus in the box so the keyboard still works.
  useEffect(() => {
    if (justSolved) boxRef.current?.focus();
  }, [justSolved]);

  // Keep focus inside the box so Escape and the buttons work from the keyboard.
  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  const shown = solved ? puzzle.solution : order;
  const symbolById = (id: string) => puzzle.symbols.find((symbol) => symbol.id === id)!;

  const swap = (a: number, b: number) => {
    if (b < 0 || b >= order.length) return;
    const next = [...order];
    [next[a], next[b]] = [next[b], next[a]];
    onReorder(next);
    setSelected(null);
    setFeedback(null);
  };

  const handleTileClick = (index: number) => {
    if (selected === null) setSelected(index);
    else if (selected === index) setSelected(null);
    else swap(selected, index);
  };

  const handleSubmit = () => {
    setSelected(null);
    if (onSubmit(order)) {
      setJustSolved(true);
      setFeedback(null);
    } else {
      setFeedback("The pedestal stays shut. That is not the order the inscription describes.");
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation(); // keys never reach the game
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="puzzle-backdrop">
      <div
        ref={boxRef}
        className="puzzle-box"
        role="dialog"
        aria-label={puzzle.title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => event.stopPropagation()}
      >
        <header className="puzzle-header">
          <span className="puzzle-title">{puzzle.title}</span>
          <button type="button" className="puzzle-close" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="puzzle-inscription">"{puzzle.inscription}"</p>
        {!solved && (
          <p className="puzzle-help">
            Put the symbols in order from left to right. Click two symbols to swap them, or use the arrows.
          </p>
        )}

        <ol className={`puzzle-tiles${solved ? " puzzle-tiles-solved" : ""}`}>
          {shown.map((symbolId, index) => {
            const symbol = symbolById(symbolId);
            return (
              <li key={symbolId} className="puzzle-slot" data-symbol={symbolId}>
                <button
                  type="button"
                  className={`puzzle-tile${selected === index ? " puzzle-tile-selected" : ""}`}
                  onClick={() => handleTileClick(index)}
                  disabled={solved}
                  aria-pressed={selected === index}
                  aria-label={`Position ${index + 1}: ${symbol.name}, ${symbol.meaning}`}
                >
                  <span className="puzzle-glyph" aria-hidden="true">{symbol.glyph}</span>
                  <span className="puzzle-name">{symbol.name}</span>
                  <span className="puzzle-meaning">{symbol.meaning}</span>
                </button>
                {!solved && (
                  <div className="puzzle-move">
                    <button
                      type="button"
                      onClick={() => swap(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Move ${symbol.name} left`}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => swap(index, index + 1)}
                      disabled={index === shown.length - 1}
                      aria-label={`Move ${symbol.name} right`}
                    >
                      ▶
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="puzzle-footer" aria-live="polite">
          {solved ? (
            <p className={`puzzle-solved${justSolved ? " puzzle-solved-new" : ""}`}>
              <span className="puzzle-seal" aria-hidden="true">◆</span>
              {justSolved ? puzzle.solvedMessage : "Solved. You already hold the Seal of Wisdom."}
            </p>
          ) : (
            <>
              <p className="puzzle-feedback">{feedback}</p>
              <button type="button" className="puzzle-submit" onClick={handleSubmit}>
                Submit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
