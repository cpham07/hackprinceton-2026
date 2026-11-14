import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { EventBus } from "../EventBus";
import { NPCS } from "../data/npcs";
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
import { InteractionManager } from "../systems/InteractionManager";

const WORLD_WIDTH = 3840;
const GROUND_Y = 620; // y of the walkable surface
const GATE_X = 3350;
const COLUMN_XS = [500, 950, 1400, 1850, 2300, 2650];

export class OlympusEntrance extends Phaser.Scene {
  private player!: Player;
  private keys!: GameplayKeys;
  private interactions!: InteractionManager;
  private dialogueOpen = false;

  constructor() {
    super("OlympusEntrance");
  }

  create(): void {
    createPlaceholderTextures(this);
    this.dialogueOpen = false;

    this.buildBackdrop();
    const ground = this.buildGround();

    this.player = new Player(this, 200, GROUND_Y);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, ground);

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    const keyboard = this.input.keyboard!;
    this.keys = createGameplayKeys(keyboard);
    captureGameplayKeys(keyboard);

    this.interactions = new InteractionManager(this, this.player, () =>
      consumePress(this.keys, "interact"),
    );
    this.interactions.register(new Npc(this, NPCS.aphrodite, GROUND_Y));

    const unsubscribe = [
      EventBus.on("dialogue:opened", () => this.setDialogueOpen(true)),
      EventBus.on("dialogue:closed", () => this.setDialogueOpen(false)),
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
    this.player.tick(this.dialogueOpen ? null : this.keys, time);
    this.interactions.update();
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
      this.interactions.setEnabled(true);
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
    this.add.image(GATE_X, GROUND_Y, TEXTURES.gate).setOrigin(0.5, 1);
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
