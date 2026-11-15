import Phaser from "phaser";
import type { InteractableDefinition } from "../data/interactables";
import { ensureIdleAnimation, getCharacterArt, GOD_SCALE, GOD_TEXTURES, type CharacterArt } from "../graphics/characterArt";
import { TEXTURES } from "../graphics/placeholders";
import type { Interactable } from "../systems/InteractionManager";

/**
 * A standing character or object built from a definition. Implements Interactable.
 *
 * Characters with real art (graphics/characterArt.ts) are scaled uniformly from their measurements and stand
 * with their feet on feetY; everything else is a placeholder stretched to the definition's displaySize.
 * A Sprite rather than an Image so multi-frame art can play an idle animation.
 */
export class Npc extends Phaser.GameObjects.Sprite implements Interactable {
  readonly id: string;
  readonly interactionRadius: number;
  /** Mutable so a scene can change it with the story state (e.g. a locked and an unlocked gate). */
  prompt: string;
  readonly promptY: number;
  readonly kind: "dialogue" | "puzzle";
  /** Set by a scene to handle E itself; see Interactable.onInteract. */
  onInteract?: () => boolean;
  /** False hides the prompt and ignores E (e.g. a solved puzzle piece). */
  interactionEnabled = true;
  private readonly label: Phaser.GameObjects.Text;
  private glow?: Phaser.GameObjects.Image;
  private readonly art: CharacterArt | null;
  /** On-screen size in world pixels (from the art's measurements, or the definition for placeholders). */
  private readonly size: { width: number; height: number };

  constructor(scene: Phaser.Scene, def: InteractableDefinition, feetY: number) {
    super(scene, def.x, feetY, def.textureKey);
    this.id = def.id;
    this.interactionRadius = def.interactionRadius;
    this.prompt = def.prompt;
    this.kind = def.kind ?? "dialogue";

    const sizeFactor = GOD_TEXTURES.has(def.textureKey) ? GOD_SCALE : 1;
    this.art = getCharacterArt(scene, def.textureKey);
    if (this.art) {
      const { visible, feetY: artFeetY, anchorX, frameWidth, frameHeight } = this.art;
      const worldHeight = this.art.worldHeight * sizeFactor;
      const scale = worldHeight / (artFeetY - visible.y);
      this.setCrop(visible.x, visible.y, visible.width, visible.height);
      this.setOrigin(anchorX / frameWidth, artFeetY / frameHeight);
      this.setScale(scale);
      this.size = { width: visible.width * scale, height: worldHeight };
      const idle = ensureIdleAnimation(scene, def.textureKey, this.art);
      if (idle) this.play(idle);
    } else {
      this.setOrigin(0.5, 1);
      this.size = { width: def.displaySize.width * sizeFactor, height: def.displaySize.height * sizeFactor };
      this.setDisplaySize(this.size.width, this.size.height);
    }

    if (def.glowColor !== undefined) {
      // Added first so it renders behind the object.
      this.glow = scene.add
        .image(def.x, feetY - this.size.height / 2, TEXTURES.glow)
        .setTint(def.glowColor)
        .setDisplaySize(this.size.width * 2.6, this.size.height * 1.5)
        .setAlpha(0.45);
      const glow = this.glow;
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

    const nameY = feetY - this.size.height - 14;
    this.label = scene.add
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

  /** Shows or hides the character with its label and glow, and turns its interaction on or off. */
  setPresent(present: boolean): void {
    this.setVisible(present);
    this.label.setVisible(present);
    this.glow?.setVisible(present);
    this.interactionEnabled = present;
  }

  /** Shows or hides only the glow (e.g. an enchantment that has been broken). */
  setGlowVisible(visible: boolean): void {
    this.glow?.setVisible(visible);
  }

  /**
   * Where a held prop goes, in world coordinates relative to the current position: the art's hand point
   * when the character has real art, otherwise `fallback` (an offset from the feet tuned for the placeholder).
   */
  holdPoint(fallback: { x: number; y: number }): { x: number; y: number } {
    if (!this.art?.hand) return { x: this.x + fallback.x, y: this.y + fallback.y };
    const { hand, anchorX, feetY } = this.art;
    return { x: this.x + (hand.x - anchorX) * this.scaleX, y: this.y + (hand.y - feetY) * this.scaleY };
  }

  /** Moves the label and glow to follow the image after it has been moved (e.g. by a tween). */
  syncAttachments(): void {
    this.label.x = this.x;
    if (this.glow) this.glow.x = this.x;
  }
}
