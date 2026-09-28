import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import type { Owner } from '../../logic/combat/faction';
import { steerMissile } from '../../logic/combat/guidance';
import type { Vec2 } from '../../logic/input/stick';
import { TILE } from '../../logic/world/chunks';
import {
  projectileBlocked,
  wallBlocksProjectile,
  type CellLookup,
} from '../../logic/world/traversal';
import { Projectile } from '../entities/Projectile';

/** Seconds between smoke puffs behind a guided missile. */
const TRAIL_INTERVAL = 0.06;

/** Called when a projectile hits a wall, a cliff face or (from CombatSystem) a target. */
export type ImpactHandler = (p: Projectile) => void;

/** Owns the projectile pool and its collisions with the world; CombatSystem handles targets. */
export class ProjectileSystem {
  readonly group: Phaser.Physics.Arcade.Group;
  onImpact: ImpactHandler | null = null;
  /** What guided missiles fired by `owner` home in on; null flies straight. */
  homingTarget: (owner: Owner) => Vec2 | null = () => null;
  /** Leaves smoke behind guided missiles so they're easy to read and dodge. */
  onTrail: ((p: Projectile) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cellAt: CellLookup,
  ) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: 256,
      runChildUpdate: true,
      allowGravity: false,
    });
  }

  /** Collider for one chunk's walls: walls stop shells on their level or below, not above it. */
  addWalls(walls: Phaser.Tilemaps.TilemapLayer): Phaser.Physics.Arcade.Collider {
    return this.scene.physics.add.collider(
      this.group,
      walls,
      (p) => this.impact(p as Projectile),
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

  fire(weapon: WeaponDef, x: number, y: number, angle: number, level: number, owner: Owner): void {
    const p = this.group.get(x, y, weapon.projectile) as Projectile | null;
    if (!p) return; // pool exhausted; dropping a bullet is better than a hitch
    const spread = weapon.spread ? Phaser.Math.FloatBetween(-weapon.spread, weapon.spread) : 0;
    p.launch(weapon, x, y, angle + spread, level, owner);
  }

  /** The projectile hit something: effects and splash (via `onImpact`), then back to the pool. */
  impact(p: Projectile): void {
    if (!p.active) return;
    this.onImpact?.(p);
    p.expire();
  }

  /**
   * Steers guided missiles, and stops direct fire against rising ground (cliff faces); lower cells
   * are flown over.
   */
  update(dt: number): void {
    for (const p of this.group.getMatching('active', true) as Projectile[]) {
      if (p.weapon.homing) {
        const target = this.homingTarget(p.owner);
        p.setHeading(steerMissile(p.angleOfTravel, p, target, p.weapon.homing, dt));
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = TRAIL_INTERVAL;
          this.onTrail?.(p);
        }
      }
      const cell = this.cellAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      if (projectileBlocked(p.level, cell)) this.impact(p);
    }
  }
}
