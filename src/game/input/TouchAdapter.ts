import type Phaser from 'phaser';
import { touchMove } from '../../logic/input/mapping';
import { angleTo } from '../../logic/input/stick';
import type { TankCommand } from '../../logic/input/TankCommand';
import { initialTouchAim, stepTouchAim, type TouchAimState } from '../../logic/input/touchAim';
import { initialTouchLob, stepTouchLob, type TouchLobState } from '../../logic/input/touchLob';
import { events, type GameEvents } from '../events';
import type { InputAdapter, InputContext } from './InputAdapter';
import { touchState } from './touchState';

/**
 * Reads the virtual sticks drawn by TouchControlsScene. The left stick drives; the right stick
 * aims, fires the cannon on release and, in MG mode, the coax past its outer ring (touchAim.ts).
 * The mortar button lobs a shell at the spot the finger lifts (touchLob.ts).
 */
export class TouchAdapter implements InputAdapter {
  private aim: TouchAimState = initialTouchAim();
  private lob: TouchLobState = initialTouchLob();
  private gunFired = false;
  private lastMgOn = touchState.mgOn;
  private readonly onFired = ({ weapon }: GameEvents['weapon:fired']) => {
    if (weapon !== 'coax_mg') this.gunFired = true;
  };

  constructor(private readonly scene: Phaser.Scene) {
    events.on('weapon:fired', this.onFired);
  }

  poll(cmd: TankCommand, ctx: InputContext): boolean {
    const { left, right, mgOn } = touchState;
    const r = stepTouchAim(this.aim, {
      right,
      mgOn,
      turretAngle: ctx.turretAngle,
      gunFired: this.gunFired,
      dt: ctx.dt,
    });
    this.aim = r.state;
    this.gunFired = false;
    Object.assign(cmd, touchMove(left));
    cmd.aimAngle = r.aimAngle;
    cmd.fire = r.fire;
    cmd.altFire = r.altFire;
    cmd.altCoax = true; // MG mode is always the coax; the mortar has its own button

    const lob = stepTouchLob(this.lob, touchState.lob);
    this.lob = lob.state;
    if (lob.fire) {
      const at = this.scene.cameras.main.getWorldPoint(touchState.lob.x, touchState.lob.y);
      cmd.lob = {
        angle: angleTo(ctx.x, ctx.y, at.x, at.y),
        distance: Math.hypot(at.x - ctx.x, at.y - ctx.y),
      };
    }

    const toggled = mgOn !== this.lastMgOn;
    this.lastMgOn = mgOn;
    return (
      left.active ||
      right.active ||
      toggled ||
      this.aim.pending !== null ||
      touchState.lob.active ||
      lob.fire
    );
  }

  destroy(): void {
    events.off('weapon:fired', this.onFired);
  }
}
