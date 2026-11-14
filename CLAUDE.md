# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

HackPrinceton 2026 hackathon project. It is not a git repository yet, and there is no linter or test suite.

## Commands

- Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload` (port 8000, health check at `GET /health`)
- Frontend: `cd frontend && npm install && npm run dev` (port 5173). `npm run build` type-checks and builds.

## Architecture

- `frontend/`: Vite + React + TypeScript. `src/App.tsx` is the root component, `src/components/` holds UI components and `src/game/` holds game logic.
- `backend/`: FastAPI. `main.py` defines the app and routes (CORS allows the Vite dev origin), `speech.py` does speech-to-text (`transcribe`, still a stub) and `embeddings.py` does audio embeddings (`embed`, still a stub) plus cosine `similarity`.
- `Test.py` at the root is a leftover placeholder.
