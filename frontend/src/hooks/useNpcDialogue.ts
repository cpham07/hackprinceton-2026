import { useCallback, useEffect, useRef, useState } from "react";
import type { NpcDialogueRequest, NpcReply } from "../services/npc/contract";
import { NpcDialogueError, requestNpcReply } from "../services/npc/npcDialogueClient";
import { isMockDialogueAvailable, mockNpcReply } from "../services/npc/mockNpcDialogue";

export type NpcDialogueStatus = "idle" | "loading" | "error";

/** The outcome of one request. A failure is reported, never swapped for a simulated reply. */
export type NpcAskResult =
  | { kind: "reply"; reply: NpcReply }
  | { kind: "error"; message: string }
  | { kind: "cancelled" };

/**
 * Loading/error wrapper around the NPC dialogue client. `useMock` must be an explicit choice
 * (development builds only); API failures are reported, never swapped for a mock.
 * `cancel()` aborts the request in flight; its result is then `{ kind: "cancelled" }`.
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
    async (request: NpcDialogueRequest): Promise<NpcAskResult> => {
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
        if (controller.signal.aborted) return { kind: "cancelled" };
        if (abortRef.current === controller) setStatus("idle");
        return { kind: "reply", reply };
      } catch (err) {
        if (controller.signal.aborted) return { kind: "cancelled" };
        const message = err instanceof NpcDialogueError ? err.message : "The conversation failed.";
        setError(message);
        setStatus("error");
        return { kind: "error", message };
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [options.useMock],
  );

  return { status, error, ask, cancel };
}
