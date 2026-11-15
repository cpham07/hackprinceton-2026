import { useSyncExternalStore } from "react";
import { speakingCompanion, type CompanionSnapshot } from "../companion/companionStore";

/** Subscribes React to the Speaking Companion's state. */
export function useSpeakingCompanion(): CompanionSnapshot {
  return useSyncExternalStore(speakingCompanion.subscribe, speakingCompanion.getSnapshot);
}
