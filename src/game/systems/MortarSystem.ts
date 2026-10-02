import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import type { Owner } from '../../logic/combat/faction';
import { arcHeight, flightTime, lobTarget } from '../../logic/combat/mortar';
import { ABOVE_DEPTH, depthFor } from '../../logic/world/depth';
import { levelAt, type CellLookup } from '../../logic/world/traversal';
import { events } from '../events';
import type { CombatSystem } from './CombatSystem';

interface Shell {
  weapon: WeaponDef;
  owner: Owner;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  from: { x: number; y: number };
  to: { x: number; y: number };
  elapsed: number;
  duration: number;
}

/**
 * Lobbed shells (docs/ARCHITECTURE.md, Elevation): they arc over walls and levels, drawn above
 * everything with a shadow on the ground, and explode on the level of the cell they land on.
 */
export class MortarSystem {
  private readonly shells: Shell[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly combat: CombatSystem,
    private readonly cellAt: CellLookup,
  ) {}

  /** Fires `weapon` (which must have `lob`) from `from` toward `angle`, landing `distance` away. */
  launch(
    weapon: WeaponDef,
    from: { x: number; y: number },
    angle: number,
    distance: number | null,
    owner: Owner,
  ): void {
    if (!weapon.lob) throw new Error(`${weapon.id} is not a lobbed weapon`);
    const to = lobTarget(from, angle, distance, {
      minRange: weapon.lob.minRange,
      maxRange: weapon.range,
    });
    this.shells.push({
      weapon,
      owner,
      sprite: this.scene.add.image(from.x, from.y, weapon.projectile).setDepth(ABOVE_DEPTH - 1),
      shadow: this.scene.add.image(from.x, from.y, 'shadow'),
      from: { ...from },
      to,
      elapsed: 0,
      duration: flightTime(to.distance, weapon.speed),
    });
    events.emit('weapon:fired', { weapon: weapon.id });
  }

  update(dt: number): void {
    for (const s of [...this.shells]) {
      s.elapsed += dt;
      const t = Math.min(1, s.elapsed / s.duration);
      const x = Phaser.Math.Linear(s.from.x, s.to.x, t);
      const y = Phaser.Math.Linear(s.from.y, s.to.y, t);
      s.shadow.setPosition(x, y).setDepth(depthFor(levelAt(x, y, this.cellAt), y) + 0.5);
      s.sprite.setPosition(x, y - arcHeight(t, s.weapon.lob!.apex));
      if (t >= 1) this.land(s);
    }
  }

  destroy(): void {
    for (const s of this.shells) {
      s.sprite.destroy();
      s.shadow.destroy();
    }
    this.shells.length = 0;
  }

  private land(s: Shell): void {
    this.shells.splice(this.shells.indexOf(s), 1);
    s.sprite.destroy();
    s.shadow.destroy();
    const { x, y } = s.to;
    const level = levelAt(x, y, this.cellAt);
    this.combat.explode({
      x,
      y,
      level,
      owner: s.owner,
      weapon: s.weapon,
      depth: depthFor(level, y) + 1,
    });
    events.emit('mortar:landed', { x, y, level });
  }
}
