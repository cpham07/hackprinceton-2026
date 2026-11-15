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

Chapter 2 so far: on the completion screen choose "Continue to Olympus". Talk to Athena (far right of the hub), enter her library, press E at the pedestal and order the symbols to earn the Seal of Wisdom. Talk to Ares (next to the red arena gate) to open his training arena: get past three moving hammers to the finish line to earn the Seal of Courage. The seals can be earned in either order. Descend through the dark arch to Hades's chamber and answer his three questions to earn the Seal of Passage. With all three seals, the gates of Zeus's palace (left of the fountain) unlock; press E there to finish Chapter 2. Chapter 3 is not playable yet.

Chapter 3: after Chapter 2, choose "Continue to Zeus's Palace". Move the two statues onto their plates (E cycles a statue, the lever resets them), show the guards Ares's warrior badge (your Seal of Courage), open the vault with the three seals, take the Master Lightning Bolt, answer Zeus, and leave through the palace gate. Chapter 4 is not playable yet.

For testing, `http://localhost:5173/?chapter=2` (dev server only) starts directly in Chapter 2; add `&seals=all` to start with every seal. `?chapter=3` starts inside Zeus's palace, `?chapter=4` starts Chapter 4.

Chapter 4: after Chapter 3, choose "Continue". Outside Zeus's palace, talk to Aphrodite. You can argue (typed or spoken), but the story only moves when you press "Hand over the Master Lightning Bolt", or when she loses patience after three replies and takes it. Then Aphrodite reveals her betrayal, imprisons Zeus and leaves; talk to Athena (she and Ares arrive beside you) to break the necklace's hold. Chapter 5 is not playable yet.
