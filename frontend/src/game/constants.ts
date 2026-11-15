/** Logical game resolution. The canvas is scaled to fit the window. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Phaser scene keys. Scene-transition requests on the EventBus must use one of these. */
export const SCENES = {
  entrance: "OlympusEntrance",
  hub: "OlympusHub",
  ares: "AresTraining",
  hades: "HadesChamber",
  palace: "ZeusPalace",
  betrayal: "OlympusBetrayal",
  battle: "BattleForOlympus",
} as const;
export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
