import { useCallback, useEffect, useRef, useState } from "react";
import ChallengeComplete from "./components/ChallengeComplete";
import ChapterComplete from "./components/ChapterComplete";
import ClueToast from "./components/ClueToast";
import SealToast from "./components/SealToast";
import DialogueBox from "./components/DialogueBox";
import GameCanvas from "./components/GameCanvas";
import QuestTracker from "./components/QuestTracker";
import SymbolPuzzle from "./components/SymbolPuzzle";
import { SCENES, type SceneKey } from "./game/constants";
import { EventBus } from "./game/EventBus";
import { INTERACTABLES } from "./game/data/interactables";
import { getReply, type Conversation } from "./game/dialogue/conversation";
import { isCorrectSequence, shuffledStart } from "./game/puzzles/sequencePuzzle";
import { PUZZLES } from "./game/puzzles/wisdomPuzzle";
import { getGameState } from "./game/state/gameState";
import { applyStoryActions } from "./game/story/actions";
import { FLAGS } from "./game/story/chapter1";
import { CH2_FLAGS, CHALLENGES } from "./game/story/chapter2";
import { CH3_FLAGS } from "./game/story/chapter3";
import { getConversation } from "./game/story/conversations";
import type { DialogueLine, PlayerResponse } from "./game/types/dialogue";
import { useCompletionScreen } from "./hooks/useCompletionScreen";
import { useGameState } from "./hooks/useGameState";

interface DialogueSession {
  npcId: string;
  conversation: Conversation;
  lines: DialogueLine[];
  /** Number of player replies so far in this conversation. */
  repliesGiven: number;
  /** Nothing further to answer; the input is hidden. */
  ended: boolean;
}

export default function App() {
  const [session, setSessionState] = useState<DialogueSession | null>(null);
  // Mirror of `session` for event handlers, so story actions run in handlers, not in state updaters.
  const sessionRef = useRef<DialogueSession | null>(null);
  const setSession = useCallback((next: DialogueSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

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
  const showChapterComplete = showChapter1Complete || showChapter2Complete || showChapter3Complete;

  // Phaser asks for a dialogue; React decides whether to open one.
  useEffect(() => {
    return EventBus.on("dialogue:request", ({ npcId }) => {
      if (sessionRef.current || openPuzzleRef.current || !INTERACTABLES[npcId]) return;
      const conversation = getConversation(npcId, getGameState());
      if (!conversation) return;
      // The opening line is shown now, so its story actions apply now.
      applyStoryActions(conversation.opening.actions);
      setSession({
        npcId,
        conversation,
        lines: [{ speaker: "npc", text: conversation.opening.text }],
        repliesGiven: 0,
        ended: conversation.readOnly === true,
      });
    });
  }, [setSession]);

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
    showChapter3Complete;
  useEffect(() => {
    if (!overlayOpen) return;
    EventBus.emit("overlay:opened", { id: "app-overlay" });
    return () => EventBus.emit("overlay:closed", { id: "app-overlay" });
  }, [overlayOpen]);

  /**
   * The single entry point for player replies. Typed text comes through here now;
   * voice transcriptions will call it later with method "voice".
   */
  const submitPlayerResponse = useCallback(
    (response: PlayerResponse) => {
      const current = sessionRef.current;
      const text = response.text.trim();
      if (!current || current.ended || current.npcId !== response.npcId || !text) return;

      const reply = getReply(current.conversation, current.repliesGiven, { ...response, text });
      // The reply is revealed by this update, so its story actions apply with it.
      applyStoryActions(reply.step.actions);
      setSession({
        ...current,
        repliesGiven: current.repliesGiven + 1,
        ended: reply.ended,
        lines: [
          ...current.lines,
          { speaker: "player", text },
          { speaker: "npc", text: reply.step.text },
        ],
      });
    },
    [setSession],
  );

  const closeDialogue = useCallback(() => setSession(null), [setSession]);

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
          key={session.npcId}
          npcName={INTERACTABLES[session.npcId].name}
          lines={session.lines}
          hideInput={session.ended}
          onSubmit={(text) => submitPlayerResponse({ npcId: session.npcId, text, method: "text" })}
          onClose={closeDialogue}
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
      {showChapter3Complete && (
        <ChapterComplete completedChapter={3} onClose={closeChapter3Complete} />
      )}
    </div>
  );
}
