import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import type { Owner } from '../../logic/combat/faction';
import { depthFor } from '../../logic/world/depth';
import type { SwitchSpec } from '../../logic/world/objects';
import type { PawnKind } from '../../data/terrain';
import { activates, pawnActivates } from '../../logic/world/switches';
import type { Trigger } from '../systems/CombatSystem';

/**
 * A `switch` object: the right hit, or the right pawn walking onto it (activatedBy; see
 * logic/world/switches.ts), flips it on for good. Other shots just stop on it.
 */
export class Switch extends Phaser.Physics.Arcade.Image implements Trigger {
  declare body: Phaser.Physics.Arcade.StaticBody;

  constructor(
    scene: Phaser.Scene,
    readonly spec: SwitchSpec,
    readonly level: number,
    public activated: boolean,
    private readonly onActivated: (s: Switch) => void,
  ) {
    super(scene, spec.x, spec.y, activated ? 'switch_on' : 'switch_off');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(depthFor(level, spec.y));
  }

  get pos(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  hitBy(weapon: WeaponDef, owner: Owner): void {
    if (activates(this.spec.activatedBy, weapon.id, owner)) this.flip();
  }

  /** A pawn on its level is standing on it. */
  touchedBy(pawn: PawnKind): void {
    if (pawnActivates(this.spec.activatedBy, pawn)) this.flip();
  }

  private flip(): void {
    if (this.activated) return;
    this.activated = true;
    this.setTexture('switch_on');
    this.onActivated(this);
  }
}
