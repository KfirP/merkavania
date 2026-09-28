import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import { TILE } from '../../logic/world/chunks';
import {
  projectileBlocked,
  wallBlocksProjectile,
  type CellLookup,
} from '../../logic/world/traversal';
import { Projectile } from '../entities/Projectile';

/** Owns the projectile pool and its collisions. Damage arrives with CombatSystem in M3. */
export class ProjectileSystem {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cellAt: CellLookup,
  ) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: 128,
      runChildUpdate: true,
      allowGravity: false,
    });
  }

  /** Collider for one chunk's walls: walls stop shells on their level or below, not above it. */
  addWalls(walls: Phaser.Tilemaps.TilemapLayer): Phaser.Physics.Arcade.Collider {
    return this.scene.physics.add.collider(
      this.group,
      walls,
      (p) => (p as Projectile).expire(true),
      (p, t) => {
        const tile = t as Phaser.Tilemaps.Tile;
        const cell = this.cellAt(
          Math.floor((walls.x + tile.pixelX) / TILE),
          Math.floor((walls.y + tile.pixelY) / TILE),
        );
        return wallBlocksProjectile(cell?.level ?? 0, (p as Projectile).level);
      },
    );
  }

  fire(weapon: WeaponDef, x: number, y: number, angle: number, level: number): void {
    const p = this.group.get(x, y, weapon.projectile) as Projectile | null;
    if (!p) return; // pool exhausted; dropping a bullet is better than a hitch
    const spread = weapon.spread ? Phaser.Math.FloatBetween(-weapon.spread, weapon.spread) : 0;
    p.launch(weapon, x, y, angle + spread, level);
  }

  /** Direct fire stops against rising ground (cliff faces) and flies over lower cells. */
  update(): void {
    for (const p of this.group.getMatching('active', true) as Projectile[]) {
      const cell = this.cellAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      if (projectileBlocked(p.level, cell)) p.expire(true);
    }
  }
}
