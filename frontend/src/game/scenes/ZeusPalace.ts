import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES, type SceneKey } from "../constants";
import { EventBus } from "../EventBus";
import { PALACE_INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { addBackground, BACKGROUNDS, preloadBackground } from "../graphics/backgrounds";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { advanceStatue, isPlateActive, resetStatues, STATUE_TRACKS, statueX } from "../puzzles/pressurePlates";
import { getGameState, hasFlag, hasItem, subscribe } from "../state/gameState";
import { applyStoryActions } from "../story/actions";
import {
  CH3_FLAGS,
  completeChapter3IfReady,
  MASTER_BOLT,
  PALACE_ENTERED,
  tryCollectBolt,
} from "../story/chapter3";
import { GameplayScene } from "./GameplayScene";
import { HUB_SPAWN_FROM_PALACE_X } from "./OlympusHub";

const WORLD_WIDTH = 4500;
const GROUND_Y = 620;
const START_X = 260; // clear of the exit's interaction range (it ends at x = 180)

/** Full-height static walls. Their art is separate, so the physics never depends on a sprite's size. */
const PASSAGE_X = 1700; // the portcullis after the statue puzzle
const GUARD_X = 2330; // just beyond the guards
const VAULT_X = 3200; // the vault door itself
const BARRIER_WIDTH = 40;

const COLUMN_XS = [420, 1180, 1850, 2650, 3050, 3500, 4300];
const LABELS: Array<[number, string]> = [
  [1150, "Hall of Statues"],
  [2200, "Guard Corridor"],
  [3200, "The Forbidden Vault"],
];

/** Chapter 3: Zeus's palace. Puzzle, guards, vault, the bolt, and Zeus. */
export class ZeusPalace extends GameplayScene {
  private statues = new Map<string, Npc>();
  private plates = new Map<string, { slab: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; active: boolean }>();
  private passageGate!: Phaser.GameObjects.Image;
  private passageBarrier!: Phaser.GameObjects.Zone;
  private guardBarrier!: Phaser.GameObjects.Zone;
  private vaultBarrier!: Phaser.GameObjects.Zone;
  private guards!: Npc;
  private vaultDoor!: Npc;
  private bolt!: Npc;
  private zeus!: Npc;
  private lever!: Npc;
  private notice!: Phaser.GameObjects.Text;
  private seenBolt = false;

  constructor() {
    super(SCENES.palace);
  }

  preload(): void {
    super.preload();
    preloadBackground(this, BACKGROUNDS.palace);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.plates.clear();
    this.statues.clear();
    this.buildBackdrop();
    const ground = this.buildGround();
    // The painting has its own paved walkway; the strip stays as the (invisible) floor the player stands on.
    if (this.textures.exists(BACKGROUNDS.palace.key)) ground.setVisible(false);
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: START_X, ground });

    this.passageBarrier = this.addBarrier(PASSAGE_X);
    this.guardBarrier = this.addBarrier(GUARD_X);
    this.vaultBarrier = this.addBarrier(VAULT_X);

    for (const def of Object.values(PALACE_INTERACTABLES)) {
      const entity = new Npc(this, def, GROUND_Y);
      this.interactions.register(entity);
      this.wire(entity);
    }
    for (const track of STATUE_TRACKS) this.statues.get(track.id)!.setX(statueX(track)).syncAttachments();

    this.notice = this.add
      .text(GAME_WIDTH / 2, 150, "", {
        fontFamily: "Georgia, serif",
        fontSize: "34px",
        color: "#fbe4f0",
        stroke: "#5b4a36",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    // The story state lives in the gameState module; the scene only mirrors it.
    applyStoryActions(PALACE_ENTERED);
    this.seenBolt = hasItem(MASTER_BOLT);
    this.applyStoryState();
    this.addCleanup(subscribe(() => this.applyStoryState()));
  }

  update(time: number): void {
    this.tickGameplay(time);
  }

  protected sceneStartData(key: SceneKey): object | undefined {
    // Back in the hub, appear beside the palace gates instead of at the hub's start.
    return key === SCENES.hub ? { spawnX: HUB_SPAWN_FROM_PALACE_X } : undefined;
  }

  /** Keeps references to the interactables the scene updates, and gives scene-specific ones their E handler. */
  private wire(entity: Npc): void {
    switch (entity.id) {
      case "palaceExit":
        entity.onInteract = () => this.useExit();
        break;
      case "statueA":
      case "statueB":
        this.statues.set(entity.id, entity);
        entity.onInteract = () => advanceStatue(entity.id);
        break;
      case "resetLever":
        this.lever = entity;
        entity.onInteract = () => {
          if (resetStatues()) this.flashNotice("The statues return to their places");
          return true;
        };
        break;
      case "palaceGuards":
        this.guards = entity;
        break;
      case "vaultDoor":
        this.vaultDoor = entity;
        break;
      case "masterBolt":
        this.bolt = entity;
        entity.onInteract = () => this.collectBolt();
        break;
      case "zeus":
        this.zeus = entity;
        break;
    }
  }

  /**
   * The gate. With the bolt and Zeus's confrontation done, it completes the chapter (once).
   * Without the bolt it simply leads back to Olympus. With the bolt but before the confrontation
   * is over, it stays shut (the exit script explains why).
   */
  private useExit(): boolean {
    if (completeChapter3IfReady()) return true;
    if (!hasItem(MASTER_BOLT) || hasFlag(CH3_FLAGS.chapter3Complete)) {
      this.goToScene(SCENES.hub);
      return true;
    }
    return false;
  }

  private collectBolt(): boolean {
    if (!tryCollectBolt()) return false; // vault still sealed: the bolt's script explains
    this.cameras.main.flash(400, 255, 240, 160);
    this.cameras.main.shake(300, 0.006);
    this.flashNotice("Master Lightning Bolt obtained!");
    // Zeus appears (see applyStoryState) and confronts the player a moment later.
    this.time.delayedCall(900, () => {
      if (!hasFlag(CH3_FLAGS.zeusConfrontationComplete)) EventBus.emit("dialogue:request", { npcId: "zeus" });
    });
    return true;
  }

  /** Makes the world match the story state. Runs at start and on every state change. */
  private applyStoryState(): void {
    const { flags } = getGameState();
    const solved = flags[CH3_FLAGS.statuePuzzleSolved] === true;
    const guardsPassed = flags[CH3_FLAGS.guardsPassed] === true;
    const vaultOpen = flags[CH3_FLAGS.vaultOpen] === true;
    const hasBolt = hasItem(MASTER_BOLT);

    // Statues and plates
    for (const track of STATUE_TRACKS) {
      const statue = this.statues.get(track.id)!;
      const target = statueX(track);
      if (statue.getData("targetX") !== target) {
        statue.setData("targetX", target);
        this.tweens.killTweensOf(statue);
        if (Math.abs(statue.x - target) < 1) statue.setX(target).syncAttachments();
        else this.tweens.add({ targets: statue, x: target, duration: 260, ease: "Sine.easeInOut", onUpdate: () => statue.syncAttachments() });
      }
      statue.interactionEnabled = !solved;

      const plate = this.plates.get(track.id);
      const active = isPlateActive(track);
      if (plate && plate.active !== active) {
        plate.active = active;
        plate.slab.setTexture(active ? TEXTURES.plateOn : TEXTURES.plateOff);
        plate.glow.setVisible(active);
        if (active) this.flashPlate(plate.slab.x);
      }
    }
    this.lever.interactionEnabled = !solved;
    this.passageGate.setTexture(solved ? TEXTURES.portcullisOpen : TEXTURES.portcullis);
    this.setBarrier(this.passageBarrier, !solved);

    // Guard checkpoint
    this.guards.setTexture(guardsPassed ? TEXTURES.palaceGuardsAside : TEXTURES.palaceGuards);
    this.setBarrier(this.guardBarrier, !guardsPassed);

    // Vault
    this.vaultDoor.setTexture(vaultOpen ? TEXTURES.vaultDoorOpen : TEXTURES.vaultDoor);
    this.vaultDoor.interactionEnabled = !vaultOpen;
    this.setBarrier(this.vaultBarrier, !vaultOpen);

    // The bolt is taken once; Zeus appears when it is.
    this.bolt.setPresent(!hasBolt);
    this.zeus.setPresent(hasBolt);
    if (hasBolt && !this.seenBolt) this.zeus.setAlpha(0).setData("fade", this.tweens.add({ targets: this.zeus, alpha: 1, duration: 500 }));
    else if (hasBolt) this.zeus.setAlpha(1);
    this.seenBolt = hasBolt;
  }

  private addBarrier(x: number): Phaser.GameObjects.Zone {
    const barrier = this.add.zone(x, GROUND_Y / 2, BARRIER_WIDTH, GROUND_Y);
    this.physics.add.existing(barrier, true);
    this.physics.add.collider(this.player, barrier);
    return barrier;
  }

  /** Turning a static body's collision off is immediate and leaves nobody stuck inside it. */
  private setBarrier(barrier: Phaser.GameObjects.Zone, locked: boolean): void {
    (barrier.body as Phaser.Physics.Arcade.StaticBody).enable = locked;
  }

  private flashNotice(text: string): void {
    this.tweens.killTweensOf(this.notice);
    this.notice.setText(text).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.notice, alpha: 0, delay: 1400, duration: 500 });
  }

  private flashPlate(x: number): void {
    const text = this.add
      .text(x, GROUND_Y - 40, "Plate activated!", {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#fbe4f0",
        stroke: "#5b4a36",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
    this.tweens.add({ targets: text, y: text.y - 50, alpha: 0, duration: 1400, onComplete: () => text.destroy() });
  }

  private buildBackdrop(): void {
    const painted = addBackground(this, BACKGROUNDS.palace, { worldWidth: WORLD_WIDTH, groundY: GROUND_Y });
    if (!painted) {
      // Placeholder hall, used if the painting failed to load.
      this.add.tileSprite(0, 110, WORLD_WIDTH, GROUND_Y - 110, TEXTURES.palaceWall).setOrigin(0);
      this.add.rectangle(0, 0, WORLD_WIDTH, 110, 0xf7f1e3).setOrigin(0);
      this.add.rectangle(0, 104, WORLD_WIDTH, 8, 0xd4af37).setOrigin(0);
      for (const x of COLUMN_XS) this.add.image(x, GROUND_Y, TEXTURES.goldColumn).setOrigin(0.5, 1);
    }
    // The vault is darker and tinted, drawn over the hall either way, so the final room reads as a different place.
    this.add.tileSprite(VAULT_X + 40, 110, WORLD_WIDTH - VAULT_X - 40, GROUND_Y - 110, TEXTURES.palaceWall).setOrigin(0).setTint(0x8f7fb8);
    this.add.rectangle(VAULT_X + 40, 0, WORLD_WIDTH - VAULT_X - 40, 110, 0xf7f1e3).setOrigin(0);
    this.add.rectangle(VAULT_X + 40, 104, WORLD_WIDTH - VAULT_X - 40, 8, 0xd4af37).setOrigin(0);
    for (const [x, text] of LABELS) {
      this.add
        .text(x, 150, text, { fontFamily: "Georgia, serif", fontSize: "28px", color: "#5b4a36", stroke: "#fbe4f0", strokeThickness: 5 })
        .setOrigin(0.5, 1);
    }

    // Pressure plates sit flush with the floor, each with a glow that shows while it is pressed.
    for (const track of STATUE_TRACKS) {
      const x = track.positions[track.plateIndex];
      const slab = this.add.image(x, GROUND_Y, TEXTURES.plateOff).setOrigin(0.5, 1).setDisplaySize(110, 14);
      const glow = this.add
        .image(x, GROUND_Y - 20, TEXTURES.glow)
        .setTint(0xffe066)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(220, 120)
        .setVisible(false);
      this.tweens.add({ targets: glow, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 });
      this.plates.set(track.id, { slab, glow, active: false });
    }

    this.passageGate = this.add.image(PASSAGE_X, GROUND_Y, TEXTURES.portcullis).setOrigin(0.5, 1).setDisplaySize(110, 420);
    this.add.text(PASSAGE_X, 190, "Sealed until both plates glow", {
      fontFamily: "Georgia, serif", fontSize: "18px", color: "#5b4a36", stroke: "#fbe4f0", strokeThickness: 4,
    }).setOrigin(0.5, 1);

    this.add
      .image(VAULT_X + 560, GROUND_Y - 150, TEXTURES.glow)
      .setTint(0xffe066)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(700, 520)
      .setAlpha(0.35);
  }

  /** Visual ground strip plus one static physics body whose top edge is GROUND_Y. */
  private buildGround(): Phaser.GameObjects.TileSprite {
    const ground = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y, TEXTURES.palaceFloor)
      .setOrigin(0);
    this.physics.add.existing(ground, true);
    return ground;
  }
}
