import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES, type SceneKey } from "../constants";
import { EventBus } from "../EventBus";
import { ARENA_INTERACTABLES } from "../data/interactables";
import { Hazard, type HazardConfig } from "../entities/Hazard";
import { Npc } from "../entities/Npc";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { consumePress } from "../input/keys";
import { hasFlag } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import { ARES_TRAINING_REWARD, CH2_FLAGS } from "../story/chapter2";
import { GameplayScene } from "./GameplayScene";
import { HUB_SPAWN_FROM_ARENA_X } from "./OlympusHub";

const WORLD_WIDTH = 2300;
const GROUND_Y = 620;
const START_X = 220;
/** Crossing this x completes the trial. */
const FINISH_X = 1980;

/** Pause after being hit, with "Try again!" on screen, before the player can move. */
const RESET_FREEZE_MS = 450;
/** Ignore further hits for this long after one, so a single contact resets once. */
const HIT_COOLDOWN_MS = 700;

/*
 * Hazard tuning. The player's collision box is 55.5 x 93.75 world px (top at GROUND_Y - 94),
 * a jump rises about 160 px, and the player walks 320 px/s.
 * - High (centre GROUND_Y - 175): the hazard's bottom is ~50 px above the player's head,
 *   so the player can walk underneath. holdHighMs plus the slow ease gives over a second.
 * - Low (centre GROUND_Y - 30): the hazard sits on the ground; the player can jump over it
 *   (feet stay above its top for ~210 px of horizontal travel; clearing needs ~110 px).
 */
const HAZARD_DEFAULTS = {
  highY: GROUND_Y - 175,
  lowY: GROUND_Y - 30,
  textureKey: TEXTURES.hazard,
  displaySize: 60,
  hitboxSize: 50,
  holdLowMs: 250,
} as const;

const HAZARDS: HazardConfig[] = [
  { ...HAZARD_DEFAULTS, x: 700, moveMs: 1300, holdHighMs: 1100, startDelayMs: 0 },
  { ...HAZARD_DEFAULTS, x: 1150, moveMs: 1100, holdHighMs: 950, startDelayMs: 700 },
  { ...HAZARD_DEFAULTS, x: 1600, moveMs: 1000, holdHighMs: 850, startDelayMs: 1300 },
];

/** Chapter 2: Ares's Trial of Courage. Reach the far end without touching a hazard. */
export class AresTraining extends GameplayScene {
  private hazards: Hazard[] = [];
  private finished = false;
  private hitCooldownUntil = 0;
  private frozenUntil = 0;
  private message!: Phaser.GameObjects.Text;
  private finishSeal!: Phaser.GameObjects.Image;
  /** Number of times the player was sent back to the start (handy for debugging/tests). */
  attempts = 0;

