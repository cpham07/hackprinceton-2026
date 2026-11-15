import { useCallback, useState } from "react";
import type { AiMode } from "../game/dialogue/aiPolicy";
import { DEFAULT_NPC_DIALOGUE_CONFIG } from "../services/npc/npcDialogueClient";

interface DevToolsPanelProps {
  mode: AiMode;
  onModeChange: (mode: AiMode) => void;
}

type Health = "unchecked" | "checking" | "online" | "offline";

/**
 * DEVELOPMENT ONLY (rendered only when import.meta.env.DEV). Chooses how free conversation with
 * AI-enabled characters is answered. A failing backend is never swapped for the simulated mode:
 * the simulated mode exists only when someone selects it here.
 */
export default function DevToolsPanel({ mode, onModeChange }: DevToolsPanelProps) {
  // Checked only when asked: an unreachable backend logs a network error, which would spam every page load.
  const [health, setHealth] = useState<Health>("unchecked");

  const check = useCallback(() => {
    const controller = new AbortController();
    setHealth("checking");
    void fetch(`${DEFAULT_NPC_DIALOGUE_CONFIG.baseUrl.replace(/\/+$/, "")}/health`, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setHealth(response.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealth("offline");
      });
  }, []);

  const options: Array<[AiMode, string]> = [
    ["backend", "Backend"],
    ["mock", "Simulated (DEV mock)"],
    ["off", "Off (scripted only)"],
  ];

  return (
    <aside className="dev-tools" aria-label="Development tools">
      <div className="dev-tools-title">DEV TOOLS</div>
      <fieldset className="dev-tools-modes">
        <legend>Free conversation (Hades, Zeus)</legend>
        {options.map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="npc-ai-mode"
              value={value}
              checked={mode === value}
              onChange={(event) => {
                onModeChange(value);
                event.target.blur(); // keep the keyboard with the game
              }}
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>
      <div className="dev-tools-health" data-health={health}>
        Backend /health: {health}{" "}
        <button type="button" onClick={check}>
          check
        </button>
      </div>
    </aside>
  );
}
