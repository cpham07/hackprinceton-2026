# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

HackPrinceton 2026 hackathon project. There is no linter or test suite.

## Commands

- Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload` (port 8000, health check at `GET /health`)
- Frontend: `cd frontend && npm install && npm run dev` (port 5173). `npm run build` type-checks and builds. In dev only, `http://localhost:5173/?chapter=2` starts in the Chapter 2 hub with Chapter 1 already complete (`game/devShortcuts.ts`).

## Architecture

- `frontend/`: Vite + React 18 + TypeScript + Phaser 3. Game logic lives in Phaser (`src/game/`), UI in React (`src/components/`).
  - `App.tsx` owns the open dialogue session, the open puzzle, and the single `submitPlayerResponse(PlayerResponse)` handler (typed text now, voice transcriptions later).
  - `components/`: `GameCanvas` (creates/destroys the Phaser game), `DialogueBox` (`hideInput` gives a read-only mode), `SymbolPuzzle`, `QuestTracker` (Chapter 1 clues or Chapter 2 seals, by `state.chapter`), `ClueToast`, `ChapterComplete`. `hooks/useGameState.ts` subscribes React to the story state.
  - `game/EventBus.ts` is the only Phaser/React channel. Phaser to React: `dialogue:request`, `puzzle:request`, `scene:ready`. React to Phaser: `overlay:opened` / `overlay:closed` (one input lock for every blocking overlay; `App` emits them when "any overlay open" changes) and `scene:start` (scene change; keys are `SCENES` in `game/constants.ts`).
  - `game/scenes/GameplayScene.ts` is the base class for playable scenes: player, keys, `InteractionManager`, the overlay input lock, `scene:start` handling and shutdown cleanup. Scenes call `initGameplay()` in `create()`, `tickGameplay()` in `update()` and `addCleanup()` for their own subscriptions. `OlympusEntrance` (Chapter 1) and `OlympusHub` (Chapter 2; Athena's library is the enclosed far end of the same scene) extend it.
  - Chapter changes are explicit: the completion screen emits `scene:start`. Never switch scenes just because `state.chapter` changed.
  - `game/state/gameState.ts` is the authoritative story state (plain TS module with `getGameState`, `setFlag`, `subscribe`). Don't keep story state in the Phaser registry.
  - `game/input/keys.ts` creates gameplay keys and holds the explicit list of captured keys. The scene releases captures and disables the keyboard while dialogue is open. Use `consumePress` for one-shot actions, not `JustDown` (it misses taps shorter than a frame).
  - `entities/Player.ts`, `entities/Npc.ts`, `systems/InteractionManager.ts` are reusable across scenes.
  - `game/data/interactables.ts` defines every NPC and object the player can press E on, grouped per scene (position, display size, interaction radius, prompt text, optional glow, `kind: "puzzle"` to open a puzzle instead of a dialogue). `entities/Npc.ts` builds any of them.
  - Story progress only changes through `story/actions.ts` (`applyStoryActions` with `setFlag` / `addClue` / `completeQuest` / `grantSeal` / `setChapter`). Dialogue steps carry actions that apply when the line is shown, never just because a dialogue opened.
  - `story/chapter1.ts` and `story/chapter2.ts` hold each chapter's flags, data (clues, seals) and objective function; `story/chapter1Dialogue.ts` and `story/chapter2Dialogue.ts` pick each character's conversation from the current state, and `story/conversations.ts` is the lookup by interactable id.
  - `puzzles/sequencePuzzle.ts` (type, `isCorrectSequence`, `shuffledStart`) and `puzzles/wisdomPuzzle.ts` (symbols, solution, reward actions). Whether a puzzle is solved is read from game state, not kept in the component.
  - `dialogue/conversation.ts` is the scripted reply engine (`getReply`); `dialogue/phraseMatch.ts` is the deterministic phrase validator used for the incantation.
  - Scenes mirror story state via `subscribe()` + `applyStoryState()` (gate and library door art, barrier collision, sleeping gatekeeper, seal emblem). Don't copy story state into a scene.
  - `game/graphics/placeholders.ts` generates placeholder textures under fixed keys. Real art replaces them by loading images under the same keys; display sizes and collision boxes come from `PLAYER_CONFIG` and the NPC definitions, not from texture dimensions.
  - The player uses real art from `frontend/public/assets/characters/player/`, loaded by `Player.preload(scene)` in the scene's `preload()`. `PLAYER_ART` in `entities/Player.ts` holds the source-pixel measurements (feet line, collision box, source facing); `PLAYER_ANIMATIONS` maps idle/walk/jump to frame keys (all one image for now). The art faces left in the file, and `face()` moves the origin and body offset together when flipping so the collision box stays put.
  - In scene cleanup, only touch the keyboard on `SHUTDOWN`, never on `DESTROY` (the keyboard manager is already gone and throwing there leaves a second Phaser instance alive under StrictMode).
- `backend/`: FastAPI. `main.py` defines the app and routes (CORS allows the Vite dev origin), `speech.py` does speech-to-text (`transcribe`, still a stub) and `embeddings.py` does audio embeddings (`embed`, still a stub) plus cosine `similarity`. The frontend does not call the backend yet.
- `Test.py` at the root is a leftover placeholder.
