# Backend

FastAPI server for the Olympus adventure: **speech-to-text** and **contextual NPC dialogue**, both through an
OpenAI-compatible provider. The browser never sees an API key; it only talks to this server.

| Route | Purpose |
| --- | --- |
| `GET /health` | `{"status": "ok"}` |
| `POST /transcribe` | multipart field `audio` → `{"text": "..."}` |
| `POST /npc/dialogue` | JSON (see below) → `{"npcResponse": "...", "proposedAction": null}` |
| `GET /docs` | interactive API docs (OpenAPI at `/openapi.json`) |

## Run it

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then put your key in .env: OPENAI_API_KEY=...
uvicorn main:app --reload       # http://localhost:8000
```

Without a key the server still starts: `/health` works and the AI routes answer `503 ... not configured`. The game
stays playable with scripted dialogue. The frontend (`cd frontend && npm run dev`, port 5173) is already allowed by CORS.

Run the tests (no network, no paid calls: the provider is mocked):

```bash
pip install -r requirements-dev.txt
pytest
```

ASR evaluation (WER, mythology-name accuracy, latency, baseline vs vocabulary-hint prompt) lives in `ml/`, separate from
the server: see [`ml/README.md`](ml/README.md). Provider calls there need an explicit `--run`.

## Configuration (environment or `backend/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | *(none)* | **Required** for the AI routes. Never committed; `.env` is git-ignored. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint. |
| `TRANSCRIPTION_MODEL` | `whisper-1` | Speech model. |
| `NPC_DIALOGUE_MODEL` | `gpt-4o-mini` | Chat model. |
| `TRANSCRIPTION_API_KEY` / `_BASE_URL`, `NPC_DIALOGUE_API_KEY` / `_BASE_URL` | *(fall back to the above)* | Use a different provider per service. |
| `TRANSCRIPTION_LANGUAGE` | `en` | Language hint. Blank = auto-detect (can misjudge accented English). |
| `TRANSCRIPTION_PROMPT` | *(off)* | Optional vocabulary hint. Off by default: some models echo a prompt back as the transcript of silence. |
| `MAX_AUDIO_BYTES` | `10485760` | Upload limit (10 MB). |
| `TRANSCRIPTION_TIMEOUT_SECONDS` / `NPC_DIALOGUE_TIMEOUT_SECONDS` | `45` / `20` | Provider timeouts (kept under the frontend's 60 s / 30 s). |
| `NPC_DIALOGUE_MAX_TOKENS`, `NPC_DIALOGUE_TEMPERATURE` | `220`, `0.8` | Reply length and variety. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins. |

An unusable value (for example `MAX_AUDIO_BYTES=lots`) stops the server at startup with a clear message.

## `POST /transcribe`

Send the browser's `MediaRecorder` blob as multipart field **`audio`**. WebM/Opus (Chrome, Firefox), Ogg, MP4/M4A (Safari),
MP3 and WAV are accepted. The format is checked from the file's bytes, not only the declared type, and the provider is
told the detected format, so no conversion step (ffmpeg) is needed: the hosted API reads these containers directly.
The whole recording is transcribed as one utterance: there is no silence trimming or fluency scoring.

| Status | Meaning |
| --- | --- |
| 200 | `{"text": "..."}`; `""` if no speech was recognized |
| 400 | empty or too-short recording |
| 413 | larger than `MAX_AUDIO_BYTES` (checked from `Content-Length` before the body is read) |
| 415 | not a supported audio format |
| 422 | the `audio` field is missing |
| 502 / 503 / 504 | provider failed or sent a bad response / not configured or rate-limited / timed out |

Nothing is faked: a failed transcription is an error, never made-up text.

## `POST /npc/dialogue`

Matches `frontend/src/services/npc/contract.ts` exactly:

```json
{ "npcId": "hades", "playerText": "Aphrodite said Zeus was dangerous.", "chapter": 2,
  "conversationHistory": [{ "speaker": "npc", "text": "Why do you seek my brother's lightning bolt?" }],
  "storyContext": { "relevantFlags": {}, "clues": [], "inventory": [], "completedQuests": [],
                    "seals": { "athena": true, "ares": true, "hades": false } } }
```

Response: `{ "npcResponse": "...", "proposedAction": null }`. **`proposedAction` is always `null`**: this server produces
dialogue only. The game's scripted story actions alone grant seals, items, flags and chapter progress.

Characters (explicit allowlist in `npc_personas.py`): `aphrodite`, `athena`, `ares`, `hades`, `zeus`, `theron`, `lyra`,
`gatekeeper`. Any other id gets a `422` with a clear message: unknown ids, and the game's non-characters (statues, doors,
levers, puzzle pedestals, the scripted-only palace guards). A test checks this list against the frontend's
`game/data/interactables.ts`, so the two cannot drift silently.

