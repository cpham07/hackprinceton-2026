import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PlayerResponse } from "../../game/types/dialogue";
import type { Recording } from "../../hooks/useVoiceRecorder";
import { transcribeAudio, TranscriptionError, type TranscriptionConfig } from "../../services/transcriptionClient";
import { buildConfirmedResponse, type TranscriptSource } from "./confirmedResponse";
import VoiceRecorder from "./VoiceRecorder";
import "./voice.css";

interface VoiceInputProps {
  npcId: string;
  /** Receives the confirmed response; wire to the central submitPlayerResponse. */
  onSubmit: (response: PlayerResponse) => void;
  /** Overrides for the transcription endpoint (tests, alternate backends). */
  transcriptionConfig?: Partial<TranscriptionConfig>;
  /** Mock transcripts are development-only regardless of this prop. */
  allowMockTranscript?: boolean;
  /** Blocks only the final "Confirm & Send" (e.g. while an NPC reply is pending). Recording and editing still work. */
  disabled?: boolean;
  /** Show the "Type instead" shortcut. Turn off where a typed field is already on screen. */
  allowTyping?: boolean;
}

type Stage =
  | { kind: "record" }
  | { kind: "recorded"; recording: Recording }
  | { kind: "transcribing" }
  /** durationMs: the recorder's elapsed time for a real transcription (carried to the confirmed response). */
  | { kind: "review"; source: TranscriptSource; durationMs?: number };

function Playback({ blob }: { blob: Blob }) {
  // Created and revoked in the same effect, so React StrictMode's simulated unmount can't revoke a URL still in use.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url ? <audio controls src={url} className="voice-audio" /> : null;
}

const SAMPLE_TRANSCRIPT = "I seek the wisdom of Athena, please let me pass.";

/**
 * Voice reply flow: record → (explicit) transcribe → edit → (explicit) confirm.
 * Typing is always available. Audio and transcripts live only in component state.
 */
export default function VoiceInput({
  npcId,
  onSubmit,
  transcriptionConfig,
  allowMockTranscript = true,
  disabled = false,
  allowTyping = true,
}: VoiceInputProps) {
  const mockEnabled = import.meta.env.DEV && allowMockTranscript;
  const [stage, setStage] = useState<Stage>({ kind: "record" });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (stage.kind === "review") editorRef.current?.focus();
  }, [stage.kind]);

  const handleRecorded = useCallback((recording: Recording) => {
    setError(null);
    setStage({ kind: "recorded", recording });
  }, []);

  const sendForTranscription = async (recording: Recording) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setStage({ kind: "transcribing" });
    try {
      const text = await transcribeAudio(recording.blob, { signal: controller.signal, config: transcriptionConfig });
      setDraft(text);
      setStage({ kind: "review", source: "real", durationMs: recording.durationMs });
    } catch (err) {
      if (err instanceof TranscriptionError && err.kind === "cancelled") return;
      setError(
        (err instanceof TranscriptionError ? err.message : "Transcription failed.") +
          " Your recording is kept so you can try again, or type your reply instead.",
      );
      setStage({ kind: "recorded", recording });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancelTranscription = () => {
    abortRef.current?.abort();
    setStage({ kind: "record" });
  };

  const reset = () => {
    setDraft("");
    setError(null);
    setStage({ kind: "record" });
  };

  const useMock = () => {
    setDraft(SAMPLE_TRANSCRIPT);
    setStage({ kind: "review", source: "mock" });
  };

  const typeInstead = () => {
    setDraft("");
    setError(null);
    setStage({ kind: "review", source: "typed" });
  };

  const confirm = () => {
    const text = draft.trim();
    if (!text || stage.kind !== "review" || disabled) return;
    // Text the player typed from scratch is honestly a text response; a real recording's time travels with it.
    onSubmit(buildConfirmedResponse(npcId, text, stage.source, stage.durationMs));
    reset();
  };

  // Keep typing away from the game; let Escape reach the parent (dialogue close).
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") event.stopPropagation();
  };

  return (
    <div className="voice-input" onKeyDown={handleKeyDown} onKeyUp={(event) => event.stopPropagation()}>
      {stage.kind === "record" && (
        <>
          <VoiceRecorder onRecorded={handleRecorded} />
          <div className="voice-row">
            {allowTyping && (
              <button type="button" className="voice-btn voice-btn-secondary" onClick={typeInstead}>
                ⌨ Type instead
              </button>
            )}
            {mockEnabled && (
              <button type="button" className="voice-btn voice-btn-mock" onClick={useMock}>
                Use sample transcript (DEV MOCK)
              </button>
            )}
          </div>
        </>
      )}

      {stage.kind === "recorded" && (
        <div className="voice-panel">
          <p className="voice-note">
            Recording ready ({Math.max(1, Math.round(stage.recording.durationMs / 1000))}s). Nothing has been sent yet.
          </p>
          <Playback blob={stage.recording.blob} />
          <div className="voice-row">
            <button type="button" className="voice-btn" onClick={() => sendForTranscription(stage.recording)}>
              Transcribe recording
            </button>
            <button type="button" className="voice-btn voice-btn-secondary" onClick={reset}>
              Record again
            </button>
            {allowTyping && (
              <button type="button" className="voice-btn voice-btn-secondary" onClick={typeInstead}>
                ⌨ Type instead
              </button>
            )}
            {mockEnabled && (
              <button type="button" className="voice-btn voice-btn-mock" onClick={useMock}>
                Use sample transcript (DEV MOCK)
              </button>
            )}
          </div>
        </div>
      )}

      {stage.kind === "transcribing" && (
        <div className="voice-panel" role="status">
          <p className="voice-note">Transcribing…</p>
          <button type="button" className="voice-btn voice-btn-secondary" onClick={cancelTranscription}>
            Cancel
          </button>
        </div>
      )}

      {stage.kind === "review" && (
        <div className="voice-panel">
          <label className="voice-label" htmlFor="voice-transcript">
            {stage.source === "typed"
              ? "Type your reply"
              : stage.source === "mock"
                ? "Sample transcript (MOCK, not real speech recognition). Edit as you like:"
                : "Here's what we heard. Fix anything that's wrong, or rewrite it:"}
          </label>
          <textarea
            id="voice-transcript"
            ref={editorRef}
            className="voice-textarea"
            value={draft}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                confirm();
              }
            }}
          />
          <div className="voice-row">
            <button type="button" className="voice-btn" onClick={confirm} disabled={!draft.trim() || disabled}>
              Confirm &amp; Send
            </button>
            <button type="button" className="voice-btn voice-btn-secondary" onClick={reset}>
              Record again
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
