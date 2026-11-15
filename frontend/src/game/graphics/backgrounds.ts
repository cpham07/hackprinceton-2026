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
  // Chapter 1, the road up to Olympus. 1672x941: grassy hills, a waterfall and a stone path (y ~705 to
  // ~835) with rocks in the foreground. The ground line runs along the middle of the path (y 790), so the
  // characters stand ON the path with paving in front of their feet, not on its front edge.
  chapter1: {
    key: "bg-chapter1",
    path: "assets/backgrounds/chapter1_bg.webp",
    width: 1672,
    height: 941,
    floorEdgeY: 790,
    parallax: 0.1,
  },
  // Chapter 2, inside Olympus (the hub). 1672x941. Painted floor runs from y 586 to its front edge at
  // 777, then the meander band, the terrace face and a purple base. Sky and floating islands above.
  hub: {
    key: "bg-olympus-hub",
    path: "assets/backgrounds/olympus_hub_bg.png",
    width: 1672,
    height: 941,
    floorEdgeY: 777,
    parallax: 0.1,
  },
  // Zeus's palace (Chapter 3 inside, Chapter 4 on its steps). 1672x941: arches with banners over a sky
  // view; a terrace with chests, then a paved walkway between two gold lines (y ~645 to ~770) and the
  // palace wall below. The ground line runs inside the walkway (y 750), so the paving shows under the feet.
  palace: {
    key: "bg-zeus-palace",
    path: "assets/backgrounds/zeus_palace_bg.webp",
    width: 1672,
    height: 941,
    floorEdgeY: 750,
    parallax: 0.1,
  },
  // Ares's training arena. 1672x941 SVG (hand-authored, editable): tiered stands with a crowd, banners and
  // torches; the sand's front edge is at y 800.
  arena: {
    key: "bg-ares-arena",
    path: "assets/backgrounds/ares_arena_bg.svg",
    width: 1672,
    height: 941,
    floorEdgeY: 800,
    parallax: 0.2,
  },
} satisfies Record<string, BackgroundArt>;

/** Call from the scene's preload(). */
export function preloadBackground(scene: Phaser.Scene, art: BackgroundArt): void {
  if (scene.textures.exists(art.key)) return;
  // An SVG painting is rasterised at its documented size, so floorEdgeY applies directly.
  if (art.path.endsWith(".svg")) scene.load.svg(art.key, art.path, { width: art.width, height: art.height });
  else scene.load.image(art.key, art.path);
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
  // Use the file's real size: a re-exported image at another resolution still lines up, because the
  // floor edge is measured as a fraction of the documented height.
  const source = scene.textures.get(art.key).getSourceImage();
  const width = source.width || art.width;
  const height = source.height || art.height;
  const floorEdgeY = art.floorEdgeY * (height / art.height);
  const travel = Math.max(0, options.worldWidth - GAME_WIDTH);
  const scale = Math.max(
    (GAME_WIDTH + art.parallax * travel) / width,
    options.groundY / floorEdgeY,
    GAME_HEIGHT / height,
  );
  let top = options.groundY - floorEdgeY * scale;
  if (top + height * scale < GAME_HEIGHT) top = GAME_HEIGHT - height * scale;
  return scene.add
    .image(0, top, art.key)
    .setOrigin(0)
    .setScale(scale)
    .setScrollFactor(art.parallax, 0)
    .setDepth(-100);
}
