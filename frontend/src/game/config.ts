import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES, type SceneKey } from "./constants";
import { getDevStartScene } from "./devShortcuts";
import { AresTraining } from "./scenes/AresTraining";
import { HadesChamber } from "./scenes/HadesChamber";
import { ZeusPalace } from "./scenes/ZeusPalace";
import { OlympusBetrayal } from "./scenes/OlympusBetrayal";
import { OlympusEntrance } from "./scenes/OlympusEntrance";
import { OlympusHub } from "./scenes/OlympusHub";

export function createGame(parent: HTMLElement): Phaser.Game {
  // Phaser starts the first scene in the list. That is the entrance unless a dev shortcut applies.
  const scenes: Array<[SceneKey, typeof Phaser.Scene]> = [
    [SCENES.entrance, OlympusEntrance],
    [SCENES.hub, OlympusHub],
    [SCENES.ares, AresTraining],
    [SCENES.hades, HadesChamber],
    [SCENES.palace, ZeusPalace],
    [SCENES.betrayal, OlympusBetrayal],
  ];
  const start = getDevStartScene();
  if (start) scenes.sort(([a], [b]) => Number(b === start) - Number(a === start));

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
    scene: scenes.map(([, scene]) => scene),
  });
}
