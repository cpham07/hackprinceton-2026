import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "../constants";
import { EventBus } from "../EventBus";
import { BETRAYAL_INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { GOD_SCALE, HELD_BOLT_PLACEHOLDER_OFFSET } from "../graphics/characterArt";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { getGameState, hasItem, subscribe } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import {
  APHRODITE_NECKLACE,
  CH4_FLAGS,
  CHAPTER_4_ENTERED,
  completeChapter4IfReady,
  isImmobilized,
  nextChapter4Beat,
  type Chapter4Beat,
} from "../story/chapter4";
import { GameplayScene } from "./GameplayScene";

const WORLD_WIDTH = 2000;
const GROUND_Y = 620;
const START_X = 330; // just outside the palace gate the player escaped through
const PALACE_X = 160;
const ZEUS_X = BETRAYAL_INTERACTABLES.zeus.x;

/** Pause after the previous dialogue closes before each beat, so its effects can be seen. */
const BEAT_DELAY_MS: Record<Chapter4Beat, number> = { reveal: 600, imprison: 1300, rescue: 1700, complete: 1000 };
const DARKNESS = { base: 0.12, betrayed: 0.3, imprisoned: 0.42 };

interface StoryMoments {
  surrendered: boolean;
  revealed: boolean;
  imprisoned: boolean;
  rescued: boolean;
}

/**
 * Chapter 4: the steps outside Zeus's palace. Aphrodite asks for the bolt, betrays the player,
 * imprisons Zeus and leaves; Athena and Ares break the necklace's hold.
 *
 * Everything that matters lives in the story state; this scene only plays it back. Each beat after the
 * handover opens its scripted dialogue automatically once (the same lines are also reachable with E).
 * The player is held still only while `isImmobilized(state)` is true, and the rescuers always arrive
 * next to wherever the player stands, so the rescue can never be out of reach.
 */
export class OlympusBetrayal extends GameplayScene {
  private aphrodite!: Npc;
  private zeus!: Npc;
  private athena!: Npc;
  private ares!: Npc;
  private necklaceGlow!: Phaser.GameObjects.Image;
  private heldBolt!: Phaser.GameObjects.Image;
  private cage!: Phaser.GameObjects.Image;
  private darkness!: Phaser.GameObjects.Rectangle;
  private seen!: StoryMoments;
  private zeusShown = false;
  private rescuersArrived = false;
  private aphroditeGone = false;
  private aphroditeLeaving = false;
  private autoStarted = new Set<Chapter4Beat>();
  private beatPending = false;
  /** After auto-opening a beat's dialogue, wait for it to open and close before starting the next beat. */
  private awaitingDialogue = false;
  private dialogueSeenOpen = false;
  private awaitingSince = 0;

  constructor() {
    super(SCENES.betrayal);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.zeusShown = false;
    this.rescuersArrived = false;
    this.aphroditeGone = false;
    this.aphroditeLeaving = false;
    this.autoStarted = new Set();
    this.beatPending = false;
    this.awaitingDialogue = false;
    this.dialogueSeenOpen = false;

    this.buildBackdrop();
    const ground = this.buildGround();
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: START_X, ground });

    for (const def of Object.values(BETRAYAL_INTERACTABLES)) {
      const npc = new Npc(this, def, GROUND_Y);
      this.interactions.register(npc);
      if (def.id === "aphrodite") this.aphrodite = npc;
      if (def.id === "zeus") this.zeus = npc;
      if (def.id === "athena") this.athena = npc;
      if (def.id === "ares") this.ares = npc;
    }

    this.cage = this.add.image(ZEUS_X, GROUND_Y, TEXTURES.goldenCage).setOrigin(0.5, 1).setDisplaySize(170 * GOD_SCALE, 250 * GOD_SCALE).setDepth(6).setVisible(false);
    const hand = this.aphrodite.holdPoint(HELD_BOLT_PLACEHOLDER_OFFSET); // her art's hand point, if she has art
    this.heldBolt = this.add
      .image(hand.x, hand.y, TEXTURES.masterBolt)
      .setDisplaySize(30, 60)
      .setDepth(6)
      .setVisible(false);
    this.necklaceGlow = this.add
      .image(0, 0, TEXTURES.glow)
      .setTint(0xff7ad9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(70, 70)
      .setDepth(11)
      .setVisible(false);
    this.tweens.add({ targets: this.necklaceGlow, alpha: 0.45, duration: 520, yoyo: true, repeat: -1 });
    this.darkness = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a0b2e)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(40)
      .setAlpha(DARKNESS.base);

    applyStoryActions(CHAPTER_4_ENTERED);

    // Moments already in the past are shown as they are now, without replaying their effects.
    this.seen = this.moments();
    this.zeusShown = this.seen.imprisoned;
    this.aphroditeGone = this.seen.imprisoned;
    if (this.seen.imprisoned) this.placeRescuers(false);

    this.applyStoryState();
    this.addCleanup(subscribe(() => this.applyStoryState()));
  }

  update(time: number): void {
    this.tickGameplay(time, isImmobilized(getGameState()));
    if (this.necklaceGlow.visible) this.necklaceGlow.setPosition(this.player.x, this.player.y - 54);
    this.advanceStory();
  }

  private moments(): StoryMoments {
    const { flags } = getGameState();
    return {
      surrendered: flags[CH4_FLAGS.boltSurrendered] === true,
      revealed: flags[CH4_FLAGS.betrayalRevealed] === true,
      imprisoned: flags[CH4_FLAGS.zeusImprisoned] === true,
      rescued: flags[CH4_FLAGS.playerRescued] === true,
    };
  }

  /**
   * Starts the next beat once the previous dialogue has closed. Each beat's dialogue is opened
   * automatically once; if a dialogue happens to be open when it is due, it simply waits and retries.
   */
  private advanceStory(): void {
    if (this.awaitingDialogue) {
      // The request is answered by React a frame or two later (and its line may already have changed
      // the state). Do not start the next beat until that dialogue has actually been seen open and closed.
      if (this.isInputLocked()) this.dialogueSeenOpen = true;
      else if (this.dialogueSeenOpen || this.time.now - this.awaitingSince > 1500) {
        this.awaitingDialogue = false;
        this.dialogueSeenOpen = false;
      }
      return;
    }
    if (this.beatPending || this.isInputLocked()) return;
    const beat = nextChapter4Beat(getGameState());
    if (!beat || this.autoStarted.has(beat)) return;
    this.beatPending = true;
    if (beat === "imprison") this.showZeus();
    if (beat === "rescue") this.placeRescuers(true);

    this.time.delayedCall(BEAT_DELAY_MS[beat], () => {
      this.beatPending = false;
      // Not due any more (the player got there first with E), or a dialogue is open: try again later.
      if (nextChapter4Beat(getGameState()) !== beat || this.isInputLocked()) return;
      this.autoStarted.add(beat);
      if (beat === "complete") {
        completeChapter4IfReady();
        return;
      }
      this.awaitingDialogue = true;
      this.awaitingSince = this.time.now;
      EventBus.emit("dialogue:request", { npcId: beat === "rescue" ? "athena" : "aphrodite" });
    });
  }

  /** Makes the world match the story state, and plays an effect when a moment happens now. */
  private applyStoryState(): void {
    const now = this.moments();
    if (now.revealed && !this.seen.revealed) this.playBetrayal();
    if (now.imprisoned && !this.seen.imprisoned) this.playImprisonment();
    if (now.rescued && !this.seen.rescued) this.playRescue();
    this.seen = now;

    // While she flies off, the departure tween owns her sprite.
    if (!this.aphroditeLeaving) this.aphrodite.setPresent(!this.aphroditeGone);
    this.heldBolt.setVisible(now.surrendered && !now.imprisoned);

    this.zeus.setPresent(this.zeusShown || now.imprisoned);
    this.zeus.interactionEnabled = now.imprisoned; // nothing to say to him before the cage
    if (now.imprisoned) this.zeus.setTint(0xb8b0d8);
    this.cage.setVisible(now.imprisoned);

    this.athena.setPresent(this.rescuersArrived);
    this.ares.setPresent(this.rescuersArrived);

    this.necklaceGlow.setVisible(hasItem(APHRODITE_NECKLACE));
    const held = isImmobilized(getGameState());
    this.necklaceGlow.setDisplaySize(held ? 120 : 60, held ? 120 : 60);
    if (held) this.player.setTint(0xe3b8ff);
    else this.player.clearTint();

    const darkness = now.imprisoned ? DARKNESS.imprisoned : now.revealed ? DARKNESS.betrayed : DARKNESS.base;
    if (this.darkness.alpha !== darkness) {
      this.tweens.killTweensOf(this.darkness);
      this.tweens.add({ targets: this.darkness, alpha: darkness, duration: 900 });
    }
  }

  private playBetrayal(): void {
    this.player.halt();
    this.cameras.main.flash(450, 170, 70, 255); // purple
    this.time.delayedCall(260, () => this.cameras.main.flash(380, 255, 215, 90)); // then gold
    this.cameras.main.shake(380, 0.006);
  }

  private showZeus(): void {
    if (this.zeusShown) return;
    this.zeusShown = true;
    this.zeus.setPresent(true);
    this.zeus.interactionEnabled = false;
    this.zeus.setAlpha(0);
    this.tweens.add({ targets: this.zeus, alpha: 1, duration: 700 });
  }

  private playImprisonment(): void {
    this.cameras.main.flash(500, 255, 230, 140);
    this.cameras.main.shake(500, 0.01);
    const strike = this.add
      .image(ZEUS_X, GROUND_Y - 260, TEXTURES.masterBolt)
      .setDisplaySize(90, 520)
      .setDepth(45)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: strike, alpha: 0, duration: 700, onComplete: () => strike.destroy() });
    const fullScaleY = this.cage.scaleY;
    this.cage.setScale(this.cage.scaleX, 0.01);
    this.tweens.add({ targets: this.cage, scaleY: fullScaleY, duration: 450, ease: "Back.easeOut" });

    // Aphrodite rises into the dark sky and is gone.
    this.aphroditeGone = true;
    this.aphroditeLeaving = true;
    this.aphrodite.setPresent(false);
    this.aphrodite.setVisible(true);
    this.tweens.add({
      targets: [this.aphrodite, this.heldBolt],
      y: "-=420",
      alpha: 0,
      duration: 1600,
      ease: "Sine.easeIn",
      onComplete: () => {
        this.aphroditeLeaving = false;
        this.aphrodite.setVisible(false);
      },
    });
  }

  private playRescue(): void {
    this.cameras.main.flash(350, 255, 200, 230);
    const sparks = this.add
      .image(this.player.x, this.player.y - 54, TEXTURES.glow)
      .setTint(0xff7ad9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(80, 80)
      .setDepth(12);
    this.tweens.add({ targets: sparks, scale: sparks.scale * 4, alpha: 0, duration: 650, onComplete: () => sparks.destroy() });
  }

  /** Athena and Ares land beside the player, wherever the player is held. */
  private placeRescuers(animate: boolean): void {
    if (this.rescuersArrived) return;
    this.rescuersArrived = true;
    const side = this.player.x + 260 < WORLD_WIDTH - 40 ? 1 : -1;
    const spots: Array<[Npc, number]> = [
      [this.athena, this.player.x + side * 120],
      [this.ares, this.player.x + side * 215],
    ];
    for (const [npc, x] of spots) {
      npc.setPresent(true);
      if (!animate) {
        npc.setX(x).syncAttachments();
        continue;
      }
      npc.setX(x + side * 700).syncAttachments();
      this.tweens.add({ targets: npc, x, duration: 900, ease: "Cubic.easeOut", onUpdate: () => npc.syncAttachments() });
    }
  }

  private buildBackdrop(): void {
    this.add
      .image(0, 0, TEXTURES.skyOlympus)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setTint(0x9a8cc4); // a dusky, wrong-feeling sky
    for (const [x, y, scale] of [[200, 120, 1.2], [700, 200, 0.9], [1300, 110, 1.1], [1800, 210, 1.3]] as const) {
      this.add.image(x, y, TEXTURES.cloud).setScale(scale).setScrollFactor(0.3).setAlpha(0.55).setTint(0xb7a9d6);
    }
    this.add.image(PALACE_X, GROUND_Y, TEXTURES.palaceOpen).setOrigin(0.5, 1).setDisplaySize(260, 370);
    this.add.image(1500, GROUND_Y, TEXTURES.temple).setOrigin(0.5, 1).setDisplaySize(680, 460).setTint(0xd8d0ec);
    this.add.image(1250, GROUND_Y, TEXTURES.fountain).setOrigin(0.5, 1).setTint(0xd8d0ec);
    for (const x of [780, 1880]) this.add.image(x, GROUND_Y, TEXTURES.column).setOrigin(0.5, 1).setTint(0xd8d0ec);
    this.add
      .text(GAME_WIDTH / 2 + 170, 80, "The Steps of Zeus's Palace", {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#fff6c2",
        stroke: "#3b2a4a",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(41);
  }

  /** Visual ground strip plus one static physics body whose top edge is GROUND_Y. */
  private buildGround(): Phaser.GameObjects.TileSprite {
    const ground = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y, TEXTURES.ground)
      .setOrigin(0);
    this.physics.add.existing(ground, true);
    return ground;
  }
}
