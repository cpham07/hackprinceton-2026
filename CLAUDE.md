# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

HackPrinceton 2026 hackathon project. It is not a git repository yet, and there is no linter or test suite.

## Commands

- Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload` (port 8000, health check at `GET /health`)
- Frontend: `cd frontend && npm install && npm run dev` (port 5173). `npm run build` type-checks and builds.

## Architecture

- `frontend/`: Vite + React 18 + TypeScript + Phaser 3. Game logic lives in Phaser (`src/game/`), UI in React (`src/components/`).
  - `App.tsx` owns dialogue state and the single `submitPlayerResponse(PlayerResponse)` handler (typed text now, voice transcriptions later).
  - `components/GameCanvas.tsx` creates and destroys the Phaser game; `components/DialogueBox.tsx` is the dialogue overlay.
  - `game/EventBus.ts` is the only Phaser/React channel: `dialogue:request` (Phaser to React), `dialogue:opened` and `dialogue:closed` (React to Phaser).
  - `game/state/gameState.ts` is the authoritative story state (plain TS module with `getGameState`, `setFlag`, `subscribe`). Don't keep story state in the Phaser registry.
  - `game/input/keys.ts` creates gameplay keys and holds the explicit list of captured keys. The scene releases captures and disables the keyboard while dialogue is open. Use `consumePress` for one-shot actions, not `JustDown` (it misses taps shorter than a frame).
  - `game/scenes/OlympusEntrance.ts` is the Chapter 1 scene; `entities/Player.ts`, `entities/Npc.ts`, `systems/InteractionManager.ts` are reusable across scenes.
  - `game/data/npcs.ts` defines NPCs (position, display size, interaction radius, mock lines); `game/dialogue/mockDialogue.ts` returns scripted lines by turn.
  - `game/graphics/placeholders.ts` generates placeholder textures under fixed keys. Real art replaces them by loading images under the same keys; display sizes and collision boxes come from `PLAYER_CONFIG` and the NPC definitions, not from texture dimensions.
  - In scene cleanup, only touch the keyboard on `SHUTDOWN`, never on `DESTROY` (the keyboard manager is already gone and throwing there leaves a second Phaser instance alive under StrictMode).
- `backend/`: FastAPI. `main.py` defines the app and routes (CORS allows the Vite dev origin), `speech.py` does speech-to-text (`transcribe`, still a stub) and `embeddings.py` does audio embeddings (`embed`, still a stub) plus cosine `similarity`. The frontend does not call the backend yet.
- `Test.py` at the root is a leftover placeholder.
