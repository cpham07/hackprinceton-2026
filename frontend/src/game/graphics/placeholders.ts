import Phaser from "phaser";

/**
 * Placeholder art, drawn with Phaser Graphics and registered under texture keys.
 * To use real art, load images under these same keys in the scene's preload()
 * and stop calling createPlaceholderTextures(). Display sizes and collision
 * boxes are set by the entities' configs, not by these textures.
 */
export const TEXTURES = {
  sky: "bg-sky",
  cloud: "bg-cloud",
  ground: "ground",
  column: "column",
  gate: "gate",
  playerIdle: "player-idle",
  playerWalk: "player-walk",
  aphrodite: "npc-aphrodite",
} as const;

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.sky)) return;
  const g = scene.make.graphics({}, false);

  const bake = (key: string, width: number, height: number, draw: () => void) => {
    g.clear();
    draw();
    g.generateTexture(key, width, height);
  };

  // Sky: vertical bands from deep blue to a warm horizon.
  bake(TEXTURES.sky, 64, 720, () => {
    const top = Phaser.Display.Color.ValueToColor(0x3f7fd9);
    const bottom = Phaser.Display.Color.ValueToColor(0xfbe3c2);
    const bands = 36;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, (720 / bands) * i, 64, 720 / bands + 1);
    }
  });

  bake(TEXTURES.cloud, 220, 90, () => {
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(70, 55, 120, 55);
    g.fillEllipse(120, 40, 120, 70);
    g.fillEllipse(160, 58, 100, 50);
  });

  // Ground: marble slab with a lighter top edge. Tiles horizontally.
  bake(TEXTURES.ground, 128, 100, () => {
    g.fillStyle(0xd9d2c3);
    g.fillRect(0, 0, 128, 100);
    g.fillStyle(0xf4efe4);
    g.fillRect(0, 0, 128, 10);
    g.lineStyle(2, 0xb8b0a0);
    g.lineBetween(0, 10, 128, 10);
    g.lineBetween(64, 10, 64, 100);
  });

  bake(TEXTURES.column, 90, 420, () => {
    g.fillStyle(0xefe9dc);
    g.fillRect(0, 0, 90, 26); // capital
    g.fillRect(0, 394, 90, 26); // base
    g.fillStyle(0xe3dccd);
    g.fillRect(14, 26, 62, 368); // shaft
    g.lineStyle(3, 0xc9c1b0);
    for (let x = 26; x <= 64; x += 12) g.lineBetween(x, 30, x, 390);
  });

  bake(TEXTURES.gate, 360, 480, () => {
    g.fillStyle(0xefe9dc);
    g.fillTriangle(0, 110, 180, 0, 360, 110); // pediment
    g.fillRect(0, 110, 360, 30);
    g.fillStyle(0xe3dccd);
    g.fillRect(20, 140, 60, 340);
    g.fillRect(280, 140, 60, 340);
    g.fillStyle(0xc9a227); // golden doors
    g.fillRect(80, 140, 200, 340);
    g.lineStyle(4, 0x8a6d12);
    g.lineBetween(180, 140, 180, 480);
    g.strokeRect(80, 140, 200, 340);
  });

  const drawPerson = (tunic: number, skin: number, legSpread: number) => {
    g.fillStyle(skin);
    g.fillCircle(24, 12, 11); // head
    g.fillStyle(tunic);
    g.fillRoundedRect(8, 24, 32, 30, 6); // torso
    g.fillStyle(skin);
    g.fillRect(16 - legSpread, 54, 7, 18); // legs
    g.fillRect(25 + legSpread, 54, 7, 18);
  };

  bake(TEXTURES.playerIdle, 48, 72, () => drawPerson(0x2f6fb5, 0xf0c9a0, 0));
  bake(TEXTURES.playerWalk, 48, 72, () => drawPerson(0x2f6fb5, 0xf0c9a0, 5));

  bake(TEXTURES.aphrodite, 48, 88, () => {
    g.fillStyle(0xe8b04a); // hair
    g.fillCircle(24, 14, 14);
    g.fillStyle(0xf3d1b0);
    g.fillCircle(24, 15, 10);
    g.fillStyle(0xe86a9a); // long robe
    g.fillTriangle(24, 22, 2, 88, 46, 88);
    g.fillRoundedRect(10, 26, 28, 26, 6);
  });

  g.destroy();
}
