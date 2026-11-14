import Phaser from "phaser";
import { TEXTURES } from "../graphics/placeholders";
import { consumePress, type GameplayKeys } from "../input/keys";

/**
 * All sizes are in world pixels and are independent of the texture's own size.
 * The collision body is centred horizontally and sits on the bottom edge of the
 * displayed sprite, so the feet touch the ground whatever art is used.
 */
export const PLAYER_CONFIG = {
  textures: { idle: TEXTURES.playerIdle as string, walk: TEXTURES.playerWalk as string },
  displaySize: { width: 64, height: 96 },
  body: { width: 36, height: 88 },
  speed: 320,
  jumpVelocity: 760,
  walkFrameMs: 140,
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, PLAYER_CONFIG.textures.idle);
    this.setOrigin(0.5, 1);
    this.setDisplaySize(PLAYER_CONFIG.displaySize.width, PLAYER_CONFIG.displaySize.height);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.applyBodySize();
    this.setCollideWorldBounds(true);
  }

  /** Arcade body sizes and offsets are in unscaled texture pixels, so convert from world pixels. */
  private applyBodySize(): void {
    const { displaySize, body } = PLAYER_CONFIG;
    this.body.setSize(body.width / this.scaleX, body.height / this.scaleY, false);
    this.body.setOffset(
      (displaySize.width - body.width) / 2 / this.scaleX,
      (displaySize.height - body.height) / this.scaleY,
    );
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
    if (direction !== 0) this.setFlipX(direction < 0);

    // Visual feedback: alternate two frames while walking, hold the stride frame in the air.
    const { idle, walk } = PLAYER_CONFIG.textures;
    let texture = idle;
    if (!onGround) texture = walk;
    else if (direction !== 0 && Math.floor(time / PLAYER_CONFIG.walkFrameMs) % 2 === 0) texture = walk;
    if (this.texture.key !== texture) this.setTexture(texture);
  }

  /** Stop horizontal motion immediately (used when dialogue opens). Gravity still applies. */
  halt(): void {
    this.setVelocityX(0);
  }
}
