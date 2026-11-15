import { useCallback, useEffect, useRef, useState } from "react";
import ChallengeComplete from "./components/ChallengeComplete";
import ChapterComplete from "./components/ChapterComplete";
import ClueToast from "./components/ClueToast";
import SealToast from "./components/SealToast";
import DevToolsPanel from "./components/DevToolsPanel";
import DialogueBox from "./components/DialogueBox";
import GameCanvas from "./components/GameCanvas";
import QuestTracker from "./components/QuestTracker";
import SymbolPuzzle from "./components/SymbolPuzzle";
import { SCENES, type SceneKey } from "./game/constants";
import { EventBus } from "./game/EventBus";
import { INTERACTABLES } from "./game/data/interactables";
import { AI_ACTION_POLICY, AI_ELIGIBLE_NPCS, isAiEligible, type AiMode } from "./game/dialogue/aiPolicy";
import { getReply, type Conversation } from "./game/dialogue/conversation";
import { isCorrectSequence, shuffledStart } from "./game/puzzles/sequencePuzzle";
import { PUZZLES } from "./game/puzzles/wisdomPuzzle";
import { getGameState } from "./game/state/gameState";
import { applyStoryActions } from "./game/story/actions";
import { FLAGS } from "./game/story/chapter1";
import { CH2_FLAGS, CHALLENGES } from "./game/story/chapter2";
import { CH3_FLAGS } from "./game/story/chapter3";
import { CH4_FLAGS } from "./game/story/chapter4";
import { getConversation } from "./game/story/conversations";
import type { DialogueLine, InputMethod, PlayerResponse } from "./game/types/dialogue";
import { useCompletionScreen } from "./hooks/useCompletionScreen";
import { useGameState } from "./hooks/useGameState";
import { useNpcDialogue } from "./hooks/useNpcDialogue";
import { buildNpcDialogueRequest, type ConversationTurn } from "./services/npc/contract";
import { validateProposedAction } from "./services/npc/proposedAction";

interface DialogueSession {
  /** Unique per opened dialogue. A reply that arrives for an older session is ignored. */
  id: number;
  npcId: string;
  conversation: Conversation;
  lines: DialogueLine[];
  /** Number of player replies so far in this conversation. */
  repliesGiven: number;
  /** Nothing further to answer; the input is hidden. */
  ended: boolean;
  /** An NPC reply is being fetched: further submissions are blocked until it arrives. */
  pending: boolean;
}

let nextSessionId = 1;

