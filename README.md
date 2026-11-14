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

## Playing the Chapter 1 prototype

- Move: A/D or left/right arrows
- Jump: Space or up arrow
- Interact: walk up to a character or object and press E
- In the dialogue: type a reply and press Enter to send, Escape to close

Chapter 1 walkthrough: talk to Aphrodite, then Old Theron and Lyra up the road. Lyra teaches the incantation; say it to Argos the gatekeeper ("Somnus, let the heavens dream.") and walk through the open gate. The glowing statue is optional.

Conversations are scripted; replies do not interpret what you type, except the gatekeeper, who checks for the incantation.

Chapter 2 so far: on the completion screen choose "Continue to Olympus". Talk to Athena (far right of the hub), enter her library, press E at the pedestal and order the symbols to earn the Seal of Wisdom. The Ares and Hades paths are marked "Coming Soon".

For testing, `http://localhost:5173/?chapter=2` (dev server only) starts directly in Chapter 2.
