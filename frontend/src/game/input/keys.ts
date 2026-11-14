import Phaser from "phaser";

type Keyboard = Phaser.Input.Keyboard.KeyboardPlugin;
type Key = Phaser.Input.Keyboard.Key;

const K = Phaser.Input.Keyboard.KeyCodes;

/**
 * Keys whose browser default is suppressed while gameplay has the keyboard:
 * Space and arrows would scroll the page, and E must not be typed into the
 * dialogue input that it opens. A and D have no default worth suppressing.
 */
export const CAPTURED_KEYS: number[] = [K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT, K.E];

export interface GameplayKeys {
  left: Key[];
  right: Key[];
  jump: Key[];
  interact: Key;
  /** Presses not yet handled. Set by key-down events so a tap shorter than one frame still counts. */
  pressed: { jump: boolean; interact: boolean };
}

/** Creates the gameplay keys without capturing anything; capture is managed below. */
export function createGameplayKeys(keyboard: Keyboard): GameplayKeys {
  const key = (code: number) => keyboard.addKey(code, false);
  const keys: GameplayKeys = {
    left: [key(K.A), key(K.LEFT)],
    right: [key(K.D), key(K.RIGHT)],
    jump: [key(K.SPACE), key(K.UP)],
    interact: key(K.E),
    pressed: { jump: false, interact: false },
  };
  // Key "down" fires once per physical press (not on auto-repeat).
  for (const jumpKey of keys.jump) jumpKey.on("down", () => (keys.pressed.jump = true));
  keys.interact.on("down", () => (keys.pressed.interact = true));
  return keys;
}

/** Returns whether the action was pressed since the last call, and clears it. */
export function consumePress(keys: GameplayKeys, action: "jump" | "interact"): boolean {
  const pressed = keys.pressed[action];
  keys.pressed[action] = false;
  return pressed;
}

export function clearPresses(keys: GameplayKeys): void {
  keys.pressed.jump = false;
  keys.pressed.interact = false;
}

export function captureGameplayKeys(keyboard: Keyboard): void {
  keyboard.addCapture(CAPTURED_KEYS);
}

export function releaseGameplayKeys(keyboard: Keyboard): void {
  keyboard.removeCapture(CAPTURED_KEYS);
}
