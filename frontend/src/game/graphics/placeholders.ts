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
  gateOpen: "gate-open",
  aphrodite: "npc-aphrodite",
  theron: "npc-theron",
  lyra: "npc-lyra",
  gatekeeper: "npc-gatekeeper",
  gatekeeperAsleep: "npc-gatekeeper-asleep",
  statue: "object-statue",
  glow: "fx-glow",
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

  const drawGateFrame = () => {
    g.fillStyle(0xefe9dc);
    g.fillTriangle(0, 110, 180, 0, 360, 110); // pediment
    g.fillRect(0, 110, 360, 30);
    g.fillStyle(0xe3dccd);
    g.fillRect(20, 140, 60, 340);
    g.fillRect(280, 140, 60, 340);
  };

  bake(TEXTURES.gate, 360, 480, () => {
    drawGateFrame();
    g.fillStyle(0xc9a227); // golden doors, shut
    g.fillRect(80, 140, 200, 340);
    g.lineStyle(4, 0x8a6d12);
    g.lineBetween(180, 140, 180, 480);
    g.strokeRect(80, 140, 200, 340);
  });

  bake(TEXTURES.gateOpen, 360, 480, () => {
    drawGateFrame();
    g.fillStyle(0xfff6d6); // bright doorway into Olympus
    g.fillRect(80, 140, 200, 340);
    g.fillStyle(0xffe9a8);
    g.fillRect(110, 140, 140, 340);
    g.fillStyle(0xc9a227); // doors swung back against the pillars
    g.fillRect(80, 140, 22, 340);
    g.fillRect(258, 140, 22, 340);
    g.lineStyle(4, 0x8a6d12);
    g.strokeRect(80, 140, 22, 340);
    g.strokeRect(258, 140, 22, 340);
  });

  bake(TEXTURES.theron, 48, 80, () => {
    g.fillStyle(0xd9d9d9); // white hair and beard
    g.fillCircle(24, 13, 12);
    g.fillStyle(0xe2b893);
    g.fillCircle(24, 12, 9);
    g.fillStyle(0xd9d9d9);
    g.fillTriangle(15, 16, 33, 16, 24, 34);
    g.fillStyle(0x7a6a55); // brown robe, stooped
    g.fillRoundedRect(8, 26, 32, 54, 8);
    g.fillStyle(0x5b4a36); // walking stick
    g.fillRect(42, 22, 4, 58);
  });

  bake(TEXTURES.lyra, 48, 80, () => {
    g.fillStyle(0x4a2f1b); // dark hair
    g.fillCircle(24, 13, 13);
    g.fillStyle(0xf0c9a0);
    g.fillCircle(24, 14, 9);
    g.fillStyle(0x3fa58c); // teal tunic
    g.fillRoundedRect(10, 26, 28, 34, 6);
    g.fillStyle(0xf0c9a0);
    g.fillRect(15, 60, 7, 20);
    g.fillRect(26, 60, 7, 20);
    g.fillStyle(0xf4efe4); // scroll
    g.fillRect(34, 34, 10, 14);
  });

  const drawGuardBody = () => {
    g.fillStyle(0x8f1d1d); // helmet crest
    g.fillRect(24, 0, 16, 10);
    g.fillStyle(0xb08d2f); // helmet
    g.fillCircle(32, 20, 14);
    g.fillStyle(0xe2b893);
    g.fillRect(24, 20, 16, 12);
    g.fillStyle(0xb08d2f); // breastplate
    g.fillRoundedRect(12, 34, 40, 36, 6);
    g.fillStyle(0x8f1d1d); // skirt
    g.fillRect(14, 70, 36, 16);
    g.fillStyle(0xe2b893);
    g.fillRect(18, 86, 10, 22);
    g.fillRect(36, 86, 10, 22);
  };

  bake(TEXTURES.gatekeeper, 64, 108, () => {
    drawGuardBody();
    g.fillStyle(0x111111); // open eyes
    g.fillRect(27, 23, 3, 3);
    g.fillRect(34, 23, 3, 3);
    g.fillStyle(0x5b4a36); // spear held upright
    g.fillRect(56, 4, 4, 104);
    g.fillStyle(0xcfd4d8);
    g.fillTriangle(58, 0, 53, 12, 63, 12);
  });

  bake(TEXTURES.gatekeeperAsleep, 64, 108, () => {
    drawGuardBody();
    g.lineStyle(2, 0x111111); // closed eyes
    g.lineBetween(26, 25, 31, 25);
    g.lineBetween(33, 25, 38, 25);
    g.lineStyle(4, 0x5b4a36); // spear leaning
    g.lineBetween(62, 14, 50, 108);
  });

  bake(TEXTURES.statue, 64, 128, () => {
    g.fillStyle(0xbfc8cc); // plinth
    g.fillRect(4, 100, 56, 28);
    g.fillStyle(0xdfe6e9);
    g.fillRect(10, 92, 44, 10);
    g.fillCircle(32, 18, 12); // head
    g.fillRoundedRect(18, 30, 28, 62, 8); // robed figure
    g.fillRect(44, 38, 12, 8); // raised arm
    g.lineStyle(2, 0x9aa5aa); // carved inscription lines
    g.lineBetween(12, 108, 52, 108);
    g.lineBetween(12, 114, 52, 114);
    g.lineBetween(12, 120, 38, 120);
  });

  bake(TEXTURES.glow, 128, 128, () => {
    for (let i = 8; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.09);
      g.fillCircle(64, 64, i * 8);
    }
  });

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
