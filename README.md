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