  constructor() {
    super(SCENES.ares);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.finished = false;
    this.hitCooldownUntil = 0;
    this.frozenUntil = 0;
    this.attempts = 0;

    this.buildBackdrop();
    const ground = this.buildGround();
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: START_X, ground });

    for (const def of Object.values(ARENA_INTERACTABLES)) {
      const exit = new Npc(this, def, GROUND_Y);
      exit.onInteract = () => {
        this.goToScene(SCENES.hub);
        return true;
      };
      this.interactions.register(exit);
    }

    this.hazards = HAZARDS.map((config) => {
      this.add
        .rectangle(config.x, config.highY, 6, config.lowY - config.highY, 0x5a1f1f, 0.35)
        .setOrigin(0.5, 0); // the hazard's track, so its motion reads at a glance
      return new Hazard(this, config).setDepth(5);
    });
    this.physics.add.overlap(this.player, this.hazards, () => this.onHazardHit());

    this.message = this.add
      .text(GAME_WIDTH / 2, 200, "", {
        fontFamily: "Georgia, serif",
        fontSize: "44px",
        color: "#ffffff",
        stroke: "#5a1f1f",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // Coming back after finishing: the trial stays complete and the hazards stay parked.
    if (hasFlag(CH2_FLAGS.aresTrainingComplete)) this.markFinished();
  }

  update(time: number): void {
    const frozen = this.time.now < this.frozenUntil;
    // Presses made during the freeze are dropped instead of firing when it ends.
    if (frozen) consumePress(this.keys, "jump");
    this.tickGameplay(time, frozen);

    if (!this.finished && this.player.x >= FINISH_X) this.completeTrial();
  }

  protected sceneStartData(key: SceneKey): object | undefined {
    // Back in the hub, appear beside the arena gate instead of at the hub's start.
    return key === SCENES.hub ? { spawnX: HUB_SPAWN_FROM_ARENA_X } : undefined;
  }

  private onHazardHit(): void {
    const now = this.time.now;
    if (this.finished || now < this.hitCooldownUntil) return;
    this.hitCooldownUntil = now + HIT_COOLDOWN_MS;
    this.frozenUntil = now + RESET_FREEZE_MS;
    this.attempts += 1;

    // reset() moves the sprite and its body together and zeroes velocity.
    this.player.body.reset(START_X, GROUND_Y);
    this.player.halt();
    this.cameras.main.shake(150, 0.004);
    this.flashMessage("Try again!");
  }

  private completeTrial(): void {
    // The arena is only reachable after Ares's introduction; this guards any other way in.
    if (!hasFlag(CH2_FLAGS.aresIntroComplete)) return;
    applyStoryActions(ARES_TRAINING_REWARD);
    this.markFinished();
    this.player.halt();
    EventBus.emit("challenge:complete", { challengeId: "aresTraining" });
  }

  private markFinished(): void {
    this.finished = true;
    for (const hazard of this.hazards) hazard.stop();
    this.finishSeal.setVisible(true);
    this.message.setText("Trial complete").setVisible(true).setAlpha(1);
  }

  private flashMessage(text: string): void {
    this.tweens.killTweensOf(this.message);
    this.message.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.message, alpha: 0, delay: 500, duration: 400 });
  }

  private buildBackdrop(): void {
    this.add
      .image(0, 0, TEXTURES.skyArena)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0);
    // Arena stands behind the course.
    this.add.tileSprite(0, 250, WORLD_WIDTH, GROUND_Y - 250, TEXTURES.arenaWall).setOrigin(0).setScrollFactor(0.6, 1);

    const label = (x: number, y: number, text: string, size = 22) =>
      this.add
        .text(x, y, text, {
          fontFamily: "Georgia, serif",
          fontSize: `${size}px`,
          color: "#ffffff",
          stroke: "#5a1f1f",
          strokeThickness: 5,
          align: "center",
        })
        .setOrigin(0.5, 1);

    // Fixed to the screen, right of the quest tracker.
    label(GAME_WIDTH / 2 + 170, 80, "Arena of Ares: The Trial of Courage", 30).setScrollFactor(0);
    this.add.rectangle(START_X, GROUND_Y, 8, 70, 0xf6f1e7).setOrigin(0.5, 1);
    label(START_X, GROUND_Y - 140, "START");

    this.add.image(FINISH_X, GROUND_Y, TEXTURES.finishLine).setOrigin(0.5, 1).setDisplaySize(140, 240);
    label(FINISH_X, GROUND_Y - 250, "FINISH");
    this.finishSeal = this.add
      .image(FINISH_X, GROUND_Y - 330, TEXTURES.sealCourage)
      .setDisplaySize(72, 72)
      .setVisible(false);
  }

  /** Visual ground strip plus one static physics body whose top edge is GROUND_Y. */
  private buildGround(): Phaser.GameObjects.TileSprite {
    const ground = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y, TEXTURES.arenaGround)
      .setOrigin(0);
    this.physics.add.existing(ground, true);
    return ground;
  }
}
