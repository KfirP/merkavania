import Phaser from 'phaser';
import { getAsset } from '../../data/assetManifest';
import type { BossDef } from '../../data/bosses';
import { weapons, type WeaponDef } from '../../data/weapons';
import {
  initialBoss,
  railPoint,
  stepBoss,
  type BossInput,
  type BossIntent,
  type BossState,
} from '../../logic/enemy/bossBrain';
import { offsetFrom } from '../../logic/tank/geometry';
import { depthFor } from '../../logic/world/depth';
import type { BossSpec } from '../../logic/world/objects';
import type { ProjectileSystem } from '../systems/ProjectileSystem';
import type { Damageable, Defense } from './Damageable';

const LASER_COLOR = 0xff3030;
const RAIL_COLOR = 0x4a4636;
const TIE_COLOR = 0x6e5030;

/**
 * A boss (data/bosses.ts): a static, fortified body (the bunker) and a gun that slides along its
 * rail. logic/enemy/bossBrain.ts decides; this carries it out and draws the warning laser.
 */
export class Boss extends Phaser.Physics.Arcade.Image implements Damageable {
  readonly faction = 'enemy';
  readonly combatId: string;
  readonly maxHp: number;
  readonly defense: Defense;
  readonly halfExtent: { w: number; h: number };
  readonly weapon: WeaponDef;
  readonly gun: Phaser.GameObjects.Image;
  hp: number;
  alive = true;
  declare body: Phaser.Physics.Arcade.StaticBody;
  readonly brain: BossState;
  /** Shots fired since it spawned (debug telemetry). */
  shots = 0;
  private readonly laser: Phaser.GameObjects.Graphics;
  private readonly track: Phaser.GameObjects.Graphics;
  private target: { x: number; y: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly spec: BossSpec,
    readonly def: BossDef,
    readonly level: number,
    private readonly onKilled: (b: Boss) => void,
  ) {
    super(scene, spec.x, spec.y, def.sprites.body);
    this.combatId = spec.key;
    this.maxHp = this.hp = def.hp;
    this.defense = { armor: def.armor, weakTo: def.weakTo };
    this.halfExtent = { w: def.size.width / 2, h: def.size.height / 2 };
    this.weapon = weapons[def.gun.weapon];
    this.brain = initialBoss(spec.rail);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(def.size.width, def.size.height);
    this.setDepth(depthFor(level, spec.y));

    this.track = scene.add.graphics().setDepth(depthFor(level, 0));
    this.drawTrack();
    const origin = getAsset(def.sprites.gun).origin ?? { x: 0.5, y: 0.5 };
    this.gun = scene.add.image(0, 0, def.sprites.gun).setOrigin(origin.x, origin.y);
    this.laser = scene.add.graphics();
    this.syncGun();
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.gun.destroy();
      this.laser.destroy();
      this.track.destroy();
    });
  }

  get pos(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  get flashTargets() {
    return [this, this.gun];
  }

  /** Where the gun sits on its rail now. */
  get gunPos(): { x: number; y: number } {
    return railPoint(this.spec.rail, this.brain.railPos);
  }

  step(input: BossInput, dt: number, projectiles: ProjectileSystem): BossIntent {
    this.target = input.target;
    const intent = stepBoss(this.brain, this.def, this.spec.rail, input, dt);
    this.syncGun();
    if (intent.fire) this.fire(projectiles);
    return intent;
  }

  /** Back to sleep at full HP (the player died in the fight). */
  reset(): void {
    if (!this.alive) return;
    this.hp = this.maxHp;
    Object.assign(this.brain, initialBoss(this.spec.rail));
    this.target = null;
    this.syncGun();
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.brain.mode = 'dead';
    this.onKilled(this);
    this.destroy();
  }

  private fire(projectiles: ProjectileSystem): void {
    const gun = this.gunPos;
    const tip = offsetFrom(gun.x, gun.y, this.brain.aim, this.def.gun.muzzle, 0);
    projectiles.fire(this.weapon, tip.x, tip.y, this.brain.aim, this.level, 'enemy');
    this.shots++;
    const flash = this.scene.add
      .image(tip.x, tip.y, 'muzzle_flash')
      .setOrigin(getAsset('muzzle_flash').origin?.x ?? 0, 0.5)
      .setRotation(this.brain.aim)
      .setDepth(this.gun.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 120,
      onComplete: () => flash.destroy(),
    });
    this.scene.cameras.main.shake(120, 0.004);
  }

  private syncGun(): void {
    const gun = this.gunPos;
    this.gun
      .setPosition(gun.x, gun.y)
      .setRotation(this.brain.aim)
      .setDepth(depthFor(this.level, gun.y) + 0.5);
    this.laser.clear();
    if (!this.brain.telegraphing || !this.target) return;
    const tip = offsetFrom(gun.x, gun.y, this.brain.aim, this.def.gun.muzzle, 0);
    const len = Math.hypot(this.target.x - tip.x, this.target.y - tip.y);
    const end = offsetFrom(tip.x, tip.y, this.brain.aim, len, 0);
    const blink = Math.floor(this.brain.cooldown * 10) % 2 === 0 ? 0.95 : 0.45;
    this.laser
      .setDepth(this.gun.depth + 1)
      .lineStyle(1, LASER_COLOR, blink)
      .lineBetween(tip.x, tip.y, end.x, end.y);
  }

  /** The rail under the gun: two steel lines on wooden ties. */
  private drawTrack(): void {
    const rail = this.spec.rail;
    const g = this.track;
    for (let i = 1; i < rail.length; i++) {
      const a = rail[i - 1]!;
      const b = rail[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      g.fillStyle(TIE_COLOR);
      for (let d = 0; d <= len; d += 6) {
        const p = offsetFrom(a.x, a.y, angle, d, 0);
        const l = offsetFrom(p.x, p.y, angle, 0, -6);
        const r = offsetFrom(p.x, p.y, angle, 0, 6);
        g.lineStyle(2, TIE_COLOR).lineBetween(l.x, l.y, r.x, r.y);
      }
      for (const side of [-4, 4]) {
        const s = offsetFrom(a.x, a.y, angle, 0, side);
        const e = offsetFrom(b.x, b.y, angle, 0, side);
        g.lineStyle(1, RAIL_COLOR).lineBetween(s.x, s.y, e.x, e.y);
      }
    }
  }
}
