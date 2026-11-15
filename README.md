# HackPrinceton 2026

A TypeScript + React frontend backed by a Python FastAPI server that handles speech recognition and audio similarity.

## Layout

```
frontend/   React + TypeScript (Vite)
  src/App.tsx
  src/components/
  src/game/
backend/    Python
  main.py         FastAPI server
  speech.py       Speech recognition
  embeddings.py   Audio similarity
```

## Running

Backend (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

Tests: `cd frontend && npm test` (unit tests, Vitest) and `cd backend && pytest` (no network, no paid calls).

## Speaking Companion

An optional coach for players practising spoken English. On the first visit a small window asks for goals (Improve my
English, Express my ideas clearly, Improve my pacing, Practice speaking clearly); you can skip it. The 🗣 button in the
top-right corner opens the panel, where you can change goals, show or hide detailed tips, reset your practice totals, or
turn the companion off.

After each **voice** reply you confirm, the panel shows:
- **Measured:** the number of words in your confirmed reply, the real recording time, an approximate words-per-minute
  figure (approximate because the recording includes pauses; slower is not wrong), your voice-reply count and total
  speaking time. If the recording time is not available it says so instead of guessing.
- **From an AI coach (backend, `POST /speaking/feedback`):** one thing you did well and one suggestion, based only on the
  words you confirmed, with optional details (a rephrasing, useful words, whether you answered the question and gave a
  reason). It never judges pronunciation, accent or fluency and never gives scores.

The tip is fetched in the background: the conversation never waits for it, and it never affects the story. Typed replies
work everywhere and are never analysed. This browser stores only your goals, panel preferences and practice totals;
recordings and transcripts are not kept.

## Playing the Chapter 1 prototype

- Move: A/D or left/right arrows
- Jump: Space or up arrow
- Interact: walk up to a character or object and press E
- In the dialogue: type a reply and press Enter to send, Escape to close

Chapter 1 walkthrough: talk to Aphrodite, then Old Theron and Lyra up the road. Lyra teaches the incantation; say it to Argos the gatekeeper ("Somnus, let the heavens dream.") and walk through the open gate. The glowing statue is optional.

Conversations are scripted; replies do not interpret what you type, except the gatekeeper, who checks for the incantation.

Chapter 2 so far: on the completion screen choose "Continue to Olympus". Talk to Athena (far right of the hub), enter her library, press E at the pedestal and order the symbols to earn the Seal of Wisdom. Talk to Ares (next to the red arena gate) to open his training arena: get past three moving hammers to the finish line to earn the Seal of Courage. The seals can be earned in either order. Descend through the dark arch to Hades's chamber and answer his three questions to earn the Seal of Passage. With all three seals, the gates of Zeus's palace (left of the fountain) unlock; press E there to finish Chapter 2. Chapter 3 is not playable yet.

Chapter 3: after Chapter 2, choose "Continue to Zeus's Palace". Move the two statues onto their plates (E cycles a statue, the lever resets them), show the guards Ares's warrior badge (your Seal of Courage), open the vault with the three seals, take the Master Lightning Bolt, answer Zeus, and leave through the palace gate. Chapter 4 is not playable yet.

For testing, `http://localhost:5173/?chapter=2` (dev server only) starts directly in Chapter 2; add `&seals=all` to start with every seal. `?chapter=3` starts inside Zeus's palace, `?chapter=4` starts Chapter 4.

Chapter 4: after Chapter 3, choose "Continue". Outside Zeus's palace, talk to Aphrodite. You can argue (typed or spoken), but the story only moves when you press "Hand over the Master Lightning Bolt", or when she loses patience after three replies and takes it. Then Aphrodite reveals her betrayal, imprisons Zeus and leaves; talk to Athena (she and Ares arrive beside you) to break the necklace's hold.

Chapter 5 (the final chapter): after Chapter 4, choose "Continue". Talk to Athena, then break Aphrodite's three enchantments in the order on the plaque (I Vanity, II Jealousy, III Desire; out of turn they reset). In the throne room, talk to Aphrodite; she answers what you say (using the AI backend when it is running), and after you have spoken three times she sets the bolt down. Take it, strike Zeus's cage with it (E), give it back to him, and tell him why mortals deserve another chance. The ending offers "Play again from the beginning". `?chapter=5` (dev server only) starts this chapter.
