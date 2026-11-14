# Speech S1: voice input foundation

## Files
- `frontend/src/services/transcriptionClient.ts`: `transcribeAudio`, MIME/extension helpers, `TranscriptionError`
- `frontend/src/hooks/useVoiceRecorder.ts`: MediaRecorder state machine (manual start/stop, track cleanup)
- `frontend/src/components/voice/VoiceRecorder.tsx`: record/stop UI only
- `frontend/src/components/voice/VoiceInput.tsx`: full flow, emits `PlayerResponse`
- `frontend/voice-demo.html` + `src/voice-demo/main.tsx`: dev harness at `http://localhost:5173/voice-demo.html`

## Backend contract (assumed; no transcription route exists yet)
`POST {VITE_API_BASE_URL or http://localhost:8000}/transcribe`, multipart field `audio`
(filename `recording.<ext>` matching MIME), response `{ "text": "..." }`.
Path, field names and timeout (60s) are overridable via `transcriptionConfig`.
Audio is webm/opus on Chrome/Firefox, mp4 on Safari; the backend must decode these.

## Integration later (not done here)
1. `DialogueBox.tsx`: add optional prop `onSubmitResponse?: (r: PlayerResponse) => void` (or `npcId`) and, when not `hideInput`,
   render `<VoiceInput npcId={npcId} onSubmit={onSubmitResponse} />` under the text form (typed input stays).
2. `App.tsx`: pass `onSubmitResponse={submitPlayerResponse}` (and `npcId={session.npcId}`) to `DialogueBox`.
3. Mic recording stops on unmount, so closing the dialogue releases the mic. `VoiceInput` stops key propagation (except Escape)
   so typing never reaches Phaser.
No changes to scenes, story or backend are needed.

## Mock transcript
"Use sample transcript (DEV MOCK)" is rendered only when `import.meta.env.DEV`; it is labeled in the editor and
produces the same `PlayerResponse` (`method: "voice"`). API failures show an error and are never replaced by fake text.
Text typed from scratch via "Type instead" is emitted as `method: "text"`.

## Privacy / accessibility
No fluency scoring, no silence auto-stop, no persistence of audio or transcripts (component state only; blob URL revoked).

## Future NPC conversation API (proposal, not implemented)
`POST /npc/respond`
```json
{ "npcId": "athena", "text": "confirmed player text", "chapter": 2,
  "flags": { "relevantFlag": true },
  "history": [ { "speaker": "npc", "text": "..." }, { "speaker": "player", "text": "..." } ] }
```
Response:
```json
{ "text": "NPC reply", "proposedAction": { "type": "setFlag", "flag": "..." } }
```
`proposedAction` is optional and only a proposal: the frontend must validate it through `story/actions.ts` / quest rules
and ignore anything the current state doesn't allow.
