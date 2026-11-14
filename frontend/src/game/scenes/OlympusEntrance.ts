import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { EventBus } from "../EventBus";
import { INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { Player } from "../entities/Player";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import {
  captureGameplayKeys,
  clearPresses,
  consumePress,
  createGameplayKeys,
  releaseGameplayKeys,
  type GameplayKeys,
} from "../input/keys";
import { getGameState, hasFlag, subscribe } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import { CHAPTER_1_COMPLETE_ACTIONS, FLAGS } from "../story/chapter1";
import { InteractionManager } from "../systems/InteractionManager";

const WORLD_WIDTH = 3840;
const GROUND_Y = 620; // y of the walkable surface
const GATE_X = 3350;
/** Invisible wall in front of the gate doors while the gate is locked. Independent of the gate art. */
const GATE_BARRIER = { x: 3250, width: 40 };
/** Crossing this x (beyond the gate) completes the chapter. */
const EXIT_X = 3520;
const COLUMN_XS = [500, 950, 1400, 1850, 2300, 2650];

export class OlympusEntrance extends Phaser.Scene {
  private player!: Player;
  private keys!: GameplayKeys;
  private interactions!: InteractionManager;
  private dialogueOpen = false;
  private gate!: Phaser.GameObjects.Image;
  private gateBarrier!: Phaser.GameObjects.Zone;
  private gatekeeper!: Npc;
  private gatekeeperZzz!: Phaser.GameObjects.Text;

  constructor() {
    super("OlympusEntrance");
  }

  preload(): void {
    Player.preload(this);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.dialogueOpen = false;

    this.buildBackdrop();
    const ground = this.buildGround();

    this.player = new Player(this, 200, GROUND_Y);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, ground);

    // Full-height static wall (y = 0 to GROUND_Y), so the locked gate cannot be jumped over.
    this.gateBarrier = this.add.zone(GATE_BARRIER.x, GROUND_Y / 2, GATE_BARRIER.width, GROUND_Y);
    this.physics.add.existing(this.gateBarrier, true);
    this.physics.add.collider(this.player, this.gateBarrier);

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    const keyboard = this.input.keyboard!;
    this.keys = createGameplayKeys(keyboard);
    captureGameplayKeys(keyboard);

    this.interactions = new InteractionManager(this, this.player, () =>
      consumePress(this.keys, "interact"),
    );
    for (const def of Object.values(INTERACTABLES)) {
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

    const unsubscribe = [
      EventBus.on("dialogue:opened", () => this.setDialogueOpen(true)),
      EventBus.on("dialogue:closed", () => this.setDialogueOpen(false)),
      subscribe(() => this.applyStoryState()),
    ];
    const unsubscribeAll = () => unsubscribe.splice(0).forEach((off) => off());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeAll();
      // The capture list is global to the game, so don't leave ours behind for the next scene.
      releaseGameplayKeys(keyboard);
    });
    // On destroy the whole game (and its keyboard manager) is going away: only drop listeners.
    this.events.once(Phaser.Scenes.Events.DESTROY, unsubscribeAll);
  }

  update(time: number): void {
    const chapterComplete = hasFlag(FLAGS.chapter1Complete);
    this.player.tick(this.dialogueOpen || chapterComplete ? null : this.keys, time);
    this.interactions.update();

    // Fires once: the actions set chapter1Complete, which makes this condition false.
  if (
    !chapterComplete &&
    hasFlag(FLAGS.gateOpen) &&
    this.player.x >= EXIT_X
  ) {
    applyStoryActions(CHAPTER_1_COMPLETE_ACTIONS);
    }
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

    if (flags[FLAGS.chapter1Complete] === true) {
      this.player.halt();
      this.interactions.setEnabled(false);
    }
  }

  /** Hands the keyboard to React while the dialogue is open, and takes it back after. */
  private setDialogueOpen(open: boolean): void {
    if (open === this.dialogueOpen) return;
    this.dialogueOpen = open;
    const keyboard = this.input.keyboard!;

    if (open) {
      this.player.halt();
      this.interactions.setEnabled(false);
      releaseGameplayKeys(keyboard);
      keyboard.resetKeys();
      clearPresses(this.keys);
      keyboard.enabled = false;
    } else {
      keyboard.enabled = true;
      keyboard.resetKeys();
      clearPresses(this.keys);
      captureGameplayKeys(keyboard);
      this.interactions.setEnabled(!hasFlag(FLAGS.chapter1Complete));
    }
  }

  private buildBackdrop(): void {
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
