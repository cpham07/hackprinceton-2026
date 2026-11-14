import Phaser from "phaser";
import type { InteractableDefinition } from "../data/interactables";
import { TEXTURES } from "../graphics/placeholders";
import type { Interactable } from "../systems/InteractionManager";

/** A standing character or object built from a definition. Implements Interactable. */
export class Npc extends Phaser.GameObjects.Image implements Interactable {
  readonly id: string;
  readonly interactionRadius: number;
  /** Mutable so a scene can change it with the story state (e.g. a locked and an unlocked gate). */
  prompt: string;
  readonly promptY: number;
  readonly kind: "dialogue" | "puzzle";
  /** Set by a scene to handle E itself; see Interactable.onInteract. */
  onInteract?: () => boolean;

  constructor(scene: Phaser.Scene, def: InteractableDefinition, feetY: number) {
    super(scene, def.x, feetY, def.textureKey);
    this.id = def.id;
    this.interactionRadius = def.interactionRadius;
    this.prompt = def.prompt;
    this.kind = def.kind ?? "dialogue";
    this.setOrigin(0.5, 1);
    this.setDisplaySize(def.displaySize.width, def.displaySize.height);

    if (def.glowColor !== undefined) {
      // Added first so it renders behind the object.
      const glow = scene.add
        .image(def.x, feetY - def.displaySize.height / 2, TEXTURES.glow)
        .setTint(def.glowColor)
        .setDisplaySize(def.displaySize.width * 2.6, def.displaySize.height * 1.5)
        .setAlpha(0.45);
      scene.tweens.add({
        targets: glow,
        alpha: 0.95,
        scaleX: glow.scaleX * 1.12,
        scaleY: glow.scaleY * 1.08,
        duration: 1400,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }
    scene.add.existing(this);

    const nameY = feetY - def.displaySize.height - 14;
    scene.add
      .text(def.x, nameY, def.name, {
        fontFamily: "Georgia, serif",
        fontSize: "20px",
        color: "#3b2a4a",
        stroke: "#ffffff",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);
    this.promptY = nameY - 30;
  }
}
