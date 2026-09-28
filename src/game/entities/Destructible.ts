import Phaser from 'phaser';
import type { MaterialDef } from '../../data/materials';
import { depthFor } from '../../logic/world/depth';
import type { DestructibleSpec } from '../../logic/world/objects';
import type { Damageable, Defense } from './Damageable';

/**
 * A breakable block (`destructible` object): sandbags, crates, concrete, armored plate. It blocks
 * movement and fire on its level until its HP runs out; broken ones stay broken (`WorldFlags`).
 */
export class Destructible extends Phaser.Physics.Arcade.Image implements Damageable {
  readonly combatId: string;
  readonly faction = 'neutral';
  readonly maxHp: number;
  readonly defense: Defense;
  hp: number;
  alive = true;
  declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    spec: DestructibleSpec,
    readonly material: MaterialDef,
    readonly level: number,
    private readonly onBroken: (d: Destructible) => void,
  ) {
    super(scene, spec.x, spec.y, material.sprite);
    this.combatId = spec.key;
    this.maxHp = material.hp;
    this.hp = material.hp;
    this.defense = { material };
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(spec.width || this.width, spec.height || this.height);
    this.setDepth(depthFor(level, spec.y));
  }

  get pos(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  get flashTargets() {
    return [this];
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.onBroken(this);
    this.destroy();
  }
}
