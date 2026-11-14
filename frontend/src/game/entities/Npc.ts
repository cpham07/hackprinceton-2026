import Phaser from "phaser";
import type { NpcDefinition } from "../data/npcs";
import type { Interactable } from "../systems/InteractionManager";

/** A standing NPC built from a definition. Implements Interactable. */
export class Npc extends Phaser.GameObjects.Image implements Interactable {
  readonly id: string;
  readonly interactionRadius: number;
  readonly promptY: number;

  constructor(scene: Phaser.Scene, def: NpcDefinition, feetY: number) {
    super(scene, def.x, feetY, def.textureKey);
    this.id = def.id;
    this.interactionRadius = def.interactionRadius;
    this.setOrigin(0.5, 1);
    this.setDisplaySize(def.displaySize.width, def.displaySize.height);
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
