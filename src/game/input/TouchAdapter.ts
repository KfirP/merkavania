import { touchMove } from '../../logic/input/mapping';
import type { TankCommand } from '../../logic/input/TankCommand';
import { initialTouchAim, stepTouchAim, type TouchAimState } from '../../logic/input/touchAim';
import { events, type GameEvents } from '../events';
import type { InputAdapter, InputContext } from './InputAdapter';
import { touchState } from './touchState';

/**
 * Reads the virtual sticks drawn by TouchControlsScene. The left stick drives; the right stick
 * aims, fires the cannon on release and, in MG mode, the coax past its outer ring (touchAim.ts).
 */
export class TouchAdapter implements InputAdapter {
  private aim: TouchAimState = initialTouchAim();
  private gunFired = false;
  private lastMgOn = touchState.mgOn;
  private readonly onFired = ({ weapon }: GameEvents['weapon:fired']) => {
    if (weapon !== 'coax_mg') this.gunFired = true;
  };

  constructor() {
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

    const toggled = mgOn !== this.lastMgOn;
    this.lastMgOn = mgOn;
    return left.active || right.active || toggled || this.aim.pending !== null;
  }

  destroy(): void {
    events.off('weapon:fired', this.onFired);
  }
}
