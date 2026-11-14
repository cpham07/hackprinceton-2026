import type { StoryAction } from "../story/actions";

export interface PuzzleSymbol {
  id: string;
  name: string;
  meaning: string;
  /** Placeholder icon shown in the puzzle UI until real art exists. */
  glyph: string;
}

/** A puzzle solved by putting symbols in one specific order. */
export interface SequencePuzzle {
  id: string;
  title: string;
  inscription: string;
  symbols: PuzzleSymbol[];
  /** Symbol ids in the correct order. */
  solution: string[];
  /** Applied once when the puzzle is solved. */
  rewardActions: StoryAction[];
  solvedMessage: string;
}

/** Deterministic check: same symbols, same positions. */
export function isCorrectSequence(puzzle: SequencePuzzle, order: readonly string[]): boolean {
  return (
    order.length === puzzle.solution.length &&
    order.every((symbolId, index) => symbolId === puzzle.solution[index])
  );
}

/** A random starting order that is never already the solution. */
export function shuffledStart(puzzle: SequencePuzzle): string[] {
  const order = [...puzzle.solution];
  do {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  } while (order.length > 1 && isCorrectSequence(puzzle, order));
  return order;
}
