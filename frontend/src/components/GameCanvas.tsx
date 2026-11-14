import { useLayoutEffect, useRef } from "react";
import { createGame } from "../game/config";

/**
 * Mounts one Phaser game in a div and destroys it on unmount.
 * Under StrictMode the effect runs twice in dev; the cleanup destroys the first
 * game (and its canvas) so only one instance stays alive.
 */
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const game = createGame(containerRef.current!);
    if (import.meta.env.DEV) {
      (window as unknown as { __game?: unknown }).__game = game; // for debugging in the console
    }
    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" />;
}
