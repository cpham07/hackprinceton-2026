import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "../constants";
import { ENTRANCE_INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { addBackground, BACKGROUNDS, preloadBackground } from "../graphics/backgrounds";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { getGameState, hasFlag, subscribe } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import { CHAPTER_1_COMPLETE_ACTIONS, FLAGS } from "../story/chapter1";
import { GameplayScene } from "./GameplayScene";

const WORLD_WIDTH = 3840;
const GROUND_Y = 620; // y of the walkable surface
const GATE_X = 3350;
/** Invisible wall in front of the gate doors while the gate is locked. Independent of the gate art. */
const GATE_BARRIER = { x: 3250, width: 40 };
/** Crossing this x (beyond the gate) completes the chapter. */
const EXIT_X = 3520;
const COLUMN_XS = [500, 950, 1400, 1850, 2300, 2650];

/** Chapter 1: the entrance to Olympus. */
export class OlympusEntrance extends GameplayScene {
  private gate!: Phaser.GameObjects.Image;
  private gateBarrier!: Phaser.GameObjects.Zone;
  private gatekeeper!: Npc;
  private gatekeeperZzz!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.entrance);
  }

  preload(): void {
    super.preload();
    preloadBackground(this, BACKGROUNDS.chapter1);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.buildBackdrop();
    const ground = this.buildGround();
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: 200, ground });

    // Full-height static wall (y = 0 to GROUND_Y), so the locked gate cannot be jumped over.
    this.gateBarrier = this.add.zone(GATE_BARRIER.x, GROUND_Y / 2, GATE_BARRIER.width, GROUND_Y);
    this.physics.add.existing(this.gateBarrier, true);
    this.physics.add.collider(this.player, this.gateBarrier);

    for (const def of Object.values(ENTRANCE_INTERACTABLES)) {
      const entity = new Npc(this, def, GROUND_Y);
      this.interactions.register(entity);
      if (def.id === "gatekeeper") this.gatekeeper = entity;
    }
    this.gatekeeperZzz = this.add
      .text(this.gatekeeper.x + 30, this.gatekeeper.promptY + 40, "Z z z", {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#3b2a4a",
        strokeThickness: 4,
      })
      .setVisible(false);

    // The story state lives in the gameState module; the scene only mirrors it.
    this.applyStoryState();
    this.addCleanup(subscribe(() => this.applyStoryState()));
  }

  update(time: number): void {
    const chapterComplete = hasFlag(FLAGS.chapter1Complete);
    this.tickGameplay(time, chapterComplete);

    // Fires once: the actions set chapter1Complete, which makes this condition false.
    if (!chapterComplete && hasFlag(FLAGS.gateOpen) && this.player.x >= EXIT_X) {
      applyStoryActions(CHAPTER_1_COMPLETE_ACTIONS);
    }
  }

  protected canInteract(): boolean {
    return !hasFlag(FLAGS.chapter1Complete);
  }

  /** Makes the world match the story state. Runs at start and on every state change. */
  private applyStoryState(): void {
    const { flags } = getGameState();
    const gateOpen = flags[FLAGS.gateOpen] === true;
    const asleep = flags[FLAGS.gatekeeperAsleep] === true;

    this.gate.setTexture(gateOpen ? TEXTURES.gateOpen : TEXTURES.gate);
    (this.gateBarrier.body as Phaser.Physics.Arcade.StaticBody).enable = !gateOpen;

    this.gatekeeper.setTexture(asleep ? TEXTURES.gatekeeperAsleep : TEXTURES.gatekeeper);
    this.gatekeeperZzz.setVisible(asleep);

    if (flags[FLAGS.chapter1Complete] === true) this.player.halt();
    this.refreshInteractions();
  }

  private buildBackdrop(): void {
    // The painted background is visual only; the ground and barriers below are the real collision.
    const painted = addBackground(this, BACKGROUNDS.chapter1, { worldWidth: WORLD_WIDTH, groundY: GROUND_Y });
    if (!painted) {
      // Placeholder sky and clouds, used if the painting failed to load.
      this.add
        .image(0, 0, TEXTURES.sky)
        .setOrigin(0)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setScrollFactor(0);

      const clouds: Array<[number, number, number]> = [
        [150, 110, 1.2], [520, 200, 0.8], [900, 90, 1], [1300, 230, 1.4],
        [1700, 130, 0.9], [2050, 210, 1.1], [2400, 100, 1.3],
      ];
      for (const [x, y, scale] of clouds) {
        this.add.image(x, y, TEXTURES.cloud).setScale(scale).setScrollFactor(0.3);
      }
    }

    for (const x of COLUMN_XS) {
      this.add.image(x, GROUND_Y, TEXTURES.column).setOrigin(0.5, 1);
    }
    this.gate = this.add.image(GATE_X, GROUND_Y, TEXTURES.gate).setOrigin(0.5, 1);
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
