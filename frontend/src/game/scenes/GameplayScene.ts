import Phaser from "phaser";
import { GAME_HEIGHT, type SceneKey } from "../constants";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import {
  captureGameplayKeys,
  clearPresses,
  consumePress,
  createGameplayKeys,
  releaseGameplayKeys,
  type GameplayKeys,
} from "../input/keys";
import { InteractionManager } from "../systems/InteractionManager";

/**
 * Shared base for playable side-scrolling scenes: the player, gameplay keys,
 * interactions, the overlay input lock and scene transitions.
 *
 * Subclasses build their level in create(), call initGameplay() once, and call
 * tickGameplay() from update().
 */
export abstract class GameplayScene extends Phaser.Scene {
  protected player!: Player;
  protected keys!: GameplayKeys;
  protected interactions!: InteractionManager;

  /** Ids of the gameplay-blocking React overlays currently open. Input is locked while any is. */
  private readonly openOverlays = new Set<string>();
  private inputLocked = false;
  private transitioning = false;
  private cleanups: Array<() => void> = [];

  preload(): void {
    Player.preload(this);
  }

  /**
   * Creates the player, input, camera and interactions, and wires the EventBus.
   * Call after the art that sits behind the player has been added.
   */
  protected initGameplay(options: {
    worldWidth: number;
    groundY: number;
    playerX: number;
    ground: Phaser.GameObjects.GameObject;
  }): void {
    // A scene object is reused if the scene is started again, so reset per-run state.
    this.openOverlays.clear();
    this.inputLocked = false;
    this.transitioning = false;
    this.cleanups = [];

    this.player = new Player(this, options.playerX, options.groundY);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, options.ground);

    this.physics.world.setBounds(0, 0, options.worldWidth, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, options.worldWidth, GAME_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    const keyboard = this.input.keyboard!;
    keyboard.enabled = true;
    this.keys = createGameplayKeys(keyboard);
    captureGameplayKeys(keyboard);

    this.interactions = new InteractionManager(this, this.player, () =>
      consumePress(this.keys, "interact"),
    );

    this.addCleanup(
      EventBus.on("overlay:opened", ({ id }) => {
        this.openOverlays.add(id);
        this.syncInputLock();
      }),
    );
    this.addCleanup(
      EventBus.on("overlay:closed", ({ id }) => {
        this.openOverlays.delete(id);
        this.syncInputLock();
      }),
    );
    this.addCleanup(EventBus.on("scene:start", ({ key }) => this.goToScene(key)));

    const runCleanups = () => this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.DESTROY, runCleanups);
      runCleanups();
      // The capture list is global to the game, so don't leave ours behind for the next scene.
      releaseGameplayKeys(keyboard);
    });
    // On destroy the whole game (and its keyboard manager) is going away: only drop listeners.
    this.events.once(Phaser.Scenes.Events.DESTROY, runCleanups);

    EventBus.emit("scene:ready", { key: this.scene.key as SceneKey });
  }

  /** Registers something to undo when the scene shuts down (EventBus or state subscriptions). */
  protected addCleanup(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /** Call from update(). `frozen` stops the player for scene-specific reasons. */
  protected tickGameplay(time: number, frozen = false): void {
    this.player.tick(this.inputLocked || frozen ? null : this.keys, time);
    this.interactions.update();
  }

  /** Whether E interactions are allowed when no overlay is open. Override to add conditions. */
  protected canInteract(): boolean {
    return true;
  }

  /** Re-applies canInteract(), e.g. after story state changes. */
  protected refreshInteractions(): void {
    this.interactions.setEnabled(!this.inputLocked && this.canInteract());
  }

  /** Locks input when the first overlay opens and restores it when the last one closes. */
  private syncInputLock(): void {
    const locked = this.openOverlays.size > 0;
    if (locked === this.inputLocked) return;
    this.inputLocked = locked;
    const keyboard = this.input.keyboard!;

    if (locked) {
      this.player.halt();
      releaseGameplayKeys(keyboard);
      keyboard.resetKeys();
      clearPresses(this.keys);
      keyboard.enabled = false;
    } else {
      keyboard.enabled = true;
      keyboard.resetKeys();
      clearPresses(this.keys);
      captureGameplayKeys(keyboard);
    }
    this.refreshInteractions();
  }

  /**
   * Data passed to the next scene's init(), e.g. where to spawn the player.
   * Override to customise; transient, never stored in the story state.
   */
  protected sceneStartData(_key: SceneKey): object | undefined {
    return undefined;
  }

  /** Switches to another scene once; repeated requests while switching are ignored. */
  protected goToScene(key: SceneKey): void {
    if (this.transitioning || key === this.scene.key) return;
    this.transitioning = true;
    // Shuts this scene down (running the cleanups above) and starts the target.
    this.scene.start(key, this.sceneStartData(key));
  }
}