Errors: `422` invalid request or id, `502` provider failure or a reply the story rules rejected, `503` not configured or
rate-limited, `504` timeout. Error bodies are `{"detail": "..."}` and never contain keys, provider output or stack traces.

### How the story is protected

- **By omission.** `story_knowledge.py` gives every fact an unlock rule (chapter, clues, items, seals, flags). The model
  is sent only the facts that are unlocked. A locked secret (Aphrodite's betrayal, the tracking necklace, the incantation's
  exact words) is *not in the prompt at all*; only a generic "OFF LIMITS" label is. So it cannot leak what it never saw.
- **Progress is not invented.** "What the mortal has done" is rendered only from known ids in the request (`completedQuests`,
  `clues`, `inventory`, `seals`, whitelisted flags). Unknown strings are ignored.
- **Untrusted input.** Player text, history and context are sanitised, delimited in `<transcript>` / `<player_message>`, and
  the model is told they are never instructions. History is capped at the last 8 turns.
- **Output filter.** Replies mentioning a locked fact, never-say content (a puzzle solution, Aphrodite confessing), or the
  prompt itself are retried once with a reminder, then rejected (`502`). It is a safety net; the real control is the first bullet.
- **No tools.** No function calling, no actions, no state. Nothing is stored between requests.

To add a character, add a `Persona` in `npc_personas.py` and its `Fact`s in `story_knowledge.py`, then add tests.
The betrayal and necklace facts unlock in Chapter 4 only once the game sends the `betrayalRevealed` flag (the betrayal happens mid-chapter), and unconditionally from Chapter 5.

## Privacy

Audio is held in memory for the request only and is never written to disk or kept. Neither audio, transcripts, player
text nor replies are logged (only sizes, formats, models, status codes and timings). No conversation history is stored.

## Try it with curl

```bash
curl localhost:8000/health
curl -F "audio=@recording.webm;type=audio/webm" localhost:8000/transcribe
curl -X POST localhost:8000/npc/dialogue -H 'content-type: application/json' -d '{
  "npcId":"hades","playerText":"Aphrodite said Zeus was dangerous.","chapter":2,"conversationHistory":[],
  "storyContext":{"relevantFlags":{},"clues":[],"inventory":[],"completedQuests":[],"seals":{"athena":false,"ares":false,"hades":false}}}'
```

## Known limitations

- Tests mock the provider. Real-model behavior (accuracy, in-character quality, how well the model obeys the rules) needs
  a key and a human to judge.
- `max_tokens` is sent as in the classic chat API; a provider that only accepts `max_completion_tokens` needs a small change in `npc_dialogue.py`.
- Whisper-style models can return filler text ("Thank you.") for silence; the server does not second-guess the provider.
- Unexpected (500) errors are returned by Starlette outside the CORS layer, so a browser sees them as a network error.
- Starlette's `TestClient` prints a deprecation notice about `httpx2`; it is filtered in `pytest.ini`.
- No rate limiting or authentication (out of scope for B1).
