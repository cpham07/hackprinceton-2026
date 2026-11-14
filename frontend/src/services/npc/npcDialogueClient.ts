import type { NpcDialogueRequest, NpcDialogueResponse, NpcReply, ProposedAction } from "./contract";

export interface NpcDialogueConfig {
  baseUrl: string;
  /** Proposed route; confirm with the backend team. */
  path: string;
  timeoutMs: number;
}

export const DEFAULT_NPC_DIALOGUE_CONFIG: NpcDialogueConfig = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000",
  path: "/npc/dialogue",
  timeoutMs: 30_000,
};

export type NpcDialogueErrorKind = "network" | "http" | "malformed" | "timeout" | "cancelled";

export class NpcDialogueError extends Error {
  constructor(
    public readonly kind: NpcDialogueErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "NpcDialogueError";
  }
}

const ACTION_KEYS = {
  setFlag: "flag",
  addClue: "clue",
  completeQuest: "quest",
  grantSeal: "seal",
} as const;

function parseProposedAction(value: unknown): ProposedAction | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new Error("proposedAction must be an object or null");
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string" || !(type in ACTION_KEYS)) throw new Error("unknown proposedAction type");
  const key = ACTION_KEYS[type as keyof typeof ACTION_KEYS];
  const field = record[key];
  if (typeof field !== "string" || !field) throw new Error(`proposedAction.${key} must be a string`);
  if (type === "grantSeal" && !["athena", "ares", "hades"].includes(field)) throw new Error("unknown seal");
  // Rebuild from known fields so unexpected backend properties are dropped.
  return { type, [key]: field } as ProposedAction;
}

/** Runtime validation of a backend response. Throws Error with a reason when malformed. */
export function parseNpcDialogueResponse(data: unknown): NpcDialogueResponse {
  if (typeof data !== "object" || data === null) throw new Error("response is not an object");
  const record = data as Record<string, unknown>;
  const text = record.npcResponse;
  if (typeof text !== "string" || !text.trim()) throw new Error("npcResponse must be a non-empty string");
  return { npcResponse: text, proposedAction: parseProposedAction(record.proposedAction) };
}

export interface RequestOptions {
  signal?: AbortSignal;
  config?: Partial<NpcDialogueConfig>;
}

/** Ask the backend for an NPC reply. Failures throw NpcDialogueError; nothing is faked. */
export async function requestNpcReply(request: NpcDialogueRequest, options: RequestOptions = {}): Promise<NpcReply> {
  const config = { ...DEFAULT_NPC_DIALOGUE_CONFIG, ...options.config };
  const url = config.baseUrl.replace(/\/+$/, "") + (config.path.startsWith("/") ? config.path : `/${config.path}`);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", onAbort);

  const abortError = () =>
    timedOut
      ? new NpcDialogueError("timeout", "The conversation server took too long to answer.")
      : new NpcDialogueError("cancelled", "The request was cancelled.");

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new NpcDialogueError("network", "Could not reach the conversation server.");
    }
    if (!response.ok) {
      throw new NpcDialogueError("http", `The conversation server returned an error (${response.status}).`, response.status);
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted) throw abortError();
      throw new NpcDialogueError("malformed", "The conversation server sent an unreadable response.");
    }
    try {
      return { ...parseNpcDialogueResponse(data), source: "api" };
    } catch (error) {
      throw new NpcDialogueError("malformed", `Invalid conversation response: ${(error as Error).message}.`);
    }
  } catch (error) {
    if (error instanceof NpcDialogueError) throw error;
    throw controller.signal.aborted ? abortError() : new NpcDialogueError("network", "The request failed.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
