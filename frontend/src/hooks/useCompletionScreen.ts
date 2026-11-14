import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneKey } from "../game/constants";

/**
 * Whether a chapter-completion screen is open. It opens only at the moment the completion flag
 * turns true while the player is in the chapter's own scene, and stays open until closed.
 * A completion that was already applied before the scene was running (a dev shortcut, a later
 * visit to the scene) never opens it, so it cannot reappear after scene changes.
 */
export function useCompletionScreen(
  completed: boolean,
  scene: SceneKey,
  activeScene: SceneKey | null,
): [open: boolean, close: () => void] {
  const [open, setOpen] = useState(false);
  const wasCompleted = useRef(completed);

  useEffect(() => {
    if (completed && !wasCompleted.current && activeScene === scene) setOpen(true);
    wasCompleted.current = completed;
  }, [completed, scene, activeScene]);

  const close = useCallback(() => setOpen(false), []);
  return [open, close];
}
