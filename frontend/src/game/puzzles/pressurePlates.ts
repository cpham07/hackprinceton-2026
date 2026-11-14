import { getCounter, getGameState, setCounter } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import { CH3_FLAGS, PRESSURE_PUZZLE_REWARD } from "../story/chapter3";

/**
 * Two statues, each moved along a short track of fixed positions with the E key.
 * One position on each track is on that statue's pressure plate. Pushing past the last
 * position wraps to the first, so a statue can always be brought back and never gets stuck.
 */
export interface StatueTrack {
  id: string;
  /** World x of each position along the track (the statue's centre). */
  positions: number[];
  /** Index of the position that sits on this statue's plate. */
  plateIndex: number;
}

export const STATUE_TRACKS: StatueTrack[] = [
  { id: "statueA", positions: [800, 920, 1040], plateIndex: 2 },
  { id: "statueB", positions: [1300, 1420, 1540], plateIndex: 1 },
];

/** Positions live in the game state, so they survive leaving and re-entering the palace. */
const counterKey = (id: string) => `plates.${id}`;

export function statueIndex(track: StatueTrack): number {
  const index = getCounter(counterKey(track.id));
  return index >= 0 && index < track.positions.length ? index : 0;
}

export function statueX(track: StatueTrack): number {
  return track.positions[statueIndex(track)];
}

export function isPlateActive(track: StatueTrack): boolean {
  return statueIndex(track) === track.plateIndex;
}

/** Solved only while every statue is on its plate at the same time. */
export function arePlatesAllActive(): boolean {
  return STATUE_TRACKS.every(isPlateActive);
}

function isSolved(): boolean {
  return getGameState().flags[CH3_FLAGS.statuePuzzleSolved] === true;
}

/** Moves a statue to its next track position. Does nothing once the puzzle is solved. */
export function advanceStatue(id: string): boolean {
  const track = STATUE_TRACKS.find((t) => t.id === id);
  if (!track || isSolved()) return false;
  setCounter(counterKey(id), (statueIndex(track) + 1) % track.positions.length);
  if (arePlatesAllActive()) applyStoryActions(PRESSURE_PUZZLE_REWARD);
  return true;
}

/** Puts every statue back at its first position. Does nothing once the puzzle is solved. */
export function resetStatues(): boolean {
  if (isSolved()) return false;
  for (const track of STATUE_TRACKS) setCounter(counterKey(track.id), 0);
  return true;
}
