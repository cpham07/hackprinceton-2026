import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";

/**
 * Painted scene backgrounds. Purely visual: collision and the walkable surface stay the scene's own
 * physics bodies, whatever the painting shows.
 */
export interface BackgroundArt {
  key: string;
  path: string;
  width: number;
  height: number;
  /** Source y of the front edge of the painted floor. It is lined up with the scene's ground line. */
  floorEdgeY: number;
  /**
   * Horizontal scroll factor (0 = fixed to the camera, 1 = moves with the world). The image is scaled
   * up just enough to cover the whole camera range at this factor, so a higher value crops more.
   */
  parallax: number;
}

export const BACKGROUNDS = {
  // 1672x941 (about 16:9). Painted floor runs from y 586 to its front edge at 777, then the meander
  // band, the terrace face and a purple base. Sky and floating islands above.
  chapter1: {
    key: "bg-chapter1",
    path: "assets/backgrounds/chapter1_bg.png",
    width: 1672,
    height: 941,
    floorEdgeY: 777,
    parallax: 0.1,
  },
} satisfies Record<string, BackgroundArt>;

/** Call from the scene's preload(). */
export function preloadBackground(scene: Phaser.Scene, art: BackgroundArt): void {
  if (!scene.textures.exists(art.key)) scene.load.image(art.key, art.path);
}

/**
 * Adds the painting behind everything, or returns null if it did not load (the caller then draws its
 * placeholder backdrop).
 *
 * Fitting: a uniform scale (never stretched) that is the smallest of these that still works:
 * - wide enough to cover the screen over the whole camera range at the parallax factor;
 * - tall enough that, with the floor edge on groundY, the image reaches the top of the screen;
 * - tall enough to reach the bottom of the screen.
 * Whatever overflows is cropped off: sky at the top, the terrace base at the bottom.
 */
export function addBackground(
  scene: Phaser.Scene,
  art: BackgroundArt,
  options: { worldWidth: number; groundY: number },
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(art.key)) return null;
  const travel = Math.max(0, options.worldWidth - GAME_WIDTH);
  const scale = Math.max(
    (GAME_WIDTH + art.parallax * travel) / art.width,
    options.groundY / art.floorEdgeY,
    GAME_HEIGHT / art.height,
  );
  let top = options.groundY - art.floorEdgeY * scale;
  if (top + art.height * scale < GAME_HEIGHT) top = GAME_HEIGHT - art.height * scale;
  return scene.add
    .image(0, top, art.key)
    .setOrigin(0)
    .setScale(scale)
    .setScrollFactor(art.parallax, 0)
    .setDepth(-100);
}
