import Phaser from "phaser";
import { consumePress, type GameplayKeys } from "../input/keys";

type PlayerState = "idle" | "walk" | "jump";

/**
 * Player artwork. Every frame must be drawn on the same canvas size with the
 * character in the same place, so the measurements in PLAYER_ART apply to all of them.
 *
 * To add real walk/jump frames: add the files to PLAYER_ASSETS and list their keys
 * under the matching state in PLAYER_ANIMATIONS. Nothing else needs to change.
 */
const PLAYER_ASSETS: Array<{ key: string; path: string }> = [
  { key: "player-axolotl-idle", path: "assets/characters/player/axolotl_idle.png" },
];

const PLAYER_ANIMATIONS: Record<PlayerState, { frames: string[]; frameRate: number }> = {
  idle: { frames: ["player-axolotl-idle"], frameRate: 1 },
  walk: { frames: ["player-axolotl-idle"], frameRate: 8 },
  jump: { frames: ["player-axolotl-idle"], frameRate: 1 },
};

/**
 * Measurements of the artwork, in source-texture pixels (256x256 canvas, measured from the PNG).
 * The drawn character spans x 83-235, y 43-179; the rest is transparent padding.
 */
const PLAYER_ART = {
  frameWidth: 256,
  frameHeight: 256,
  /** The direction the character faces in the file. */
  sourceFacing: "left" as "left" | "right",
  /** First fully transparent row under the boots (the boots' bottom edge). */
  feetY: 180,
  /** Collision box: head, torso and boots. Leaves out the gills and tail. */
  body: { x: 98, y: 55, width: 74, height: 125 },
  /** Only this part of the canvas is drawn. Hides a stray speck at (34-37, 243-244) in the file. */
  visible: { x: 0, y: 0, width: 256, height: 184 },
};

export const PLAYER_CONFIG = {
  /** World pixels per source pixel. The collision box and feet line scale with it. */
  scale: 0.75,
  speed: 320,
  jumpVelocity: 760,
  /** Walk feedback while there is only one frame: a small rocking tilt about the feet. */
  walkTiltDegrees: 3,
  walkTiltMs: 90,
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  /** Call from the scene's preload(). */
  static preload(scene: Phaser.Scene): void {
    for (const { key, path } of PLAYER_ASSETS) {
      // Textures are shared by all scenes, so only the first scene actually loads them.
      if (!scene.textures.exists(key)) scene.load.image(key, path);
    }
  }

  private static createAnimations(scene: Phaser.Scene): void {
    for (const [state, { frames, frameRate }] of Object.entries(PLAYER_ANIMATIONS)) {
      const key = `player-${state}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({ key, frames: frames.map((frame) => ({ key: frame })), frameRate, repeat: -1 });
    }
  }

  /** x is the horizontal centre of the collision box; feetY is where the boots stand. */
  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, PLAYER_ANIMATIONS.idle.frames[0]);
    Player.createAnimations(scene);
    this.setScale(PLAYER_CONFIG.scale);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Arcade body size and offset are given in source pixels; Phaser multiplies them by the sprite scale.
    this.body.setSize(PLAYER_ART.body.width, PLAYER_ART.body.height, false);
    const { visible } = PLAYER_ART;
    this.setCrop(visible.x, visible.y, visible.width, visible.height);
    this.face(PLAYER_ART.sourceFacing);
    this.setCollideWorldBounds(true);
    this.play("player-idle");
  }

  /**
   * Flips the art and keeps the collision box where it is.
   *
   * The character is not centred on the canvas, and flipX mirrors about the canvas centre,
   * so the box's source offset differs per direction. The origin is moved to the box's
   * centre (x) and the boots' bottom edge (y) for the current direction, so sprite.x / sprite.y
   * stay at "centre of the box, on the ground" and the art mirrors around the box.
   */
  private face(direction: "left" | "right"): void {
    const { frameWidth, frameHeight, feetY, body, sourceFacing } = PLAYER_ART;
    const flipped = direction !== sourceFacing;
    const bodyLeft = flipped ? frameWidth - (body.x + body.width) : body.x;
    this.setFlipX(flipped);
    this.setOrigin((bodyLeft + body.width / 2) / frameWidth, feetY / frameHeight);
    this.body.setOffset(bodyLeft, body.y);
  }

  /** Call every frame. Pass null while gameplay input is disabled. */
  tick(keys: GameplayKeys | null, time: number): void {
    const onGround = this.body.blocked.down || this.body.touching.down;

    let direction = 0;
    if (keys) {
      if (keys.left.some((k) => k.isDown)) direction -= 1;
      if (keys.right.some((k) => k.isDown)) direction += 1;
      // Always consume, so a press made in the air is dropped instead of firing on landing.
      const jumpPressed = consumePress(keys, "jump");
      if (jumpPressed && onGround) this.setVelocityY(-PLAYER_CONFIG.jumpVelocity);
    }

    this.setVelocityX(direction * PLAYER_CONFIG.speed);
    if (direction !== 0) this.face(direction < 0 ? "left" : "right");

    const state: PlayerState = !onGround ? "jump" : direction !== 0 ? "walk" : "idle";
    this.play(`player-${state}`, true);

    // Rotation is visual only: Arcade bodies do not rotate.
    const walking = state === "walk";
    this.setAngle(
      walking ? Math.sin(time / PLAYER_CONFIG.walkTiltMs) * PLAYER_CONFIG.walkTiltDegrees : 0,
    );
  }

  /** Stop horizontal motion immediately (used when dialogue opens). Gravity still applies. */
  halt(): void {
    this.setVelocityX(0);
    this.setAngle(0);
  }
}
