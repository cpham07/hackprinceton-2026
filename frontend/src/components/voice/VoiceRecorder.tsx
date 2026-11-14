import { useVoiceRecorder, type Recording } from "../../hooks/useVoiceRecorder";

interface VoiceRecorderProps {
  /** Called when the player presses Stop. Nothing is uploaded here. */
  onRecorded: (recording: Recording) => void;
  disabled?: boolean;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Record / Stop controls only. Independent of NPCs, Phaser and the backend. */
export default function VoiceRecorder({ onRecorded, disabled = false }: VoiceRecorderProps) {
  const { status, error, elapsedMs, supported, start, stop, dismissError } = useVoiceRecorder({ onRecorded });
  const recording = status === "recording";

  return (
    <div className="voice-recorder">
      {!supported && (
        <p className="voice-note" role="status">
          This browser can't record audio. You can type your reply instead.
        </p>
      )}

      <div className="voice-row">
        {!recording ? (
          <button
            type="button"
            className="voice-btn"
            onClick={start}
            disabled={disabled || !supported || status === "requesting"}
          >
            {status === "requesting" ? "Waiting for microphone…" : "🎤 Start recording"}
          </button>
        ) : (
          <button type="button" className="voice-btn voice-btn-stop" onClick={stop}>
            ■ Stop recording
          </button>
        )}

        {recording && (
          <span className="voice-indicator" role="status" aria-live="polite">
            <span className="voice-dot" aria-hidden="true" /> Recording {formatTime(elapsedMs)}
          </span>
        )}
      </div>

      {recording && (
        <p className="voice-note">Take your time. Recording continues through pauses until you press Stop.</p>
      )}

      {error && (
        <p className="voice-error" role="alert">
          {error}{" "}
          <button type="button" className="voice-link" onClick={dismissError}>
            Dismiss
          </button>
        </p>
      )}
    </div>
  );
}
