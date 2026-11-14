import { useCallback, useEffect, useRef, useState } from "react";
import type { NpcDialogueRequest, NpcReply } from "../services/npc/contract";
import { NpcDialogueError, requestNpcReply } from "../services/npc/npcDialogueClient";
import { isMockDialogueAvailable, mockNpcReply } from "../services/npc/mockNpcDialogue";

export type NpcDialogueStatus = "idle" | "loading" | "error";

/**
 * Loading/error wrapper around the NPC dialogue client. `useMock` must be an
 * explicit choice (dev only); API failures are reported, never swapped for a mock.
 * Resolves to the reply, or null on failure/cancel so callers can fall back to the scripted getReply.
 */
export function useNpcDialogue(options: { useMock?: boolean } = {}) {
  const [status, setStatus] = useState<NpcDialogueStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (request: NpcDialogueRequest): Promise<NpcReply | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      setError(null);
      try {
        const reply =
          options.useMock && isMockDialogueAvailable()
            ? await mockNpcReply(request, controller.signal)
            : await requestNpcReply(request, { signal: controller.signal });
        if (abortRef.current === controller) setStatus("idle");
        return reply;
      } catch (err) {
        if (controller.signal.aborted) return null;
        setError(err instanceof NpcDialogueError ? err.message : "The conversation failed.");
        setStatus("error");
        return null;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [options.useMock],
  );

  return { status, error, ask, cancel };
}
