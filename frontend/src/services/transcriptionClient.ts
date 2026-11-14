/**
 * Transcription API client (Speech S1).
 *
 * Sends a recorded audio Blob to the backend and returns the recognized text.
 * No speech recognition happens here. The backend contract is an ASSUMPTION
 * (no /transcribe route exists yet); see docs/speech-s1.md.
 */

export interface TranscriptionConfig {
  baseUrl: string;
  path: string;
  /** multipart/form-data field name for the audio file. */
  fileField: string;
  /** Response JSON property holding the recognized text. */
  textField: string;
  timeoutMs: number;
}

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000",
  path: "/transcribe",
  fileField: "audio",
  textField: "text",
  // Players may record long, paused sentences; ASR can be slow on first call.
  timeoutMs: 60_000,
};

export type TranscriptionErrorKind = "network" | "http" | "malformed" | "timeout" | "cancelled";

export class TranscriptionError extends Error {
  constructor(
    public readonly kind: TranscriptionErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

const MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/mpeg"];

/** First MediaRecorder MIME type this browser supports, or "" to let the browser choose. */
export function pickRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return MIME_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** File extension matching a MIME type (parameters like ";codecs=opus" ignored). */
export function extensionForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "webm";
  }
}

export interface TranscribeOptions {
  signal?: AbortSignal;
  config?: Partial<TranscriptionConfig>;
}

export async function transcribeAudio(audio: Blob, options: TranscribeOptions = {}): Promise<string> {
  const config = { ...DEFAULT_TRANSCRIPTION_CONFIG, ...options.config };
  const url = config.baseUrl.replace(/\/+$/, "") + (config.path.startsWith("/") ? config.path : `/${config.path}`);

  const form = new FormData();
  form.append(config.fileField, audio, `recording.${extensionForMimeType(audio.type)}`);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", onExternalAbort);

  try {
    let response: Response;
    try {
      response = await fetch(url, { method: "POST", body: form, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new TranscriptionError("timeout", "The transcription request timed out.");
      if (controller.signal.aborted) throw new TranscriptionError("cancelled", "Transcription was cancelled.");
      throw new TranscriptionError("network", `Could not reach the transcription server at ${config.baseUrl}.`);
    }

    if (!response.ok) {
      throw new TranscriptionError(
        "http",
        `The transcription server returned an error (${response.status}).`,
        response.status,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new TranscriptionError("malformed", "The transcription server sent a response that was not valid JSON.");
    }
    const text = (data as Record<string, unknown> | null)?.[config.textField];
    if (typeof text !== "string") {
      throw new TranscriptionError("malformed", `The transcription response had no "${config.textField}" text.`);
    }
    return text;
  } catch (error) {
    // A body read can also be cut off by our abort.
    if (error instanceof TranscriptionError) throw error;
    if (timedOut) throw new TranscriptionError("timeout", "The transcription request timed out.");
    if (controller.signal.aborted) throw new TranscriptionError("cancelled", "Transcription was cancelled.");
    throw new TranscriptionError("network", "The transcription request failed.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}
