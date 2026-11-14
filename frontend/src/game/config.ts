import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "./constants";
import { getDevStartScene } from "./devShortcuts";
import { OlympusEntrance } from "./scenes/OlympusEntrance";
import { OlympusHub } from "./scenes/OlympusHub";

export function createGame(parent: HTMLElement): Phaser.Game {
  // Phaser starts the first scene in the list. That is the entrance unless a dev shortcut applies.
  const scenes = [OlympusEntrance, OlympusHub];
  if (getDevStartScene() === SCENES.hub) scenes.reverse();

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#3f7fd9",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 1800 } },
    },
    scene: scenes,
  });
}
