# HackPrinceton 2026

A 2D adventure through Greek myth that you play by **talking**. You are an axolotl climbing to Olympus, and you move the
story forward by speaking with gods and mortals. It is built for people with speech impediments, to practise speaking
somewhere low-pressure and encouraging:

- **No time pressure:** recording stops only when you press Stop. There is no auto-stop on silence and no fluency scoring.
- **You stay in control:** you can edit what speech recognition heard before you send it. Typing works everywhere too.
- **Nothing depends on speaking perfectly:** puzzles and story steps are scripted. The AI characters chat, but they
  cannot lock you out.
- **Private:** recordings and transcripts are never stored or logged.

## Built with

TypeScript, React, Phaser 3, Vite, Vitest · Python, FastAPI, Uvicorn, HTTPX, pytest · OpenAI Whisper, GPT-4o mini ·
SVG (hand-drawn art) · optional: PyTorch, Hugging Face Transformers, PEFT/LoRA (`backend/ml/`)

## Running it

**Backend** (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then set OPENAI_API_KEY=... in backend/.env
uvicorn main:app --reload
```

Without a key the game is still fully playable with typed, scripted dialogue. Voice input, the AI characters and the
Speaking Companion's tips need the key. `.env` is git-ignored; never commit it.

**Frontend** (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

**Tests** (no network, no paid calls):

```bash
cd backend && pip install -r requirements-dev.txt && pytest
cd frontend && npm test && npm run build
```

## How it works

| Feature | Where | What it does |
| --- | --- | --- |
| Voice input | `POST /transcribe` (Whisper) | Record, stop, review and edit the transcript, then send. A mythology vocabulary hint helps with names like Somnus and Hades. |
| AI characters | `POST /npc/dialogue` (GPT-4o mini) | After their scripted lines, Hades and Zeus (and Aphrodite in Chapter 5) answer freely and in character. They only know facts the player has unlocked and cannot change the story. |
| Speaking Companion | `POST /speaking/feedback` (GPT-4o mini) | An optional coach (🗣 button): one thing you did well and one gentle tip per voice reply, shaped by goals you choose. |

The **Speaking Companion** never comments on pronunciation, accent, stuttering, fluency or disability, and never gives
scores. Every answer is checked in code before it is shown. Pacing (approximate words per minute, "slower is not wrong")
is measured in the browser from the real recording time and is never sent to the AI. Only your goals and practice totals
are saved, in this browser. Details: [backend/README.md](backend/README.md).

## Playing

- **Move:** A/D or the arrow keys. **Jump:** Space or up arrow. **Interact:** walk up to someone or something and press E.
- **Talk:** type and press Enter, or use the microphone controls under the text box. Escape closes a conversation.

1. **Welcome to Olympus.** Talk to Aphrodite, then Old Theron and Lyra along the meadow path. Lyra teaches the
   incantation. Say it to Argos the gatekeeper ("Somnus, let the heavens dream.") and walk through the gate.
2. **The Secrets of the Gods.** Earn three seals in any order: order the symbols in Athena's library (Wisdom), get past the
   hammers in Ares's arena (Courage), and answer Hades's three questions (Passage). Then open Zeus's palace gates.
3. **The Forbidden Vault.** Move the two statues onto their plates, show the guards your Seal of Courage, open the vault
   with the three seals, take the Master Lightning Bolt, answer Zeus and leave.
4. **The Betrayal.** On the palace steps, talk to Aphrodite. Argue as much as you like: the story moves when you press
   "Hand over the Master Lightning Bolt", or after three replies. Then talk to Athena to break the necklace's hold.
5. **Guardian of Olympus.** Break Aphrodite's enchantments in the order on the plaque (I Vanity, II Jealousy, III Desire),
   talk to her in the throne room, take the bolt, free Zeus, return it and tell him why mortals deserve another chance.

**Dev shortcuts** (dev server only): `?chapter=2` to `?chapter=5` start at that chapter; add `&seals=all` to start with
every seal. The dev panel (bottom left) can switch the AI characters to a labelled simulated mode or turn them off.

## Project layout

```
frontend/                 Vite + React + TypeScript + Phaser 3
  src/App.tsx             open dialogue, puzzles, and the one handler for typed and spoken replies
  src/game/               scenes, story state, chapters, puzzles, art loading
  src/components/         dialogue box, voice input, Speaking Companion, quest tracker, overlays
  public/assets/          paintings (backgrounds/), gods (characters/npcs/), mortals, buildings, props
backend/                  Python FastAPI
  main.py                 the app and routes
  speech.py               POST /transcribe
  npc_dialogue.py         POST /npc/dialogue (+ npc_personas.py, story_knowledge.py)
  speaking_feedback.py    POST /speaking/feedback
  ml/                     offline tools (see below), never imported by the server
docs/                     design notes for the speech features
```

**Art:** the scene backgrounds are paintings; the gods, townspeople, buildings, ruins and Ares's arena are hand-authored
SVGs in the same style. They load under the placeholder texture names, so a missing file falls back to a simple
generated placeholder instead of breaking the game.

## Experimental: speech recognition tuned to one speaker

`backend/ml/` is an offline pipeline, not used by the live game. It benchmarks Whisper's accuracy on your own consented
recordings, runs a local pinned Whisper, and trains a lightweight LoRA adapter on one person's speech, so recognition can
improve for voices general models handle poorly. Its heavy dependencies are optional:

```bash
cd backend && pip install -r requirements-ml.txt
```

See [backend/ml/README.md](backend/ml/README.md). Recordings, results and checkpoints are git-ignored; never commit them.
