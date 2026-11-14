import type { NpcDialogueRequest, NpcReply } from "./contract";

/**
 * SIMULATED NPC replies for exercising the contract without a backend LLM.
 * Development only. It never proposes actions, so it can never grant anything.
 * Callers must opt in explicitly; it is never used as a fallback for API errors.
 */
export const MOCK_LABEL = "[SIMULATED REPLY: not a real NPC model]";

export function isMockDialogueAvailable(): boolean {
  return import.meta.env.DEV;
}

export async function mockNpcReply(request: NpcDialogueRequest, signal?: AbortSignal): Promise<NpcReply> {
  if (!isMockDialogueAvailable()) throw new Error("Mock dialogue is disabled outside development.");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 400);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  const text = request.playerText.toLowerCase();
  let npcResponse: string;
  if (request.npcId === "hades") {
    if (text.includes("aphrodite")) {
      npcResponse = "Aphrodite sent you? How interesting. What exactly did she tell you, and why did you believe her?";
    } else if (text.includes("zeus")) {
      npcResponse = "You speak of Zeus as though you know him. What have you seen with your own eyes?";
    } else {
      npcResponse = `You say "${request.playerText}". Tell me more: why does that matter to you?`;
    }
  } else {
    npcResponse = `(${request.npcId}) I hear you say: "${request.playerText}".`;
  }
  return { npcResponse: `${MOCK_LABEL} ${npcResponse}`, proposedAction: null, source: "mock" };
}
