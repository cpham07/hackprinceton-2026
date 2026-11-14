import { useCallback, useEffect, useRef, useState } from "react";
import ChapterComplete from "./components/ChapterComplete";
import ClueToast from "./components/ClueToast";
import DialogueBox from "./components/DialogueBox";
import GameCanvas from "./components/GameCanvas";
import QuestTracker from "./components/QuestTracker";
import { EventBus } from "./game/EventBus";
import { INTERACTABLES } from "./game/data/interactables";
import { getReply, type Conversation } from "./game/dialogue/conversation";
import { getGameState } from "./game/state/gameState";
import { applyStoryActions } from "./game/story/actions";
import { FLAGS } from "./game/story/chapter1";
import { getConversation } from "./game/story/chapter1Dialogue";
import type { DialogueLine, PlayerResponse } from "./game/types/dialogue";
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

  const chapterComplete = useGameState().flags[FLAGS.chapter1Complete] === true;

  // Phaser asks for a dialogue; React decides whether to open one.
  useEffect(() => {
    return EventBus.on("dialogue:request", ({ npcId }) => {
      if (sessionRef.current || !INTERACTABLES[npcId]) return;
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

  // Tell Phaser when the overlay is actually shown or hidden.
  const openNpcId = session?.npcId ?? null;
  useEffect(() => {
    if (!openNpcId) return;
    EventBus.emit("dialogue:opened", { npcId: openNpcId });
    return () => EventBus.emit("dialogue:closed");
  }, [openNpcId]);

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

  return (
    <div className="game-shell">
      <GameCanvas />
      {!chapterComplete && <QuestTracker />}
      {!chapterComplete && <ClueToast />}
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
      {chapterComplete && <ChapterComplete />}
    </div>
  );
}
