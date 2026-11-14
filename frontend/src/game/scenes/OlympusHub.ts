import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "../constants";
import { HUB_INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { getGameState, subscribe } from "../state/gameState";
import { CH2_FLAGS } from "../story/chapter2";
import { GameplayScene } from "./GameplayScene";

const WORLD_WIDTH = 4400;
const GROUND_Y = 620;

/** Athena's library is the enclosed part of the same scene, from the door to the end of the world. */
const LIBRARY = { doorX: 3000, endX: WORLD_WIDTH, wallTop: 150 };
/** Invisible wall at the library door until Athena opens it. Independent of the door art. */
const LIBRARY_BARRIER = { x: LIBRARY.doorX, width: 40 };

const COLUMN_XS = [420, 1500, 2000, 2500];
/** One-way marble terraces over the plaza: jump up through them, stand on top. */
const PLATFORMS = [
  { x: 950, y: 500, width: 256 },
  { x: 1250, y: 400, width: 256 },
];
/** Wall plaques in the library. Deliberately not in the solution order. */
const PLAQUES = [
  { x: 3540, texture: TEXTURES.symbolBolt, label: "Lightning Bolt\nPower" },
  { x: 3690, texture: TEXTURES.symbolOwl, label: "Owl\nWisdom" },
  { x: 4010, texture: TEXTURES.symbolShield, label: "Shield\nCourage" },
  { x: 4160, texture: TEXTURES.symbolOlive, label: "Olive Branch\nPeace" },
];
const BOOKSHELF_XS = [3190, 3370, 4310];

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "Georgia, serif",
  fontSize: "20px",
  color: "#3b2a4a",
  stroke: "#ffffff",
  strokeThickness: 4,
  align: "center",
};
const LIBRARY_LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  ...LABEL_STYLE,
  fontSize: "17px",
  color: "#f6f1e7",
  stroke: "#2c2233",
};

/** Chapter 2: the heart of Olympus, with Athena's library at its far end. */
export class OlympusHub extends GameplayScene {
  private libraryDoor!: Phaser.GameObjects.Image;
  private libraryBarrier!: Phaser.GameObjects.Zone;
  private sealEmblem!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.hub);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.buildHubBackdrop();
    this.buildLibrary();
    const ground = this.buildGround();
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: 200, ground });

    for (const { x, y, width } of PLATFORMS) {
      const platform = this.add.tileSprite(x, y, width, 20, TEXTURES.marblePlatform).setOrigin(0);
      this.physics.add.existing(platform, true);
      const body = platform.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.physics.add.collider(this.player, platform);
    }

    // Full-height wall at the library door, so it cannot be jumped over while locked.
    this.libraryBarrier = this.add.zone(LIBRARY_BARRIER.x, GROUND_Y / 2, LIBRARY_BARRIER.width, GROUND_Y);
    this.physics.add.existing(this.libraryBarrier, true);
    this.physics.add.collider(this.player, this.libraryBarrier);

    for (const def of Object.values(HUB_INTERACTABLES)) {
      this.interactions.register(new Npc(this, def, GROUND_Y));
    }

    // The story state lives in the gameState module; the scene only mirrors it.
    this.applyStoryState();
    this.addCleanup(subscribe(() => this.applyStoryState()));
  }

  update(time: number): void {
    this.tickGameplay(time);
  }

  /** Makes the world match the story state. Runs at start and on every state change. */
  private applyStoryState(): void {
    const { flags, seals } = getGameState();
    const libraryOpen = flags[CH2_FLAGS.athenaIntroComplete] === true;

    this.libraryDoor.setTexture(libraryOpen ? TEXTURES.libraryDoorOpen : TEXTURES.libraryDoor);
    (this.libraryBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = !libraryOpen;
    this.sealEmblem.setVisible(seals.athena);
  }

  private buildHubBackdrop(): void {
    this.add
      .image(0, 0, TEXTURES.skyOlympus)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0);

    const clouds: Array<[number, number, number]> = [
      [200, 120, 1.3], [640, 220, 0.9], [1050, 100, 1.1], [1500, 240, 1.4], [1900, 140, 1],
    ];
    for (const [x, y, scale] of clouds) {
      this.add.image(x, y, TEXTURES.cloud).setScale(scale).setScrollFactor(0.3).setAlpha(0.8);
    }

    // The gate the player came through, then the central plaza.
    this.add.image(60, GROUND_Y, TEXTURES.gateOpen).setOrigin(0.5, 1);
    this.add.image(1230, GROUND_Y, TEXTURES.temple).setOrigin(0.5, 1).setDisplaySize(780, 520);
    this.add.image(700, GROUND_Y, TEXTURES.fountain).setOrigin(0.5, 1);
    this.add.text(700, GROUND_Y - 170, "Agora of the Gods", LABEL_STYLE).setOrigin(0.5, 1);

    for (const x of COLUMN_XS) {
      this.add.image(x, GROUND_Y, TEXTURES.column).setOrigin(0.5, 1);
    }
  }

  private buildLibrary(): void {
    const { doorX, endX, wallTop } = LIBRARY;
    const width = endX - doorX;

    // Interior wall and roof, drawn over the sky so the area reads as indoors.
    this.add.tileSprite(doorX, wallTop, width, GROUND_Y - wallTop, TEXTURES.libraryWall).setOrigin(0);
    this.add.rectangle(doorX - 30, wallTop - 40, width + 30, 40, 0xf7f1e3).setOrigin(0);
    this.add.rectangle(doorX - 30, wallTop - 6, width + 30, 6, 0xd4af37).setOrigin(0);

    for (const x of BOOKSHELF_XS) {
      this.add.image(x, GROUND_Y, TEXTURES.bookshelf).setOrigin(0.5, 1).setDisplaySize(160, 340);
    }
    for (const { x, texture, label } of PLAQUES) {
      this.add.image(x, 330, texture).setDisplaySize(96, 96);
      this.add.text(x, 390, label, LIBRARY_LABEL_STYLE).setOrigin(0.5, 0);
    }
    this.add.text(3850, 250, "Four symbols, one order.", LIBRARY_LABEL_STYLE).setOrigin(0.5, 1);

    // The reward appears above the pedestal once the seal is earned.
    this.sealEmblem = this.add.image(3850, 400, TEXTURES.seal).setDisplaySize(72, 72).setVisible(false);
    this.tweens.add({
      targets: this.sealEmblem,
      y: 388,
      duration: 1200,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    this.libraryDoor = this.add
      .image(doorX, GROUND_Y, TEXTURES.libraryDoor)
      .setOrigin(0.5, 1)
      .setDisplaySize(200, 340);
    this.add.text(doorX, GROUND_Y - 350, "Athena's Library", LABEL_STYLE).setOrigin(0.5, 1);
    this.add.text(doorX + 190, 240, "← Exit to Olympus", LIBRARY_LABEL_STYLE).setOrigin(0.5, 1);
  }

  /** Visual ground strip plus one static physics body whose top edge is GROUND_Y. */
  private buildGround(): Phaser.GameObjects.TileSprite {
    const height = GAME_HEIGHT - GROUND_Y;
    const ground = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, height, TEXTURES.ground)
      .setOrigin(0);
    this.physics.add.existing(ground, true);
    return ground;
  }
}
