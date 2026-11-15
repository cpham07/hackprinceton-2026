import Phaser from "phaser";
import { TEXTURES } from "./placeholders";

/**
 * Real character artwork, keyed by the interactable's `textureKey`. Characters listed here are drawn from
 * these files; everyone else keeps the generated placeholder from placeholders.ts.
 *
 * Measurements are in source pixels of the file, so the art is sized and anchored the same way in every
 * scene (the per-scene `displaySize` in data/interactables.ts is only used for placeholders).
 *
 * To add animation: draw every frame on the same canvas size with the character in the same place, and
 * list the files in `frames`. The first frame is loaded under the interactable's own texture key and the
 * rest under `${textureKey}-1`, `${textureKey}-2`, ...; Npc plays them as a looping idle animation.
 */
export interface CharacterArt {
  /** Image files under public/, in idle-animation order. */
  frames: string[];
  /** Idle animation speed when there is more than one frame. */
  frameRate: number;
  frameWidth: number;
  frameHeight: number;
  /** The drawn region. Everything outside is transparent padding (and, in some files, stray specks). */
  visible: { x: number; y: number; width: number; height: number };
  /** Where the soles touch the ground. */
  feetY: number;
  /** Horizontal centre between the feet: the point that stands on the interactable's x. */
  anchorX: number;
  /** Height in world pixels from the top of the drawn region to the feet. Width follows the aspect ratio. */
  worldHeight: number;
  /** Optional point (source pixels) where a held prop goes, e.g. Aphrodite holding the bolt. */
  hand?: { x: number; y: number };
}

const NPC_DIR = "assets/characters/npcs";

/** For scale: the player axolotl is about 102 world pixels tall and the ground line is at y = 620. */
export const CHARACTER_ART: Partial<Record<string, CharacterArt>> = {
  // 512x1024. Figure (halo to front sole) spans x 63-365, y 228-816; the staff is on the left.
  [TEXTURES.zeus]: {
    frames: [`${NPC_DIR}/zeus.png`],
    frameRate: 6,
    frameWidth: 512,
    frameHeight: 1024,
    visible: { x: 56, y: 220, width: 316, height: 600 },
    feetY: 815,
    anchorX: 255,
    // The placeholder's height: the golden cage in Chapters 4-5 (250 tall) and his name label fit around it.
    worldHeight: 200,
  },
  // 512x1024. Figure spans x 98-369, y 146-835 (spear tip to sole). The crop leaves out specks at
  // (90-93, 808), (394, 840), (509-511, 815) and (40-42, 894-895).
  [TEXTURES.athena]: {
    frames: [`${NPC_DIR}/athena.png`],
    frameRate: 6,
    frameWidth: 512,
    frameHeight: 1024,
    visible: { x: 96, y: 140, width: 278, height: 700 },
    feetY: 833,
    anchorX: 197,
    worldHeight: 168,
  },
  // 512x1024. Figure spans x 102-334, y 127-943. The crop leaves out specks at (90-93, 907),
  // (394-395, 949), (509-511, 916-917) and (40-42, 1021-1023).
  [TEXTURES.aphrodite]: {
    frames: [`${NPC_DIR}/aphrodite.png`],
    frameRate: 6,
    frameWidth: 512,
    frameHeight: 1024,
    visible: { x: 98, y: 120, width: 242, height: 826 },
    feetY: 940,
    anchorX: 198,
    worldHeight: 160,
    hand: { x: 318, y: 236 }, // raised fist
  },
};

/** Where the bolt sits relative to the placeholder Aphrodite's feet, used only if her art did not load. */
export const HELD_BOLT_PLACEHOLDER_OFFSET = { x: 34, y: -118 };

const frameKey =(textureKey: string, index: number) => (index === 0 ? textureKey : `${textureKey}-${index}`);

/** Call from a scene's preload(). Textures are shared by all scenes, so only the first scene loads them. */
export function preloadCharacterArt(scene: Phaser.Scene): void {
  for (const [textureKey, art] of Object.entries(CHARACTER_ART)) {
    art!.frames.forEach((path, index) => {
      const key = frameKey(textureKey, index);
      if (!scene.textures.exists(key)) scene.load.image(key, path);
    });
  }
}

/**
 * The art for a texture key, or null when it has none or the file did not load (then a placeholder was
 * generated under the key instead, and the caller should size it the placeholder way).
 */
export function getCharacterArt(scene: Phaser.Scene, textureKey: string): CharacterArt | null {
  const art = CHARACTER_ART[textureKey];
  if (!art || !scene.textures.exists(textureKey)) return null;
  const source = scene.textures.get(textureKey).getSourceImage();
  return source.width === art.frameWidth && source.height === art.frameHeight ? art : null;
}

/** Creates (once) and returns the idle animation key, or null for single-frame art. */
export function ensureIdleAnimation(scene: Phaser.Scene, textureKey: string, art: CharacterArt): string | null {
  const frames = art.frames.map((_, index) => frameKey(textureKey, index)).filter((key) => scene.textures.exists(key));
  if (frames.length < 2) return null;
  const animKey = `${textureKey}-idle`;
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({ key: animKey, frames: frames.map((key) => ({ key })), frameRate: art.frameRate, repeat: -1 });
  }
  return animKey;
}
