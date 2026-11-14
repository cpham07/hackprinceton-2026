# Speech S2: contextual NPC conversation foundation

Nothing here is wired into the game. All new code is under `frontend/src/services/npc/` plus `hooks/useNpcDialogue.ts`.

## Backend finding
`backend/main.py` only has `GET /health`; no dialogue route exists. The contract below is a **proposal** for the backend team
(like `/transcribe` from S1, treat it as provisional).

## Contract: `POST {VITE_API_BASE_URL}/npc/dialogue` (JSON)
Request (`NpcDialogueRequest`): `npcId`, `playerText`, `chapter`, `conversationHistory` (last 8 turns, `{speaker, text}`),
`storyContext` = `{ relevantFlags, clues, inventory, completedQuests, seals }`. `relevantFlags` contains only flag names the
caller whitelists (per NPC) and only those set to true; the full GameState is never sent. No audio, no user identity.

Response (`NpcDialogueResponse`): `{ "npcResponse": string, "proposedAction": null | {type, ...} }`.
Allowed proposal types: `setFlag{flag}`, `addClue{clue}`, `completeQuest{quest}`, `grantSeal{seal}`.
`setChapter` is deliberately not proposable. Responses are validated at runtime (`parseNpcDialogueResponse`) and unknown
fields are dropped. The key is never in the frontend; the browser only talks to our backend, which owns the LLM and secrets.

## Files
- `contract.ts`: types, `buildNpcDialogueRequest` (subset builder), `toStoryAction`
- `npcDialogueClient.ts`: `requestNpcReply` (timeout 30s, cancel, typed `NpcDialogueError`), `parseNpcDialogueResponse`
- `proposedAction.ts`: `validateProposedAction(proposed, npcId, state, policy)` returning `{ok, action}` or `{ok:false, reason}`.
  Pure; it checks the per-NPC allowlist, chapter, required flags/clues/quests and whether it was already granted.
  `DEFAULT_ACTION_POLICY` is empty, so nothing is accepted until the story team lists actions.
- `mockNpcDialogue.ts`: dev-only simulated replies (prefixed `[SIMULATED REPLY...]`, `source: "mock"`, never proposes actions).
  Includes a Hades sample: "Aphrodite told me Zeus was dangerous." Never used as a fallback for API failures.
- `personalities.ts`: extensible briefs for Aphrodite, Athena, Ares, Hades, Zeus (voice, knows, may reveal, secrets, rules).
  Draft; reconcile with the story scripts.
- `../hooks/useNpcDialogue.ts`: loading/error/cancel wrapper. Returns `null` on failure so the caller keeps the player unblocked.

## Integration after the branches merge
`getReply()` in `game/dialogue/conversation.ts` is synchronous and deterministic; keep it as the default and fallback.
In `App.tsx`'s `submitPlayerResponse` (typed and voice both arrive here):
1. Run `getReply` as today for scripted conversations (passphrase checks, readOnly) unless the interactable is marked AI-enabled.
2. For AI-enabled NPCs: `buildNpcDialogueRequest({npcId, playerText: response.text, state: getGameState(), history, relevantFlagNames})`,
   then `ask()` from `useNpcDialogue`. Show a "thinking" state; show `error` text and fall back to the scripted reply on `null`.
3. Show `reply.npcResponse` as the NPC line (label it if `reply.source === "mock"`).
4. `validateProposedAction(reply.proposedAction, npcId, getGameState(), policy)`; only if `ok`, call
   `applyStoryActions([verdict.action])`. Never apply `reply.proposedAction` directly.
5. Keep history in React session state only; don't persist it.
Note: deterministic gates (the Chapter 1 incantation, seal puzzles) should stay scripted.

## Tests
The project has no test runner. Behaviors were verified with a throwaway esbuild-bundled script (outside the repo) and
`npm run build`; adding vitest would be a dependency change, left to the team.
