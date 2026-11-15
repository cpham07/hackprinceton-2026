import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "../constants";
import { BATTLE_INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { GOD_SCALE, HELD_BOLT_PLACEHOLDER_OFFSET } from "../graphics/characterArt";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { brokenCount, ENCHANTMENTS, isEnchantmentBroken, strikeEnchantment } from "../puzzles/enchantmentNodes";
import { getGameState, subscribe } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import {
  CH5_FLAGS,
  CHAPTER_5_ENTERED,
  completeChapter5IfReady,
  isEndingDue,
  tryFreeZeus,
  tryRetrieveBolt,
} from "../story/chapter5";
import { GameplayScene } from "./GameplayScene";

const WORLD_WIDTH = 3300;
const GROUND_Y = 620;
const START_X = 220;
/** Full-height wall sealing the throne room until the three enchantments are broken. */
const BARRIER_X = 1620;
const BARRIER_WIDTH = 40;
const THRONE_X = 2700;
const ZEUS_X = BATTLE_INTERACTABLES.zeus.x;
const DARKNESS = { siege: 0.36, restored: 0 };

interface Moments {
  broken: boolean;
  yielded: boolean;
  retrieved: boolean;
  freed: boolean;
  restored: boolean;
}

/**
 * Chapter 5: the battle for Olympus. Athena briefs the player in the courtyard; three enchantments hold
 * a barrier across the palace; Aphrodite waits on Zeus's throne with the bolt, Zeus caged beside her.
 * The scene only plays back the story state. The ending opens once Zeus has spoken and his dialogue closes.
 */
export class BattleForOlympus extends GameplayScene {
  private nodes = new Map<string, Npc>();
  private bolt!: Npc;
  private zeus!: Npc;
  private barrier!: Phaser.GameObjects.Zone;
  private barrierArt!: Phaser.GameObjects.Image;
  private cage!: Phaser.GameObjects.Image;
  private heldBolt!: Phaser.GameObjects.Image;
  private throneGlow!: Phaser.GameObjects.Image;
  private darkness!: Phaser.GameObjects.Rectangle;
  private notice!: Phaser.GameObjects.Text;
  private seen!: Moments;
  private completing = false;

  constructor() {
    super(SCENES.battle);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.nodes.clear();
    this.completing = false;

    this.buildBackdrop();
    const ground = this.buildGround();
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: START_X, ground });

    this.barrier = this.add.zone(BARRIER_X, GROUND_Y / 2, BARRIER_WIDTH, GROUND_Y);
    this.physics.add.existing(this.barrier, true);
    this.physics.add.collider(this.player, this.barrier);

    let aphrodite: Npc | undefined;
    for (const def of Object.values(BATTLE_INTERACTABLES)) {
      const npc = new Npc(this, def, GROUND_Y);
      this.interactions.register(npc);
      if (def.id === "aphrodite") aphrodite = npc;
      if (def.id.startsWith("enchant")) {
        this.nodes.set(def.id, npc);
        npc.onInteract = () => this.strike(def.id);
      }
      if (def.id === "masterBolt") {
        this.bolt = npc;
        npc.onInteract = () => this.retrieveBolt();
      }
      if (def.id === "zeus") {
        this.zeus = npc;
        npc.onInteract = () => this.freeZeus(); // falls back to his dialogue when there is nothing to free
      }
    }

    this.cage = this.add.image(ZEUS_X, GROUND_Y, TEXTURES.goldenCage).setOrigin(0.5, 1).setDisplaySize(170 * GOD_SCALE, 250 * GOD_SCALE).setDepth(6);
    // In Aphrodite's hand (her art's hand point; the offset is for the placeholder).
    const hand = aphrodite?.holdPoint(HELD_BOLT_PLACEHOLDER_OFFSET) ?? { x: THRONE_X + HELD_BOLT_PLACEHOLDER_OFFSET.x, y: GROUND_Y + HELD_BOLT_PLACEHOLDER_OFFSET.y };
    this.heldBolt = this.add.image(hand.x, hand.y, TEXTURES.masterBolt).setDisplaySize(30, 60).setDepth(6);
    this.darkness = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a0b2e)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(40)
      .setAlpha(DARKNESS.siege);
    this.notice = this.add
      .text(GAME_WIDTH / 2, 160, "", { fontFamily: "Georgia, serif", fontSize: "32px", color: "#fff6c2", stroke: "#3b2a4a", strokeThickness: 7 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    applyStoryActions(CHAPTER_5_ENTERED);
    this.seen = this.moments();
    if (this.seen.restored) this.darkness.setAlpha(DARKNESS.restored);
    this.applyStoryState();
    this.addCleanup(subscribe(() => this.applyStoryState()));
  }

  update(time: number): void {
    this.tickGameplay(time);
    this.maybeEnd();
  }

  /** Opens the ending (once) after Zeus has named the Guardian and his dialogue has been closed. */
  private maybeEnd(): void {
    if (this.completing || this.isInputLocked() || !isEndingDue(getGameState())) return;
    this.completing = true;
    this.time.delayedCall(1400, () => {
      this.completing = false;
      if (!this.isInputLocked()) completeChapter5IfReady();
    });
  }

  private moments(): Moments {
    const { flags } = getGameState();
    return {
      broken: flags[CH5_FLAGS.enchantmentsBroken] === true,
      yielded: flags[CH5_FLAGS.aphroditeYielded] === true,
      retrieved: flags[CH5_FLAGS.boltRetrieved] === true,
      freed: flags[CH5_FLAGS.zeusFreed] === true,
      restored: flags[CH5_FLAGS.guardianOfOlympus] === true,
    };
  }

  private strike(id: string): boolean {
    const result = strikeEnchantment(id);
    if (result === "ignored") return false; // not briefed yet, or already broken: its dialogue explains
    const name = ENCHANTMENTS.find((e) => e.id === id)!.name;
    if (result === "wrong") {
      this.cameras.main.flash(300, 255, 120, 210);
      this.flashNotice(`Out of turn! The enchantments knit back together.`);
    } else if (brokenCount() < ENCHANTMENTS.length) {
      this.flashNotice(`${name} is broken (${brokenCount()}/${ENCHANTMENTS.length})`);
    }
    return true;
  }

  private retrieveBolt(): boolean {
    if (!tryRetrieveBolt()) return false;
    this.cameras.main.flash(350, 255, 230, 140);
    this.flashNotice("You hold the Master Lightning Bolt");
    return true;
  }

  private freeZeus(): boolean {
    if (!tryFreeZeus()) return false;
    return true; // the cage shatters in applyStoryState
  }

  /** Makes the world match the story state, and plays an effect when a moment happens now. */
  private applyStoryState(): void {
    const now = this.moments();
    if (now.broken && !this.seen.broken) {
      this.cameras.main.flash(500, 255, 140, 220);
      this.flashNotice("The enchantments shatter. The throne room is open.");
    }
    if (now.freed && !this.seen.freed) {
      this.cameras.main.flash(450, 255, 230, 140);
      this.cameras.main.shake(350, 0.008);
      this.tweens.add({ targets: this.cage, alpha: 0, scaleX: this.cage.scaleX * 1.4, duration: 600 });
    }
    if (now.restored && !this.seen.restored) {
      this.cameras.main.flash(900, 255, 236, 170);
      this.tweens.add({ targets: this.darkness, alpha: DARKNESS.restored, duration: 2500 });
      this.throneGlow.setTint(0xffe066);
    }
    this.seen = now;

    for (const [id, node] of this.nodes) {
      const broken = now.broken || isEnchantmentBroken(id);
      node.setTexture(broken ? TEXTURES.enchantNodeBroken : TEXTURES.enchantNode);
      node.setGlowVisible(!broken);
      node.interactionEnabled = !broken;
    }
    (this.barrier.body as Phaser.Physics.Arcade.StaticBody).enable = !now.broken;
    this.barrierArt.setVisible(!now.broken);

    this.heldBolt.setVisible(!now.yielded);
    this.bolt.setPresent(now.yielded && !now.retrieved);
    if (!now.freed) {
      this.cage.setVisible(true).setAlpha(1);
      this.zeus.setTint(0xb8b0d8);
    } else {
      if (this.cage.alpha === 1) this.cage.setVisible(false); // already free on entry: no animation
      this.zeus.clearTint();
    }
    if (now.restored) this.throneGlow.setTint(0xffe066);
  }

  private flashNotice(text: string): void {
    this.tweens.killTweensOf(this.notice);
    this.notice.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.notice, alpha: 0, delay: 1400, duration: 500 });
  }

  private buildBackdrop(): void {
    this.add.image(0, 0, TEXTURES.skyOlympus).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setScrollFactor(0).setTint(0x9a8cc4);
    // Courtyard and enchantment hall
    this.add.tileSprite(0, 110, BARRIER_X, GROUND_Y - 110, TEXTURES.palaceWall).setOrigin(0).setTint(0xd8c8e8);
    // Throne room: darker, lit by the throne
    this.add.tileSprite(BARRIER_X, 110, WORLD_WIDTH - BARRIER_X, GROUND_Y - 110, TEXTURES.palaceWall).setOrigin(0).setTint(0x9f86c0);
    this.add.rectangle(0, 0, WORLD_WIDTH, 110, 0xf7f1e3).setOrigin(0);
    this.add.rectangle(0, 104, WORLD_WIDTH, 8, 0xd4af37).setOrigin(0);
    for (const x of [140, 760, 1500, 1900, 2300, 3200]) this.add.image(x, GROUND_Y, TEXTURES.goldColumn).setOrigin(0.5, 1);
    for (const x of [2450, 2950]) this.add.image(x, GROUND_Y, TEXTURES.brazier).setOrigin(0.5, 1).setDisplaySize(50, 110).setTint(0xffd27a);

    this.throneGlow = this.add
      .image(THRONE_X, GROUND_Y - 170, TEXTURES.glow)
      .setTint(0xff7ad9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(560, 460)
      .setAlpha(0.55);
    this.tweens.add({ targets: this.throneGlow, alpha: 0.8, duration: 1600, yoyo: true, repeat: -1 });
    this.add.image(THRONE_X, GROUND_Y, TEXTURES.throne).setOrigin(0.5, 1).setDisplaySize(230, 330).setTint(0xf2c4e8);

    const label = (x: number, y: number, text: string, size = 26) =>
      this.add
        .text(x, y, text, { fontFamily: "Georgia, serif", fontSize: `${size}px`, color: "#5b4a36", stroke: "#fff6c2", strokeThickness: 5, align: "center" })
        .setOrigin(0.5, 1)
        .setDepth(41);
    label(450, 170, "Palace Courtyard");
    label(1150, 170, "Hall of Enchantments");
    label(2600, 170, "Throne Room");
    // The order, spelled out in words (not only colour), so the puzzle is readable for everyone.
    label(1150, 240, "Undo them in the order she wove them:\nI · Vanity     II · Jealousy     III · Desire", 20);

    this.barrierArt = this.add.image(BARRIER_X, GROUND_Y, TEXTURES.forceField).setOrigin(0.5, 1).setDisplaySize(60, 470).setDepth(5);
    this.tweens.add({ targets: this.barrierArt, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
  }

  /** Visual ground strip plus one static physics body whose top edge is GROUND_Y. */
  private buildGround(): Phaser.GameObjects.TileSprite {
    const ground = this.add.tileSprite(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y, TEXTURES.palaceFloor).setOrigin(0);
    this.physics.add.existing(ground, true);
    return ground;
  }
}
