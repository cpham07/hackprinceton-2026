import { useEffect, useRef, useState } from "react";
import { SEALS } from "../game/story/chapter2";
import { useGameState } from "../hooks/useGameState";

/** Briefly announces each newly obtained seal. */
export default function SealToast() {
  const { seals } = useGameState();
  // Seals held when this mounted don't count as new.
  const seen = useRef(new Set(SEALS.filter((s) => seals[s.id]).map((s) => s.id)));
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const fresh = SEALS.filter((s) => seals[s.id] && !seen.current.has(s.id));
    if (fresh.length === 0) return;
    fresh.forEach((s) => seen.current.add(s.id));
    setName(fresh[fresh.length - 1].name);
    const timer = window.setTimeout(() => setName(null), 4500);
    return () => window.clearTimeout(timer);
  }, [seals]);

  if (!name) return null;
  return (
    <div className="seal-toast" role="status">
      <span aria-hidden="true">◆</span> Seal obtained: {name}
    </div>
  );
}
