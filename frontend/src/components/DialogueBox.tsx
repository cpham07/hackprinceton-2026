import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { DialogueLine } from "../game/types/dialogue";

interface DialogueBoxProps {
  npcName: string;
  lines: DialogueLine[];
  /** Called with trimmed, nonempty text. */
  onSubmit: (text: string) => void;
  onClose: () => void;
  /** Read-only mode (inscriptions, finished conversations): no text field or Send button. */
  hideInput?: boolean;
}

export default function DialogueBox({ npcName, lines, onSubmit, onClose, hideInput = false }: DialogueBoxProps) {
  const [draft, setDraft] = useState("");
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

  useEffect(() => {
    const release = () => {
      ignoreRepeats.current = false;
    };
    window.addEventListener("keyup", release, true);
    return () => window.removeEventListener("keyup", release, true);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
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

  return (
    <div
      className="dialogue-box"
      role="dialog"
      aria-label={`Conversation with ${npcName}`}
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
        {lines.map((line, index) => (
          <p key={index} className={`dialogue-line dialogue-line-${line.speaker}`}>
            <strong>{line.speaker === "npc" ? npcName : "You"}:</strong> {line.text}
          </p>
        ))}
      </div>

      {!hideInput && (
      <form className="dialogue-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="dialogue-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type your reply and press Enter"
          aria-label="Your reply"
          autoComplete="off"
        />
        <button type="submit" className="dialogue-send" disabled={!draft.trim()}>
          Send
        </button>
      </form>
      )}
    </div>
  );
}
