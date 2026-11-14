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
  // Chapter 2: Olympus hub and Athena's library
  skyOlympus: "bg-sky-olympus",
  temple: "temple",
  fountain: "fountain",
  marblePlatform: "platform-marble",
  athena: "npc-athena",
  archAres: "arch-ares",
  archAresOpen: "arch-ares-open",
  ares: "npc-ares",
  // Chapter 2: Ares's training arena
  skyArena: "bg-sky-arena",
  arenaWall: "arena-wall",
  arenaGround: "arena-ground",
  arenaExit: "arena-exit",
  hazard: "hazard-hammer",
  finishLine: "finish-line",
  sealCourage: "seal-courage",
  // Chapter 2: Hades's chamber and Zeus's palace
  skyUnderworld: "bg-sky-underworld",
  underworldWall: "underworld-wall",
  underworldFloor: "underworld-floor",
  underworldColumn: "underworld-column",
  underworldExit: "underworld-exit",
  throne: "throne",
  brazier: "brazier",
  hades: "npc-hades",
  sealPassage: "seal-passage",
  palaceLocked: "palace-locked",
  palaceOpen: "palace-open",
  // Chapter 3: inside Zeus's palace
  palaceWall: "palace-wall",
  palaceFloor: "palace-floor",
  goldColumn: "gold-column",
  palaceExitDoor: "palace-exit-door",
  puzzleStatue: "puzzle-statue",
  plateOff: "plate-off",
  plateOn: "plate-on",
  puzzleLever: "puzzle-lever",
  portcullis: "portcullis",
  portcullisOpen: "portcullis-open",
  palaceGuards: "palace-guards",
  palaceGuardsAside: "palace-guards-aside",
  vaultDoor: "vault-door",
  vaultDoorOpen: "vault-door-open",
  masterBolt: "master-bolt",
  zeus: "npc-zeus",
  archHades: "arch-hades",
  libraryWall: "library-wall",
  libraryDoor: "library-door",
  libraryDoorOpen: "library-door-open",
  bookshelf: "bookshelf",
  pedestal: "object-pedestal",
  seal: "seal-wisdom",
  symbolOwl: "symbol-owl",
  symbolOlive: "symbol-olive",
  symbolShield: "symbol-shield",
  symbolBolt: "symbol-bolt",
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

  // ---- Chapter 2: Olympus hub ----

  // Celestial sky: pale gold at the top fading to soft blue-white.
  bake(TEXTURES.skyOlympus, 64, 720, () => {
    const top = Phaser.Display.Color.ValueToColor(0xfff1c4);
    const bottom = Phaser.Display.Color.ValueToColor(0xcfe6ff);
    const bands = 36;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, (720 / bands) * i, 64, 720 / bands + 1);
    }
  });

  bake(TEXTURES.temple, 520, 400, () => {
    g.fillStyle(0xf7f1e3);
    g.fillTriangle(0, 120, 260, 0, 520, 120); // pediment
    g.fillRect(0, 120, 520, 28);
    g.fillRect(0, 372, 520, 28); // steps
    g.fillStyle(0xe9e1cf);
    for (let x = 30; x <= 450; x += 84) g.fillRect(x, 148, 40, 224); // columns
    g.fillStyle(0xd4af37);
    g.fillCircle(260, 72, 22); // golden emblem
  });

  bake(TEXTURES.fountain, 220, 150, () => {
    g.fillStyle(0xe9e1cf);
    g.fillRect(0, 110, 220, 40); // basin
    g.fillRect(96, 40, 28, 70); // pillar
    g.fillEllipse(110, 40, 90, 22);
    g.fillStyle(0x8fd3ff, 0.9); // water
    g.fillRect(8, 104, 204, 10);
    g.fillEllipse(110, 34, 70, 10);
    g.fillRect(70, 34, 6, 72);
    g.fillRect(144, 34, 6, 72);
  });

  bake(TEXTURES.marblePlatform, 64, 20, () => {
    g.fillStyle(0xf4efe4);
    g.fillRect(0, 0, 64, 20);
    g.fillStyle(0xd4af37);
    g.fillRect(0, 0, 64, 3);
    g.lineStyle(1, 0xb8b0a0);
    g.lineBetween(32, 3, 32, 20);
  });

  bake(TEXTURES.athena, 52, 94, () => {
    g.fillStyle(0x8a8f98); // helmet with crest
    g.fillCircle(26, 16, 13);
    g.fillStyle(0x3a5ba0);
    g.fillRect(22, 0, 8, 8);
    g.fillStyle(0xe8c9a6);
    g.fillRect(19, 16, 14, 11); // face
    g.fillStyle(0xf2efe6); // long white chiton
    g.fillRoundedRect(10, 28, 32, 66, 6);
    g.fillStyle(0x3a5ba0); // blue sash
    g.fillRect(10, 44, 32, 6);
    g.fillStyle(0x6b5a3a); // spear
    g.fillRect(46, 4, 3, 90);
    g.fillStyle(0xcfd4d8);
    g.fillTriangle(47.5, 0, 43, 10, 52, 10);
  });

  const drawArch = (stone: number, inside: number, banner: number, barred = true) => {
    g.fillStyle(stone);
    g.fillRect(0, 40, 40, 260);
    g.fillRect(190, 40, 40, 260);
    g.fillRect(0, 0, 230, 50);
    g.fillStyle(inside);
    g.fillRect(40, 50, 150, 250);
    g.fillStyle(banner);
    g.fillRect(60, 60, 110, 44);
    if (!barred) return;
    g.lineStyle(6, 0x5b4a36); // crossed bars: closed
    g.lineBetween(46, 120, 184, 294);
    g.lineBetween(184, 120, 46, 294);
  };
  bake(TEXTURES.archAres, 230, 300, () => drawArch(0xd9c8b8, 0x5a1f1f, 0xb3261e));
  bake(TEXTURES.archAresOpen, 230, 300, () => {
    drawArch(0xd9c8b8, 0xf0a35c, 0xb3261e, false); // bright arena sand beyond
    g.fillStyle(0xd98a3d);
    g.fillRect(40, 250, 150, 50);
  });
  bake(TEXTURES.archHades, 230, 300, () => drawArch(0x8d8a99, 0x1a1626, 0x4b2d7a));

  bake(TEXTURES.ares, 56, 98, () => {
    g.fillStyle(0xb3261e); // tall helmet crest
    g.fillRect(20, 0, 16, 12);
    g.fillStyle(0x7a7f87); // helmet
    g.fillCircle(28, 20, 14);
    g.fillStyle(0xc99a72);
    g.fillRect(21, 20, 14, 12); // face
    g.fillStyle(0x7a7f87); // breastplate, broad shoulders
    g.fillRoundedRect(6, 32, 44, 34, 6);
    g.fillStyle(0xb3261e); // red cloak and skirt
    g.fillRect(8, 66, 40, 14);
    g.fillStyle(0xc99a72);
    g.fillRect(14, 80, 10, 18);
    g.fillRect(32, 80, 10, 18);
    g.fillStyle(0xb08d2f); // round shield
    g.fillCircle(10, 52, 10);
  });

  // ---- Chapter 2: Athena's library ----

  bake(TEXTURES.libraryWall, 128, 128, () => {
    g.fillStyle(0x4a3b52);
    g.fillRect(0, 0, 128, 128);
    g.lineStyle(2, 0x3a2d42);
    g.strokeRect(0, 0, 64, 64);
    g.strokeRect(64, 64, 64, 64);
    g.fillStyle(0xd4af37, 0.25); // faint meander dots
    g.fillRect(28, 28, 8, 8);
    g.fillRect(92, 92, 8, 8);
  });

  const drawDoorFrame = () => {
    g.fillStyle(0xf7f1e3);
    g.fillRect(0, 0, 180, 36);
    g.fillRect(0, 36, 34, 284);
    g.fillRect(146, 36, 34, 284);
    g.fillStyle(0xd4af37);
    g.fillRect(0, 30, 180, 6);
  };
  bake(TEXTURES.libraryDoor, 180, 320, () => {
    drawDoorFrame();
    g.fillStyle(0x7a5230); // closed wooden doors
    g.fillRect(34, 36, 112, 284);
    g.lineStyle(3, 0x4f3520);
    g.lineBetween(90, 36, 90, 320);
    g.fillStyle(0xd4af37);
    g.fillCircle(80, 180, 5);
    g.fillCircle(100, 180, 5);
  });
  bake(TEXTURES.libraryDoorOpen, 180, 320, () => {
    drawDoorFrame();
    g.fillStyle(0x2c2233); // dark doorway
    g.fillRect(34, 36, 112, 284);
    g.fillStyle(0x7a5230); // doors folded back
    g.fillRect(34, 36, 12, 284);
    g.fillRect(134, 36, 12, 284);
  });

  bake(TEXTURES.bookshelf, 150, 320, () => {
    g.fillStyle(0x5b3d24);
    g.fillRect(0, 0, 150, 320);
    const spines = [0xb3261e, 0x2f6fb5, 0x3fa58c, 0xd4af37, 0x7a4fa3, 0xe9e1cf];
    for (let row = 0; row < 5; row++) {
      const top = 12 + row * 62;
      g.fillStyle(0x3a2616);
      g.fillRect(8, top, 134, 50);
      for (let i = 0; i < 11; i++) {
        g.fillStyle(spines[(i + row * 2) % spines.length]);
        g.fillRect(12 + i * 12, top + 6 + ((i * 7 + row * 3) % 10), 9, 44 - ((i * 7 + row * 3) % 10));
      }
    }
  });

  bake(TEXTURES.pedestal, 90, 110, () => {
    g.fillStyle(0xe9e1cf);
    g.fillRect(0, 0, 90, 16); // top slab
    g.fillRect(18, 16, 54, 74);
    g.fillRect(6, 90, 78, 20); // base
    g.fillStyle(0xd4af37);
    g.fillRect(0, 12, 90, 4);
    g.lineStyle(2, 0xb8b0a0);
    for (let x = 28; x <= 62; x += 11) g.lineBetween(x, 20, x, 86);
  });

  bake(TEXTURES.seal, 96, 96, () => {
    g.fillStyle(0xd4af37);
    g.fillCircle(48, 48, 46);
    g.fillStyle(0x3a5ba0);
    g.fillCircle(48, 48, 36);
    g.fillStyle(0xf7f1e3); // owl face
    g.fillCircle(36, 44, 11);
    g.fillCircle(60, 44, 11);
    g.fillStyle(0x1b1228);
    g.fillCircle(36, 44, 5);
    g.fillCircle(60, 44, 5);
    g.fillStyle(0xd4af37);
    g.fillTriangle(48, 50, 42, 62, 54, 62);
  });

  // Symbol plaques: a stone tile with a simple icon.
  const plaque = (key: string, drawIcon: () => void) =>
    bake(key, 96, 96, () => {
      g.fillStyle(0xe9e1cf);
      g.fillRoundedRect(0, 0, 96, 96, 10);
      g.lineStyle(3, 0xd4af37);
      g.strokeRoundedRect(2, 2, 92, 92, 10);
      drawIcon();
    });
  plaque(TEXTURES.symbolOwl, () => {
    g.fillStyle(0x6b5a3a);
    g.fillEllipse(48, 54, 46, 56);
    g.fillTriangle(30, 30, 36, 14, 44, 30);
    g.fillTriangle(52, 30, 60, 14, 66, 30);
    g.fillStyle(0xffffff);
    g.fillCircle(38, 44, 9);
    g.fillCircle(58, 44, 9);
    g.fillStyle(0x1b1228);
    g.fillCircle(38, 44, 4);
    g.fillCircle(58, 44, 4);
  });
  plaque(TEXTURES.symbolOlive, () => {
    g.lineStyle(4, 0x5b4a36);
    g.lineBetween(20, 76, 76, 20);
    g.fillStyle(0x4f8a3c);
    for (let i = 0; i < 4; i++) {
      g.fillEllipse(30 + i * 13, 58 - i * 13, 20, 9);
      g.fillEllipse(40 + i * 13, 72 - i * 13, 9, 20);
    }
  });
  plaque(TEXTURES.symbolShield, () => {
    g.fillStyle(0xb3261e);
    g.fillCircle(48, 48, 32);
    g.fillStyle(0xd4af37);
    g.fillCircle(48, 48, 22);
    g.fillStyle(0xb3261e);
    g.fillCircle(48, 48, 9);
  });
  plaque(TEXTURES.symbolBolt, () => {
    g.fillStyle(0xf2c21b);
    g.fillTriangle(56, 12, 26, 52, 46, 52);
    g.fillTriangle(50, 44, 70, 44, 38, 86);
  });

  // ---- Chapter 2: Ares's training arena ----

  bake(TEXTURES.skyArena, 64, 720, () => {
    const top = Phaser.Display.Color.ValueToColor(0xf7b267);
    const bottom = Phaser.Display.Color.ValueToColor(0xfde4c4);
    const bands = 36;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, (720 / bands) * i, 64, 720 / bands + 1);
    }
  });

  bake(TEXTURES.arenaWall, 160, 370, () => {
    g.fillStyle(0xc9a27a); // tiers of stone seating
    g.fillRect(0, 0, 160, 370);
    g.fillStyle(0xb38b62);
    for (let y = 30; y < 370; y += 60) g.fillRect(0, y, 160, 14);
    g.fillStyle(0x8f6a45); // arches at the bottom
    g.fillRect(30, 270, 40, 100);
    g.fillRect(110, 270, 40, 100);
  });

  bake(TEXTURES.arenaGround, 128, 100, () => {
    g.fillStyle(0xe0b77c); // packed sand
    g.fillRect(0, 0, 128, 100);
    g.fillStyle(0xf0cf98);
    g.fillRect(0, 0, 128, 8);
    g.fillStyle(0xc99d62);
    g.fillCircle(30, 40, 3);
    g.fillCircle(90, 70, 3);
    g.fillCircle(60, 20, 2);
  });

  bake(TEXTURES.arenaExit, 110, 170, () => {
    g.fillStyle(0xd9c8b8);
    g.fillRect(0, 0, 110, 24);
    g.fillRect(0, 24, 20, 146);
    g.fillRect(90, 24, 20, 146);
    g.fillStyle(0xfff1c4); // the bright hub beyond
    g.fillRect(20, 24, 70, 146);
  });

  bake(TEXTURES.hazard, 64, 64, () => {
    g.fillStyle(0x3b3f45); // spiked bronze weight
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      g.fillTriangle(
        32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31,
        32 + Math.cos(a + 0.35) * 18, 32 + Math.sin(a + 0.35) * 18,
        32 + Math.cos(a - 0.35) * 18, 32 + Math.sin(a - 0.35) * 18,
      );
    }
    g.fillStyle(0xb3261e);
    g.fillCircle(32, 32, 21);
    g.fillStyle(0xd4af37);
    g.fillCircle(32, 32, 9);
  });

  bake(TEXTURES.finishLine, 140, 240, () => {
    g.fillStyle(0x7a5230); // two posts
    g.fillRect(0, 0, 14, 240);
    g.fillRect(126, 0, 14, 240);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        g.fillStyle((row + col) % 2 === 0 ? 0x111111 : 0xffffff); // checkered banner
        g.fillRect(14 + col * 16, row * 16, 16, 16);
      }
    }
  });

  bake(TEXTURES.sealCourage, 96, 96, () => {
    g.fillStyle(0xd4af37);
    g.fillCircle(48, 48, 46);
    g.fillStyle(0xb3261e);
    g.fillCircle(48, 48, 36);
    g.fillStyle(0xd4af37); // shield emblem
    g.fillCircle(48, 48, 20);
    g.fillStyle(0xb3261e);
    g.fillCircle(48, 48, 8);
  });

  // ---- Chapter 2: Hades's chamber ----

  bake(TEXTURES.skyUnderworld, 64, 720, () => {
    const top = Phaser.Display.Color.ValueToColor(0x0b0a1f);
    const bottom = Phaser.Display.Color.ValueToColor(0x2b1747);
    const bands = 36;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, bands - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, (720 / bands) * i, 64, 720 / bands + 1);
    }
  });

  bake(TEXTURES.underworldWall, 160, 400, () => {
    g.fillStyle(0x1c1a33); // dark masonry
    g.fillRect(0, 0, 160, 400);
    g.lineStyle(2, 0x14122a);
    for (let y = 0; y < 400; y += 50) g.lineBetween(0, y, 160, y);
    for (let y = 0; y < 400; y += 100) {
      g.lineBetween(40, y, 40, y + 50);
      g.lineBetween(120, y, 120, y + 50);
    }
    for (let y = 50; y < 400; y += 100) {
      g.lineBetween(80, y, 80, y + 50);
    }
    g.fillStyle(0x4b3a86, 0.35); // faint Greek-key band
    for (let x = 8; x < 160; x += 32) g.fillRect(x, 60, 16, 8);
  });

  bake(TEXTURES.underworldFloor, 128, 100, () => {
    g.fillStyle(0x24213d);
    g.fillRect(0, 0, 128, 100);
    g.fillStyle(0x4b3a86); // faintly lit top edge
    g.fillRect(0, 0, 128, 6);
    g.lineStyle(2, 0x171530);
    g.lineBetween(64, 6, 64, 100);
    g.lineBetween(0, 52, 128, 52);
  });

  bake(TEXTURES.underworldColumn, 90, 420, () => {
    g.fillStyle(0x3a3358);
    g.fillRect(0, 0, 90, 26);
    g.fillRect(0, 394, 90, 26);
    g.fillStyle(0x2c2748);
    g.fillRect(14, 26, 62, 368);
    g.lineStyle(3, 0x4b3a86);
    for (let x = 26; x <= 64; x += 12) g.lineBetween(x, 30, x, 390);
  });

  bake(TEXTURES.underworldExit, 110, 170, () => {
    g.fillStyle(0x3a3358);
    g.fillRect(0, 0, 110, 24);
    g.fillRect(0, 24, 20, 146);
    g.fillRect(90, 24, 20, 146);
    g.fillStyle(0xfff1c4); // the bright hub beyond
    g.fillRect(20, 24, 70, 146);
  });

  bake(TEXTURES.throne, 230, 330, () => {
    g.fillStyle(0x15122a); // tall back with pointed top
    g.fillRect(40, 60, 150, 220);
    g.fillTriangle(40, 60, 115, 0, 190, 60);
    g.fillStyle(0x4b3a86);
    g.fillRect(50, 70, 130, 8);
    g.fillStyle(0x2b2348); // seat and armrests
    g.fillRect(20, 200, 190, 40);
    g.fillRect(14, 170, 36, 70);
    g.fillRect(180, 170, 36, 70);
    g.fillStyle(0x3a3358); // base steps
    g.fillRect(0, 280, 230, 24);
    g.fillRect(14, 304, 202, 26);
    g.fillStyle(0x7fc4ff); // pale blue gem
    g.fillCircle(115, 40, 9);
  });

  bake(TEXTURES.brazier, 60, 130, () => {
    g.fillStyle(0x3a3358);
    g.fillRect(24, 60, 12, 62); // stand
    g.fillRect(10, 122, 40, 8);
    g.fillRoundedRect(6, 48, 48, 18, 6); // bowl
    g.fillStyle(0x3d7bff); // blue flame
    g.fillTriangle(30, 0, 14, 48, 46, 48);
    g.fillStyle(0xa5d3ff);
    g.fillTriangle(30, 18, 22, 48, 38, 48);
  });

  bake(TEXTURES.hades, 60, 108, () => {
    g.fillStyle(0x6a4bd8, 0.9); // crown of dark flame
    g.fillTriangle(14, 14, 20, -2, 26, 14);
    g.fillTriangle(25, 14, 30, -4, 35, 14);
    g.fillTriangle(34, 14, 40, -2, 46, 14);
    g.fillStyle(0xd9d6e8); // pale face
    g.fillCircle(30, 22, 12);
    g.fillStyle(0x15122a); // dark beard and eyes
    g.fillTriangle(20, 26, 40, 26, 30, 46);
    g.fillStyle(0x7fc4ff);
    g.fillRect(24, 19, 4, 3);
    g.fillRect(33, 19, 4, 3);
    g.fillStyle(0x3b2f7a); // long dark robes, lifted enough to read against the throne
    g.fillTriangle(30, 36, 4, 108, 56, 108);
    g.fillRoundedRect(12, 36, 36, 40, 6);
    g.fillStyle(0x4b3a86); // trim
    g.fillRect(12, 36, 36, 5);
    g.fillStyle(0x6b5a3a); // staff
    g.fillRect(52, 10, 3, 98);
    g.fillStyle(0x7fc4ff);
    g.fillCircle(53.5, 8, 5);
  });

  bake(TEXTURES.sealPassage, 96, 96, () => {
    g.fillStyle(0xd4af37);
    g.fillCircle(48, 48, 46);
    g.fillStyle(0x4b2d9a);
    g.fillCircle(48, 48, 36);
    g.fillStyle(0xd4af37); // open doorway emblem
    g.fillRect(36, 30, 24, 36);
    g.fillTriangle(36, 30, 48, 18, 60, 30);
    g.fillStyle(0x4b2d9a);
    g.fillRect(41, 38, 14, 28);
  });

  // ---- Zeus's palace gates in the hub ----

  const drawPalace = (open: boolean) => {
    g.fillStyle(open ? 0xf7f1e3 : 0xb9b4c4); // pediment and pillars
    g.fillTriangle(0, 90, 115, 0, 230, 90);
    g.fillRect(0, 90, 230, 24);
    g.fillRect(0, 114, 34, 216);
    g.fillRect(196, 114, 34, 216);
    g.fillStyle(open ? 0xd4af37 : 0x6f6a80); // doors
    g.fillRect(34, 114, 162, 216);
    g.lineStyle(4, open ? 0x8a6d12 : 0x4a4660);
    g.lineBetween(115, 114, 115, 330);
    g.strokeRect(34, 114, 162, 216);
    g.fillStyle(open ? 0xfff6d6 : 0x2e2b3d); // lightning emblem on the lintel
    g.fillTriangle(121, 20, 100, 58, 114, 58);
    g.fillTriangle(116, 52, 132, 52, 108, 84);
    // Three seal sockets: dark and empty while locked, glowing once all three seals are held.
    for (const [sx, color] of [[70, 0x3a5ba0], [115, 0xb3261e], [160, 0x4b2d9a]] as const) {
      g.fillStyle(open ? color : 0x15132a);
      g.fillCircle(sx, 200, 17);
      g.lineStyle(3, open ? 0xfff6d6 : 0x4a4660);
      g.strokeCircle(sx, 200, 17);
    }
    if (!open) {
      g.lineStyle(7, 0x3a3748); // chains across the doors
      g.lineBetween(34, 150, 196, 290);
      g.lineBetween(196, 150, 34, 290);
      g.fillStyle(0x3a3748);
      g.fillRoundedRect(98, 255, 34, 30, 5); // padlock
      g.lineStyle(6, 0x3a3748);
      g.strokeCircle(115, 252, 11);
    }
  };
  bake(TEXTURES.palaceLocked, 230, 330, () => drawPalace(false));
  bake(TEXTURES.palaceOpen, 230, 330, () => drawPalace(true));

  // ---- Chapter 3: Zeus's palace ----

  bake(TEXTURES.palaceWall, 160, 160, () => {
    g.fillStyle(0xf3ecdc); // cream marble
    g.fillRect(0, 0, 160, 160);
    g.lineStyle(2, 0xe0d7c1);
    g.strokeRect(0, 0, 80, 80);
    g.strokeRect(80, 80, 80, 80);
    g.lineStyle(2, 0xd9cfb5); // faint veins
    g.lineBetween(10, 30, 60, 55);
    g.lineBetween(100, 110, 150, 135);
    g.fillStyle(0xd4af37, 0.5); // golden band
    g.fillRect(0, 0, 160, 5);
  });

  bake(TEXTURES.palaceFloor, 128, 100, () => {
    g.fillStyle(0xf7f1e3);
    g.fillRect(0, 0, 128, 100);
    g.fillStyle(0xd4af37);
    g.fillRect(0, 0, 128, 6);
    g.lineStyle(2, 0xd9cfb5);
    g.lineBetween(64, 6, 64, 100);
    g.lineBetween(0, 53, 128, 53);
  });

  bake(TEXTURES.goldColumn, 90, 420, () => {
    g.fillStyle(0xd4af37);
    g.fillRect(0, 0, 90, 26);
    g.fillRect(0, 394, 90, 26);
    g.fillStyle(0xf3ecdc);
    g.fillRect(14, 26, 62, 368);
    g.fillStyle(0xd4af37);
    g.fillRect(14, 120, 62, 8);
    g.fillRect(14, 290, 62, 8);
    g.lineStyle(3, 0xe0d7c1);
    for (let x = 26; x <= 64; x += 12) g.lineBetween(x, 30, x, 390);
  });

  bake(TEXTURES.palaceExitDoor, 130, 210, () => {
    g.fillStyle(0xd4af37);
    g.fillRect(0, 0, 130, 28);
    g.fillRect(0, 28, 22, 182);
    g.fillRect(108, 28, 22, 182);
    g.fillStyle(0xcfe6ff); // the open air beyond
    g.fillRect(22, 28, 86, 182);
  });

  bake(TEXTURES.puzzleStatue, 76, 130, () => {
    g.fillStyle(0x8f949c); // plinth
    g.fillRect(6, 104, 64, 26);
    g.fillStyle(0xa9aeb6); // stone warrior
    g.fillCircle(38, 18, 14);
    g.fillRoundedRect(18, 32, 40, 62, 8);
    g.fillRect(8, 36, 12, 8);
    g.fillRect(56, 36, 12, 8);
    g.fillStyle(0x6e737b);
    g.fillRect(34, 8, 8, 12); // helmet crest
    g.lineStyle(2, 0x6e737b);
    g.lineBetween(38, 48, 38, 94);
  });

  const drawPlate = (on: boolean) => {
    g.fillStyle(on ? 0xd4af37 : 0x6e737b);
    g.fillRoundedRect(0, 0, 120, 16, 4);
    g.fillStyle(on ? 0xfff2b0 : 0x4a4f57);
    g.fillRoundedRect(10, 4, 100, 8, 3);
    g.fillStyle(on ? 0xffffff : 0x8f949c); // rune
    g.fillCircle(60, 8, 3);
  };
  bake(TEXTURES.plateOff, 120, 16, () => drawPlate(false));
  bake(TEXTURES.plateOn, 120, 16, () => drawPlate(true));

  bake(TEXTURES.puzzleLever, 50, 90, () => {
    g.fillStyle(0x8f949c); // stone post
    g.fillRect(8, 50, 34, 40);
    g.fillStyle(0x4a4f57);
    g.fillRect(20, 40, 10, 14);
    g.lineStyle(6, 0xd4af37); // handle
    g.lineBetween(25, 44, 40, 14);
    g.fillStyle(0xb3261e);
    g.fillCircle(40, 12, 7);
  });

  bake(TEXTURES.portcullis, 120, 420, () => {
    g.fillStyle(0x5b4a36);
    g.fillRect(0, 0, 120, 26);
    g.lineStyle(7, 0x3a3748);
    for (let x = 14; x <= 106; x += 23) g.lineBetween(x, 26, x, 420);
    for (let y = 80; y <= 400; y += 80) g.lineBetween(4, y, 116, y);
    g.fillStyle(0xd4af37);
    for (let x = 14; x <= 106; x += 23) g.fillTriangle(x, 420, x - 6, 400, x + 6, 400);
  });
  bake(TEXTURES.portcullisOpen, 120, 420, () => {
    g.fillStyle(0x5b4a36); // the grille raised into the lintel
    g.fillRect(0, 0, 120, 26);
    g.lineStyle(7, 0x3a3748);
    for (let x = 14; x <= 106; x += 23) g.lineBetween(x, 26, x, 78);
    g.fillStyle(0xd4af37);
    for (let x = 14; x <= 106; x += 23) g.fillTriangle(x, 82, x - 6, 62, x + 6, 62);
  });

  const drawGuard = (cx: number, crossed: boolean, facing: number) => {
    g.fillStyle(0xb08d2f); // helmet
    g.fillCircle(cx, 24, 14);
    g.fillStyle(0xb3261e);
    g.fillRect(cx - 7, 4, 14, 10);
    g.fillStyle(0xe2b893);
    g.fillRect(cx - 8, 24, 16, 10);
    g.fillStyle(0xb08d2f); // armour
    g.fillRoundedRect(cx - 18, 36, 36, 52, 6);
    g.fillStyle(0xb3261e);
    g.fillRect(cx - 16, 88, 32, 18);
    g.fillStyle(0xe2b893);
    g.fillRect(cx - 12, 106, 9, 40);
    g.fillRect(cx + 3, 106, 9, 40);
    g.lineStyle(5, 0x5b4a36); // spear
    if (crossed) g.lineBetween(cx - 30 * facing, 146, cx + 40 * facing, 8);
    else g.lineBetween(cx + 26 * facing, 146, cx + 26 * facing, 6);
    g.fillStyle(0xcfd4d8);
    const tipX = crossed ? cx + 40 * facing : cx + 26 * facing;
    g.fillTriangle(tipX, 0, tipX - 6, 16, tipX + 6, 16);
  };
  bake(TEXTURES.palaceGuards, 180, 150, () => {
    drawGuard(48, true, 1);
    drawGuard(132, true, -1);
  });
  bake(TEXTURES.palaceGuardsAside, 180, 150, () => {
    drawGuard(24, false, -1);
    drawGuard(156, false, 1);
  });

  const drawVaultDoor = (open: boolean) => {
    g.fillStyle(0xd4af37); // massive golden frame
    g.fillRect(0, 0, 240, 340);
    g.fillStyle(open ? 0xfff6c2 : 0xb8902a); // doors, or light spilling from within
    g.fillRect(24, 24, 192, 316);
    if (open) {
      g.fillStyle(0xffffff);
      g.fillRect(70, 24, 100, 316);
      g.fillStyle(0xb8902a); // doors swung back
      g.fillRect(24, 24, 22, 316);
      g.fillRect(194, 24, 22, 316);
    } else {
      g.lineStyle(5, 0x8a6d12);
      g.lineBetween(120, 24, 120, 340);
      g.strokeRect(24, 24, 192, 316);
    }
    for (const [sx, color] of [[60, 0x3a5ba0], [120, 0xb3261e], [180, 0x4b2d9a]] as const) {
      g.fillStyle(open ? color : 0x15132a);
      g.fillCircle(sx, 70, 18);
      g.lineStyle(3, open ? 0xfff6d6 : 0x8a6d12);
      g.strokeCircle(sx, 70, 18);
    }
  };
  bake(TEXTURES.vaultDoor, 240, 340, () => drawVaultDoor(false));
  bake(TEXTURES.vaultDoorOpen, 240, 340, () => drawVaultDoor(true));

  bake(TEXTURES.masterBolt, 110, 220, () => {
    const bolt = [
      { x: 68, y: 0 }, { x: 20, y: 98 }, { x: 52, y: 98 }, { x: 36, y: 220 },
      { x: 94, y: 84 }, { x: 60, y: 84 },
    ];
    g.fillStyle(0xf2c21b);
    g.fillPoints(bolt, true);
    g.fillStyle(0xffffff, 0.85); // bright core
    g.fillPoints([
      { x: 66, y: 22 }, { x: 36, y: 94 }, { x: 56, y: 94 }, { x: 46, y: 176 }, { x: 80, y: 88 }, { x: 58, y: 88 },
    ], true);
  });

  bake(TEXTURES.zeus, 110, 200, () => {
    g.fillStyle(0xf2f2f2); // white hair and beard
    g.fillCircle(55, 24, 22);
    g.fillTriangle(34, 34, 76, 34, 55, 76);
    g.fillStyle(0xe2b893);
    g.fillCircle(55, 28, 15);
    g.fillStyle(0xf2f2f2);
    g.fillTriangle(42, 36, 68, 36, 55, 62);
    g.fillStyle(0x7fc4ff); // eyes
    g.fillRect(47, 24, 4, 3);
    g.fillRect(59, 24, 4, 3);
    g.fillStyle(0x2f5fb0); // blue robes
    g.fillTriangle(55, 58, 6, 200, 104, 200);
    g.fillRoundedRect(22, 58, 66, 70, 8);
    g.fillStyle(0xd4af37); // gold sash
    g.fillRect(22, 90, 66, 8);
    g.fillStyle(0xe2b893);
    g.fillRect(8, 66, 14, 10);
    g.fillRect(88, 66, 14, 10);
    g.fillStyle(0xf2c21b); // crackling bolt in a raised hand
    g.fillTriangle(100, 10, 90, 44, 104, 44);
    g.fillTriangle(98, 40, 108, 40, 92, 70);
  });

  g.destroy();
}
