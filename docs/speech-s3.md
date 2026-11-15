# Speech S3: voice and conversational AI in the playable game

S1 (voice input) and S2 (NPC dialogue client) are now wired into the real dialogue UI. Story progression is unchanged and
stays deterministic.

## What the player sees
- Every conversation that accepts a reply has the typed field (as before) and, under it, a microphone section:
  **Start recording → Stop recording → Transcribe → edit the transcript → Confirm & Send**. Nothing is sent until
  Confirm. Read-only dialogues (inscriptions, barred gates, a finished conversation) show no input and no voice controls.
- Typed replies reach `submitPlayerResponse` with `method: "text"`; confirmed voice replies with `method: "voice"`
  (shown with a 🎤 marker). There is no second dialogue engine: both go through the one handler in `App.tsx`.
- While an NPC reply is pending: "<NPC> is thinking…", the text field is read-only, Send and Confirm are disabled.
  The player can still press Escape or Close; that cancels the request.

## Where AI is used, and where it is not
`getReply()` (`game/dialogue/conversation.ts`) still decides every scripted step. A new `freeform` flag marks the one
case where the script has nothing left to say (its filler line). **Only then** may an AI-enabled character be answered by
the backend, and only characters listed in `game/dialogue/aiPolicy.ts` (`AI_ELIGIBLE_NPCS`: Hades and Zeus).

So all of these stay scripted and deterministic: the gatekeeper incantation, Athena's puzzle, Ares's course and
reward, Hades's three questions and Seal of Passage, Zeus's confrontation flag, the vault and all chapter transitions.
Hades and Zeus only reach the backend after those steps are done (their post-quest free conversation).

AI-proposed actions: every proposal is run through `validateProposedAction` against `AI_ACTION_POLICY`, which is
**empty**, so nothing is applied. In development a rejected proposal is shown as a `[dev]` note. To allow an action
later, add it to the policy for that character, with tests for that character and action.

## Modes (development panel, bottom-left, `import.meta.env.DEV` only)
- **Backend** (default, and the only mode in production): `POST /npc/dialogue`.
- **Simulated (DEV mock)**: `mockNpcReply`; labelled `[SIMULATED REPLY…]` with a SIMULATED badge. Selected explicitly.
- **Off**: scripted fallback only.
A failing backend is reported as a note ("Could not reach the conversation server… Showing the scripted reply instead")
followed by the game's own scripted line. It is **never** replaced by simulated text. The voice mock transcript
("Use sample transcript (DEV MOCK)") is also dev-only and labelled.

## Microphone safety
Recording starts only on the button. Stop is manual. Tracks are stopped on Stop, and when the dialogue closes (the recorder
unmounts), including mid-recording and mid-transcription (the upload is aborted). The dialogue input lock
(`overlay:opened`) is held for as long as the dialogue is open, so the player cannot move while recording, editing or
waiting for a reply. Escape closes the dialogue even if focus has left it.

## Backend dependencies (not implemented in this repo's backend)
`backend/main.py` currently has only `GET /health`; `backend/speech.py` is a stub. For real ASR/AI the backend team must add:
1. `POST /transcribe`: multipart field `audio` (`recording.webm` on Chrome/Firefox, `.m4a`/mp4 on Safari), responds `{ "text": "..." }`.
2. `POST /npc/dialogue`: JSON per `services/npc/contract.ts`; responds `{ "npcResponse": string, "proposedAction": null | {...} }`.
3. CORS for the dev origin(s) (`allow_origins` is currently only `http://localhost:5173`) and `Content-Type: application/json`
   preflight. Base URL is `VITE_API_BASE_URL` (default `http://localhost:8000`).
The LLM key and prompts belong to the backend only; the browser never holds a key.

## Testing done
Headless-Chrome suites against a throwaway **mock** backend (outside the repo) and a fake microphone, plus the earlier
Chapter 1 to 3 suites. Not tested: a real backend, real speech recognition, a real LLM, real microphones, Safari/Firefox.
