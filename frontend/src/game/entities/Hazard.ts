import Phaser from "phaser";

/**
 * A hazard that moves straight up and down between two fixed heights.
 * Sizes are world pixels and independent of the texture; positions are the hazard's centre.
 */
export interface HazardConfig {
  x: number;
  /** Centre y at the top of the swing. The hazard starts here. */
  highY: number;
  /** Centre y at the bottom of the swing. */
  lowY: number;
  textureKey: string;
  displaySize: number;
  /** Square collision box, usually a little smaller than the art so near misses feel fair. */
  hitboxSize: number;
  /** Milliseconds for one move between highY and lowY. */
  moveMs: number;
  /** Pause at the bottom before rising again. */
  holdLowMs: number;
  /** Pause at the top before falling again; this is the main window to walk underneath. */
  holdHighMs: number;
  /** Delay before the first swing, so hazards are out of phase with each other. */
  startDelayMs: number;
}

export class Hazard extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  private readonly tween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, readonly config: HazardConfig) {
    super(scene, config.x, config.highY, config.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(config.displaySize, config.displaySize);

    // A dynamic body that ignores gravity, is never pushed, and follows the tweened position.
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    // Body size is in source-texture pixels; Phaser applies the sprite's scale.
    this.body.setSize(config.hitboxSize / this.scaleX, config.hitboxSize / this.scaleY, true);
    this.body.setDirectControl(true);

    this.tween = scene.tweens.add({
      targets: this,
      y: config.lowY,
      duration: config.moveMs,
      ease: "Sine.easeInOut",
      yoyo: true,
      hold: config.holdLowMs,
      repeatDelay: config.holdHighMs,
      delay: config.startDelayMs,
      repeat: -1,
    });
  }

  /** Parks the hazard at the top of its swing and makes it harmless. */
  stop(): void {
    this.tween.stop();
    this.setY(this.config.highY);
    this.body.enable = false;
  }
}
