import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { DialogueLine, PlayerResponse } from "../game/types/dialogue";
import VoiceInput from "./voice/VoiceInput";

interface DialogueBoxProps {
  npcName: string;
  lines: DialogueLine[];
  /** Called with trimmed, nonempty typed text. */
  onSubmit: (text: string) => void;
  onClose: () => void;
  /** Read-only mode (inscriptions, finished conversations): no text field, voice controls or Send button. */
  hideInput?: boolean;
  /**
   * Voice input. When both are given (and the box is not read-only) a microphone section appears
   * under the text field. Confirmed voice replies arrive here as `method: "voice"`.
   */
  npcId?: string;
  onSubmitResponse?: (response: PlayerResponse) => void;
  /** An NPC reply is on its way: submissions are blocked and a "thinking" line shows. */
  pending?: boolean;
}

export default function DialogueBox({
  npcName,
  lines,
  onSubmit,
  onClose,
  hideInput = false,
  npcId,
  onSubmitResponse,
  pending = false,
}: DialogueBoxProps) {
  const [draft, setDraft] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // The key that opened the dialogue may still be held down. Until a key is released,
  // drop auto-repeat keydowns so a held E doesn't fill the input with "eeee".
  const ignoreRepeats = useRef(true);

  // Keep focus inside the box so Escape and typing always land here.
  useEffect(() => {
    (hideInput ? closeRef.current : inputRef.current)?.focus();
  }, [hideInput]);

  // After a reply arrives, return focus to the text field unless the player moved it elsewhere in the box.
  useEffect(() => {
    if (!pending && !hideInput && document.activeElement === document.body) inputRef.current?.focus();
  }, [pending, hideInput]);

  // Escape must close the dialogue even when focus has left it (clicking plain text, or a control that
  // unmounted). Keys pressed inside the box are handled by its own onKeyDown below.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      if (active && active !== document.body && dialogRef.current?.contains(active)) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const release = () => {
      ignoreRepeats.current = false;
    };
    window.addEventListener("keyup", release, true);
    return () => window.removeEventListener("keyup", release, true);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines, pending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    onSubmit(text);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation(); // typing never reaches the game
    if (event.repeat && ignoreRepeats.current) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  /** A confirmed voice reply: hand it on, then put the cursor back in the text field. */
  const submitVoice = (response: PlayerResponse) => {
    onSubmitResponse?.(response);
    inputRef.current?.focus();
  };

  const showVoice = !hideInput && onSubmitResponse !== undefined && npcId !== undefined;

  return (
    <div
      ref={dialogRef}
      className="dialogue-box"
      role="dialog"
      aria-label={`Conversation with ${npcName}`}
      aria-busy={pending}
      onKeyDown={handleKeyDown}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <header className="dialogue-header">
        <span className="dialogue-name">{npcName}</span>
        <button ref={closeRef} type="button" className="dialogue-close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="dialogue-log" ref={logRef}>
        {lines.map((line, index) =>
          line.speaker === "system" ? (
            <p key={index} className="dialogue-note" role="status">
              {line.text}
            </p>
          ) : (
            <p
              key={index}
              className={`dialogue-line dialogue-line-${line.speaker}`}
              data-source={line.source}
              data-method={line.method}
            >
              <strong>{line.speaker === "npc" ? npcName : "You"}:</strong>{" "}
              {line.source === "simulated" && <span className="dialogue-badge dialogue-badge-sim">SIMULATED</span>}
              {line.source === "ai" && <span className="dialogue-badge">AI</span>}
              {line.method === "voice" && (
                <span className="dialogue-badge dialogue-badge-voice" title="Entered by voice">
                  🎤
                </span>
              )}
              {line.text}
            </p>
          ),
        )}
        {pending && (
          <p className="dialogue-thinking" role="status" aria-live="polite">
            {npcName} is thinking…
          </p>
        )}
      </div>

      {!hideInput && (
        <form className="dialogue-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="dialogue-input"
            type="text"
            value={draft}
            readOnly={pending} // not disabled: the field keeps focus, so Escape still closes the dialogue
            onChange={(event) => setDraft(event.target.value)}
            placeholder={pending ? `Waiting for ${npcName}…` : "Type your reply and press Enter"}
            aria-label="Your reply"
            autoComplete="off"
          />
          <button type="submit" className="dialogue-send" disabled={!draft.trim() || pending}>
            Send
          </button>
        </form>
      )}

      {showVoice && (
        <div className="dialogue-voice">
          <VoiceInput npcId={npcId} onSubmit={submitVoice} disabled={pending} allowTyping={false} />
        </div>
      )}
    </div>
  );
}
