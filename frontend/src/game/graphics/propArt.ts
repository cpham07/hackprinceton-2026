import Phaser from "phaser";
import { TEXTURES } from "./placeholders";

/**
 * Hand-drawn art (SVG, in public/assets/) that replaces generated placeholders under the SAME texture key.
 * placeholders.ts never overwrites a key that is already loaded, so every scene keeps its positions,
 * display sizes and collisions; only the picture changes. A missing file falls back to the placeholder.
 *
 * Each SVG keeps its placeholder's proportions. `scale` is how many times larger than the placeholder it is
 * rasterised: 2 for art that scenes always stretch with setDisplaySize (characters via Npc, arches, palace
 * gates, the vault, the library door), so it stays sharp; 1 for art shown at its natural size (the Chapter 1
 * gate and the fountain), so that size is unchanged.
 */
export interface PropArt {
  path: string;
  /** The placeholder's size in pixels (see the bake() call in placeholders.ts). */
  width: number;
  height: number;
  scale: 1 | 2;
}

const PEOPLE = "assets/characters/mortals";
const BUILDINGS = "assets/buildings";

export const PROP_ART: Partial<Record<string, PropArt>> = {
  // Chapter 1 mortals
  [TEXTURES.theron]: { path: `${PEOPLE}/theron.svg`, width: 48, height: 80, scale: 2 },
  [TEXTURES.lyra]: { path: `${PEOPLE}/lyra.svg`, width: 48, height: 80, scale: 2 },
  [TEXTURES.gatekeeper]: { path: `${PEOPLE}/gatekeeper.svg`, width: 64, height: 108, scale: 2 },
  [TEXTURES.gatekeeperAsleep]: { path: `${PEOPLE}/gatekeeper_asleep.svg`, width: 64, height: 108, scale: 2 },
  // Chapter 3 palace guards (two figures in one image)
  [TEXTURES.palaceGuards]: { path: `${PEOPLE}/palace_guards.svg`, width: 180, height: 150, scale: 2 },
  [TEXTURES.palaceGuardsAside]: { path: `${PEOPLE}/palace_guards_aside.svg`, width: 180, height: 150, scale: 2 },
  // Buildings
  [TEXTURES.gate]: { path: `${BUILDINGS}/gate.svg`, width: 360, height: 480, scale: 1 },
  [TEXTURES.gateOpen]: { path: `${BUILDINGS}/gate_open.svg`, width: 360, height: 480, scale: 1 },
  [TEXTURES.fountain]: { path: `${BUILDINGS}/fountain.svg`, width: 220, height: 150, scale: 1 },
  [TEXTURES.temple]: { path: `${BUILDINGS}/temple.svg`, width: 520, height: 400, scale: 2 },
  [TEXTURES.archAres]: { path: `${BUILDINGS}/arch_ares.svg`, width: 230, height: 300, scale: 2 },
  [TEXTURES.archAresOpen]: { path: `${BUILDINGS}/arch_ares_open.svg`, width: 230, height: 300, scale: 2 },
  [TEXTURES.archHades]: { path: `${BUILDINGS}/arch_hades.svg`, width: 230, height: 300, scale: 2 },
  [TEXTURES.palaceLocked]: { path: `${BUILDINGS}/palace_locked.svg`, width: 230, height: 330, scale: 2 },
  [TEXTURES.palaceOpen]: { path: `${BUILDINGS}/palace_open.svg`, width: 230, height: 330, scale: 2 },
  [TEXTURES.libraryDoor]: { path: `${BUILDINGS}/library_door.svg`, width: 180, height: 320, scale: 2 },
  [TEXTURES.libraryDoorOpen]: { path: `${BUILDINGS}/library_door_open.svg`, width: 180, height: 320, scale: 2 },
  [TEXTURES.vaultDoor]: { path: `${BUILDINGS}/vault_door.svg`, width: 240, height: 340, scale: 2 },
  [TEXTURES.vaultDoorOpen]: { path: `${BUILDINGS}/vault_door_open.svg`, width: 240, height: 340, scale: 2 },
  // A tile repeated along the hub's floating ledges (a tileSprite), so it stays at its natural size.
  [TEXTURES.marblePlatform]: { path: `${BUILDINGS}/marble_platform.svg`, width: 64, height: 20, scale: 1 },
};

/** Call from a scene's preload(). Textures are shared by all scenes, so only the first scene loads them. */
export function preloadPropArt(scene: Phaser.Scene): void {
  for (const [key, art] of Object.entries(PROP_ART)) {
    if (!art || scene.textures.exists(key)) continue;
    scene.load.svg(key, art.path, { width: art.width * art.scale, height: art.height * art.scale });
  }
}
