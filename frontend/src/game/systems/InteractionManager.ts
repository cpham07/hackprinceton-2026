import Phaser from "phaser";
import { EventBus } from "../EventBus";

/** Anything the player can walk up to and press E on. x/y is the feet position. */
export interface Interactable {
  id: string;
  x: number;
  y: number;
  interactionRadius: number;
  /** Text shown when in range, e.g. "Press E to talk" or "Press E to investigate". */
  prompt: string;
  /** World y at which the prompt is drawn. */
  promptY: number;
  /** False while the interaction is switched off; it is then never offered or triggered. */
  interactionEnabled?: boolean;
  /** What pressing E requests from React. Defaults to "dialogue". */
  kind?: "dialogue" | "puzzle";
  /**
   * Scene-specific handling of E (e.g. a portal). Return true if handled;
   * false falls back to the dialogue or puzzle request.
   */
  onInteract?: () => boolean;
}

/**
 * Finds the nearest interactable in range of the player, shows the prompt above it,
 * and requests its dialogue or puzzle when E is pressed. Scenes register NPCs and objects alike and call update().
 */
export class InteractionManager {
  private readonly targets: Interactable[] = [];
  private readonly prompt: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    private readonly player: { x: number; y: number },
    /** Returns true once per press of the interact key. */
    private readonly consumeInteract: () => boolean,
  ) {
    this.prompt = scene.add
      .text(0, 0, "", {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#ffffff",
        backgroundColor: "#2b1d3acc",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5, 1)
      .setDepth(100)
      .setVisible(false);
  }

  register(target: Interactable): void {
    this.targets.push(target);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.prompt.setVisible(false);
  }

  /** The interactable currently in range, if any. */
  getTarget(): Interactable | null {
    let nearest: Interactable | null = null;
    let nearestDistance = Infinity;
    for (const target of this.targets) {
      if (target.interactionEnabled === false) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
      if (distance <= target.interactionRadius && distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  update(): void {
    // Always consume the press, so an E pressed out of range can't fire later.
    const pressed = this.consumeInteract();
    if (!this.enabled) return;

    const target = this.getTarget();
    this.prompt.setVisible(target !== null);
    if (!target) return;

    this.prompt.setText(target.prompt).setPosition(target.x, target.promptY);
    if (!pressed) return;
    if (target.onInteract?.()) return;
    if (target.kind === "puzzle") EventBus.emit("puzzle:request", { puzzleId: target.id });
    else EventBus.emit("dialogue:request", { npcId: target.id });
  }
}
