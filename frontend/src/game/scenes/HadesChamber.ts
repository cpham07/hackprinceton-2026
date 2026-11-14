import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES, type SceneKey } from "../constants";
import { HADES_INTERACTABLES } from "../data/interactables";
import { Npc } from "../entities/Npc";
import { createPlaceholderTextures, TEXTURES } from "../graphics/placeholders";
import { getGameState, subscribe } from "../state/gameState";
import { GameplayScene } from "./GameplayScene";
import { HUB_SPAWN_FROM_HADES_X } from "./OlympusHub";

const WORLD_WIDTH = 1500;
const GROUND_Y = 620;
const START_X = 290; // clear of the exit's interaction range (it ends at x = 190)
const THRONE_X = 1230;
const COLUMN_XS = [330, 720, 1450];
const BRAZIERS = [
  { x: 560, color: 0x3d7bff },
  { x: 900, color: 0x8a4bff },
  { x: 1350, color: 0x3d7bff },
];

/** Chapter 2: Hades's chamber. A compact room: walk to Hades, talk, and use the exit. */
export class HadesChamber extends GameplayScene {
  private sealEmblem!: Phaser.GameObjects.Image;

  constructor() {
    super(SCENES.hades);
  }

  create(): void {
    createPlaceholderTextures(this);
    this.buildBackdrop();
    const ground = this.buildGround();
    this.initGameplay({ worldWidth: WORLD_WIDTH, groundY: GROUND_Y, playerX: START_X, ground });

    for (const def of Object.values(HADES_INTERACTABLES)) {
      const entity = new Npc(this, def, GROUND_Y);
      if (def.id === "hadesExit") {
        entity.onInteract = () => {
          this.goToScene(SCENES.hub);
          return true;
        };
      }
      this.interactions.register(entity);
    }

    // The Seal of Passage floats above the throne room once it has been earned.
    this.sealEmblem = this.add
      .image(HADES_INTERACTABLES.hades.x, GROUND_Y - 250, TEXTURES.sealPassage)
      .setDisplaySize(72, 72)
      .setVisible(false);
    this.tweens.add({ targets: this.sealEmblem, y: GROUND_Y - 262, duration: 1200, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });

    // The story state lives in the gameState module; the scene only mirrors it.
    this.applyStoryState();
    this.addCleanup(subscribe(() => this.applyStoryState()));
  }

  update(time: number): void {
    this.tickGameplay(time);
  }

  protected sceneStartData(key: SceneKey): object | undefined {
    // Back in the hub, appear beside the Hades gate instead of at the hub's start.
    return key === SCENES.hub ? { spawnX: HUB_SPAWN_FROM_HADES_X } : undefined;
  }

  private applyStoryState(): void {
    this.sealEmblem.setVisible(getGameState().seals.hades);
  }

  private buildBackdrop(): void {
    this.add
      .image(0, 0, TEXTURES.skyUnderworld)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0);
    this.add.tileSprite(0, 150, WORLD_WIDTH, GROUND_Y - 150, TEXTURES.underworldWall).setOrigin(0).setAlpha(0.9);

    for (const x of COLUMN_XS) {
      this.add.image(x, GROUND_Y, TEXTURES.underworldColumn).setOrigin(0.5, 1);
    }
    this.add.image(THRONE_X, GROUND_Y, TEXTURES.throne).setOrigin(0.5, 1).setDisplaySize(230, 330);

    // Purple and blue ambient light: flickering braziers with additive glows.
    for (const { x, color } of BRAZIERS) {
      this.add.image(x, GROUND_Y, TEXTURES.brazier).setOrigin(0.5, 1).setDisplaySize(50, 110);
      const glow = this.add
        .image(x, GROUND_Y - 100, TEXTURES.glow)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(340, 340)
        .setAlpha(0.55);
      this.tweens.add({
        targets: glow,
        alpha: 0.85,
        scale: glow.scale * 1.08,
        duration: 900 + x,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
    this.add
      .image(THRONE_X, GROUND_Y - 160, TEXTURES.glow)
      .setTint(0x6a4bd8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(620, 520)
      .setAlpha(0.4);

    this.add
      .text(GAME_WIDTH / 2 + 170, 80, "The Halls of Hades", {
        fontFamily: "Georgia, serif",
        fontSize: "30px",
        color: "#d9d6e8",
        stroke: "#15122a",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0);
  }

  /** Visual ground strip plus one static physics body whose top edge is GROUND_Y. */
  private buildGround(): Phaser.GameObjects.TileSprite {
    const ground = this.add
      .tileSprite(0, GROUND_Y, WORLD_WIDTH, GAME_HEIGHT - GROUND_Y, TEXTURES.underworldFloor)
      .setOrigin(0);
    this.physics.add.existing(ground, true);
    return ground;
  }
}
