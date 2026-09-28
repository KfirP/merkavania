import Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import { Projectile } from '../entities/Projectile';

/** Owns the projectile pool and its collisions. Damage arrives with CombatSystem in M3. */
export class ProjectileSystem {
  readonly group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, walls: Phaser.Tilemaps.TilemapLayer) {
    this.group = scene.physics.add.group({
      classType: Projectile,
      maxSize: 128,
      runChildUpdate: true,
      allowGravity: false,
    });
    scene.physics.add.collider(this.group, walls, (p) => (p as Projectile).expire(true));
  }

  fire(weapon: WeaponDef, x: number, y: number, angle: number, level: number): void {
    const p = this.group.get(x, y, weapon.projectile) as Projectile | null;
    if (!p) return; // pool exhausted; dropping a bullet is better than a hitch
    const spread = weapon.spread ? Phaser.Math.FloatBetween(-weapon.spread, weapon.spread) : 0;
    p.launch(weapon, x, y, angle + spread, level);
  }
}
