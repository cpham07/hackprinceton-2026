import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import VoiceInput from "../components/voice/VoiceInput";
import type { PlayerResponse } from "../game/types/dialogue";

/** Standalone harness: run `npm run dev` and open /voice-demo.html. Not part of the game. */
function Demo() {
  const [log, setLog] = useState<PlayerResponse[]>([]);
  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui", background: "#222", color: "#eee", minHeight: "90vh" }}>
      <h1 style={{ fontSize: 20 }}>Voice input demo</h1>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        Transcription posts to the backend /transcribe (assumed route). If it isn't there, the failure is shown, not faked.
      </p>
      <VoiceInput npcId="demo-npc" onSubmit={(response) => setLog((prev) => [...prev, response])} />
      <h2 style={{ fontSize: 16, marginTop: 24 }}>Submitted PlayerResponse objects</h2>
      <pre data-testid="log">{JSON.stringify(log, null, 2)}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