export default function App() {
  const [session, setSessionState] = useState<DialogueSession | null>(null);
  // Mirror of `session` for event handlers, so story actions run in handlers, not in state updaters.
  const sessionRef = useRef<DialogueSession | null>(null);
  const setSession = useCallback((next: DialogueSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  // How free conversation with AI-enabled characters is answered. Development builds can pick the
  // simulated mode in the dev panel; production always uses the backend, and a failing backend is
  // reported, never swapped for simulated replies.
  const [aiMode, setAiMode] = useState<AiMode>("backend");
  const aiModeRef = useRef(aiMode);
  aiModeRef.current = aiMode;
  const npcAi = useNpcDialogue({ useMock: aiMode === "mock" });
  const askRef = useRef(npcAi.ask);
  askRef.current = npcAi.ask;
  const cancelNpcRequest = npcAi.cancel;

  // The open puzzle, and each puzzle's current arrangement (kept while the page lives,
  // so closing a puzzle does not lose progress). Whether it is solved comes from the game state.
  const [openPuzzleId, setOpenPuzzleState] = useState<string | null>(null);
  const openPuzzleRef = useRef<string | null>(null);
  const setOpenPuzzle = useCallback((next: string | null) => {
    openPuzzleRef.current = next;
    setOpenPuzzleState(next);
  }, []);
  const [puzzleOrders, setPuzzleOrders] = useState<Record<string, string[]>>({});

  // A just-finished challenge whose success overlay is showing.
  const [completedChallenge, setCompletedChallenge] = useState<string | null>(null);
  useEffect(
    () =>
      EventBus.on("challenge:complete", ({ challengeId }) => {
        if (CHALLENGES[challengeId]) setCompletedChallenge(challengeId);
      }),
    [],
  );

  // Which Phaser scene is running. Scenes announce themselves when they are ready.
  const [activeScene, setActiveScene] = useState<SceneKey | null>(null);
  useEffect(() => EventBus.on("scene:ready", ({ key }) => setActiveScene(key)), []);

  const gameState = useGameState();
  // The Chapter 1 screen stays until the player explicitly continues (which changes the scene).
  const showChapter1Complete =
    gameState.flags[FLAGS.chapter1Complete] === true && activeScene === SCENES.entrance;
  // The Chapter 2 screen opens when Chapter 2 is completed in the hub, until the player continues into the palace.
  const [showChapter2Complete, closeChapter2Complete] = useCompletionScreen(
    gameState.flags[CH2_FLAGS.chapter2Complete] === true,
    SCENES.hub,
    activeScene,
  );
  // The Chapter 3 screen opens when Chapter 3 is completed in the palace, until the Chapter 4 placeholder is closed.
  const [showChapter3Complete, closeChapter3Complete] = useCompletionScreen(
    gameState.flags[CH3_FLAGS.chapter3Complete] === true,
    SCENES.palace,
    activeScene,
  );
  // The Chapter 4 screen opens when Chapter 4 is completed, until the Chapter 5 placeholder is closed.
  const [showChapter4Complete, closeChapter4Complete] = useCompletionScreen(
    gameState.flags[CH4_FLAGS.chapter4Complete] === true,
    SCENES.betrayal,
    activeScene,
  );
  const showChapterComplete = showChapter1Complete || showChapter2Complete || showChapter3Complete || showChapter4Complete;

  // Phaser asks for a dialogue; React decides whether to open one.
  useEffect(() => {
    return EventBus.on("dialogue:request", ({ npcId }) => {
      if (sessionRef.current || openPuzzleRef.current || !INTERACTABLES[npcId]) return;
      const conversation = getConversation(npcId, getGameState());
      if (!conversation) return;
      // The opening line is shown now, so its story actions apply now.
      applyStoryActions(conversation.opening.actions);
      cancelNpcRequest(); // nothing from an earlier conversation may land in this one
      setSession({
        id: nextSessionId++,
        npcId,
        conversation,
        lines: [{ speaker: "npc", text: conversation.opening.text, source: "scripted" }],
        repliesGiven: 0,
        ended: conversation.readOnly === true,
        pending: false,
      });
    });
  }, [setSession, cancelNpcRequest]);

  // Phaser asks for a puzzle.
  useEffect(() => {
    return EventBus.on("puzzle:request", ({ puzzleId }) => {
      const puzzle = PUZZLES[puzzleId];
      if (!puzzle || sessionRef.current || openPuzzleRef.current) return;
      setPuzzleOrders((orders) => (orders[puzzleId] ? orders : { ...orders, [puzzleId]: shuffledStart(puzzle) }));
      setOpenPuzzle(puzzleId);
    });
  }, [setOpenPuzzle]);

  // One input lock for every gameplay-blocking overlay. It is keyed on "is anything open",
  // so one overlay replacing another never unlocks the game in between.
  const overlayOpen =
    session !== null ||
    openPuzzleId !== null ||
    completedChallenge !== null ||
    showChapter2Complete ||
    showChapter3Complete ||
    showChapter4Complete;
  useEffect(() => {
    if (!overlayOpen) return;
    EventBus.emit("overlay:opened", { id: "app-overlay" });
    return () => EventBus.emit("overlay:closed", { id: "app-overlay" });
  }, [overlayOpen]);

  /**
   * Free conversation: the script has nothing left to say, so an AI-enabled character may be answered
   * by the conversation backend. Reached only through submitPlayerResponse, and never for a scripted step,
   * so story actions never depend on generated text.
   */
  const askNpc = useCallback(
    async (current: DialogueSession, method: InputMethod, text: string, scriptedFallback: string) => {
      const history: ConversationTurn[] = current.lines.flatMap((line) =>
        line.speaker === "system" ? [] : [{ speaker: line.speaker, text: line.text }],
      );
      setSession({
        ...current,
        pending: true,
        lines: [...current.lines, { speaker: "player", text, method }],
      });

      const request = buildNpcDialogueRequest({
        npcId: current.npcId,
        playerText: text,
        state: getGameState(),
        history,
        relevantFlagNames: AI_ELIGIBLE_NPCS[current.npcId].relevantFlags,
      });
      const result = await askRef.current(request);

      // The dialogue may have been closed (and even reopened) while waiting: drop outdated replies.
      const latest = sessionRef.current;
      if (!latest || latest.id !== current.id) return;
      if (result.kind === "cancelled") {
        setSession({ ...latest, pending: false });
        return;
      }

      const lines = [...latest.lines];
      if (result.kind === "reply") {
        const { reply } = result;
        lines.push({ speaker: "npc", text: reply.npcResponse, source: reply.source === "mock" ? "simulated" : "ai" });
        // A reply may only suggest an action. It is applied only if the (default-empty) policy allows it.
        const verdict = validateProposedAction(reply.proposedAction, current.npcId, getGameState(), AI_ACTION_POLICY);
        if (verdict.ok) applyStoryActions([verdict.action]);
        else if (reply.proposedAction && import.meta.env.DEV) {
          lines.push({
            speaker: "system",
            text: `[dev] The reply proposed "${JSON.stringify(reply.proposedAction)}" but it was not applied: ${verdict.reason}`,
          });
        }
      } else {
        // A real failure is shown as such, then the game's own scripted line stands in. Never a simulated reply.
        lines.push({ speaker: "system", text: `${result.message} Showing the scripted reply instead.` });
        lines.push({ speaker: "npc", text: scriptedFallback, source: "scripted" });
      }
      setSession({ ...latest, pending: false, repliesGiven: latest.repliesGiven + 1, lines });
    },
    [setSession],
  );

  /**
   * The single entry point for player replies: typed text arrives with method "text", confirmed
   * voice transcripts with method "voice". Scripted steps, which carry the story actions, are
   * always decided here by getReply; only the free-conversation tail may go to the backend.
   */
  const submitPlayerResponse = useCallback(
    (response: PlayerResponse) => {
      const current = sessionRef.current;
      const text = response.text.trim();
      if (!current || current.ended || current.pending || current.npcId !== response.npcId || !text) return;

      const reply = getReply(current.conversation, current.repliesGiven, { ...response, text });

      if (reply.freeform && isAiEligible(current.npcId) && aiModeRef.current !== "off") {
        void askNpc(current, response.method, text, reply.step.text);
        return;
      }

      // The reply is revealed by this update, so its story actions apply with it.
      applyStoryActions(reply.step.actions);
      setSession({
        ...current,
        repliesGiven: current.repliesGiven + 1,
        ended: reply.ended,
        lines: [
          ...current.lines,
          { speaker: "player", text, method: response.method },
          { speaker: "npc", text: reply.step.text, source: "scripted" },
        ],
      });
    },
    [setSession, askNpc],
  );

  /**
   * The conversation's explicit action (e.g. handing over the bolt). Deterministic: the player chose it,
   * nothing was inferred from text. Its line is shown, its story actions apply, and the conversation ends.
   */
  const chooseDialogueOption = useCallback(() => {
    const current = sessionRef.current;
    const choice = current?.conversation.choice;
    if (!current || !choice || current.ended || current.pending) return;
    applyStoryActions(choice.step.actions);
    setSession({
      ...current,
      ended: true,
      lines: [
        ...current.lines,
        { speaker: "player", text: choice.playerLine },
        { speaker: "npc", text: choice.step.text, source: "scripted" },
      ],
    });
  }, [setSession]);

  /** Closing the dialogue cancels any reply in flight; the recorder releases the microphone as it unmounts. */
  const closeDialogue = useCallback(() => {
    cancelNpcRequest();
    setSession(null);
  }, [setSession, cancelNpcRequest]);

  /** Checks a puzzle arrangement and applies its reward. Rewards are idempotent story actions. */
  const submitPuzzle = useCallback((puzzleId: string, order: string[]): boolean => {
    const puzzle = PUZZLES[puzzleId];
    if (!puzzle || !isCorrectSequence(puzzle, order)) return false;
    applyStoryActions(puzzle.rewardActions);
    return true;
  }, []);

  const continueToOlympus = useCallback(() => EventBus.emit("scene:start", { key: SCENES.hub }), []);

  const continueToPalace = useCallback(() => {
    EventBus.emit("scene:start", { key: SCENES.palace }); // refused by the scene unless the seals are held
    closeChapter2Complete();
  }, [closeChapter2Complete]);

  const continueToChapter4 = useCallback(() => {
    EventBus.emit("scene:start", { key: SCENES.betrayal }); // refused by the scene unless Chapter 3 is complete
    closeChapter3Complete();
  }, [closeChapter3Complete]);

  const returnFromChallenge = useCallback(() => {
    EventBus.emit("scene:start", { key: SCENES.hub });
    setCompletedChallenge(null);
  }, []);

  const openPuzzle = openPuzzleId ? PUZZLES[openPuzzleId] : null;

  return (
    <div className="game-shell">
      <GameCanvas />
      {activeScene && !showChapterComplete && <QuestTracker />}
      {!showChapterComplete && <ClueToast />}
      {!showChapterComplete && <SealToast />}
      {session && (
        <DialogueBox
          key={session.id}
          npcName={INTERACTABLES[session.npcId].name}
          lines={session.lines}
          hideInput={session.ended}
          pending={session.pending}
          npcId={session.npcId}
          onSubmit={(text) => submitPlayerResponse({ npcId: session.npcId, text, method: "text" })}
          onSubmitResponse={submitPlayerResponse}
          onClose={closeDialogue}
          choice={
            session.conversation.choice && !session.ended
              ? { label: session.conversation.choice.label, onChoose: chooseDialogueOption }
              : undefined
          }
        />
      )}
      {openPuzzle && (
        <SymbolPuzzle
          key={openPuzzle.id}
          puzzle={openPuzzle}
          order={puzzleOrders[openPuzzle.id] ?? openPuzzle.solution}
          solved={gameState.flags[CH2_FLAGS.wisdomPuzzleSolved] === true}
          onReorder={(order) => setPuzzleOrders((orders) => ({ ...orders, [openPuzzle.id]: order }))}
          onSubmit={(order) => submitPuzzle(openPuzzle.id, order)}
          onClose={() => setOpenPuzzle(null)}
        />
      )}
      {completedChallenge && (
        <ChallengeComplete
          title={CHALLENGES[completedChallenge].title}
          message={CHALLENGES[completedChallenge].message}
          onReturn={returnFromChallenge}
          onStay={() => setCompletedChallenge(null)}
        />
      )}
      {showChapter1Complete && <ChapterComplete completedChapter={1} onContinue={continueToOlympus} />}
      {showChapter2Complete && <ChapterComplete completedChapter={2} onContinue={continueToPalace} />}
      {import.meta.env.DEV && <DevToolsPanel mode={aiMode} onModeChange={setAiMode} />}
      {showChapter3Complete && <ChapterComplete completedChapter={3} onContinue={continueToChapter4} />}
      {showChapter4Complete && <ChapterComplete completedChapter={4} onClose={closeChapter4Complete} />}
    </div>
  );
}
