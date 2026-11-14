import { useEffect, useRef, useState } from "react";
import { CLUES } from "../game/story/chapter1";
import { useGameState } from "../hooks/useGameState";

/** Briefly announces each newly discovered clue. */
export default function ClueToast() {
  const { clues } = useGameState();
  const seenCount = useRef(clues.length);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (clues.length <= seenCount.current) {
      seenCount.current = clues.length;
      return;
    }
    seenCount.current = clues.length;
    const newest = clues[clues.length - 1];
    setTitle(CLUES[newest]?.title ?? newest);
    const timer = window.setTimeout(() => setTitle(null), 4000);
    return () => window.clearTimeout(timer);
  }, [clues]);

  if (!title) return null;
  return (
    <div className="clue-toast" role="status">
      Clue discovered: {title}
    </div>
  );
}
