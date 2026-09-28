import { describe, expect, it } from 'vitest';
import { AIM_TOLERANCE, SEARCH_TIME } from '../../data/enemies';
import { initialBrain, stepBrain, type BrainDef, type BrainState, type Perception } from './brain';

const def = (over: Partial<BrainDef> = {}): BrainDef => ({
  behaviour: 'armor',
  fireRange: 200,
  windup: 0.5,
  interval: 1,
  ...over,
});

const self = { x: 0, y: 0 };
const see = (x: number, over: Partial<Perception> = {}): Perception => ({
  self,
  home: self,
  target: { x, y: 0 },
  visible: true,
  aimError: 0,
  ...over,
});
const blind = (over: Partial<Perception> = {}): Perception => ({
  self,
  home: self,
  target: { x: 150, y: 0 },
  visible: false,
  aimError: 0,
  ...over,
});

/** Runs `n` steps of `dt` with the same perception. */
function run(state: BrainState, p: Perception, d: BrainDef, n: number, dt = 0.1) {
  let out = { state, intent: stepBrain(state, p, d, dt).intent };
  for (let i = 0; i < n; i++) out = stepBrain(out.state, p, d, dt);
  return out;
}

describe('stepBrain: noticing', () => {
  it('stays idle while the player is out of sight', () => {
    const { state, intent } = stepBrain(initialBrain(), blind(), def(), 0.1);
    expect(state.mode).toBe('idle');
    expect(intent.fire).toBe(false);
    expect(intent.aimAt).toBeNull();
  });

  it('spots the player, aims during the windup, then engages', () => {
    const d = def({ windup: 0.5 });
    const alert = stepBrain(initialBrain(), see(150), d, 0.1);
    expect(alert.state.mode).toBe('alert');
    expect(alert.intent.aimAt).toEqual({ x: 150, y: 0 });
    expect(alert.intent.fire).toBe(false);
    const later = run(alert.state, see(150), d, 5);
    expect(later.state.mode).toBe('engage');
  });

  it('forgets a dead player', () => {
    const engaged = run(initialBrain(), see(150), def(), 10).state;
    const { state } = stepBrain(engaged, see(150, { target: null, visible: false }), def(), 0.1);
    expect(state.mode).toBe('idle');
  });
});

describe('stepBrain: firing', () => {
  const engaged = () => run(initialBrain(), see(150), def(), 10).state;

  it('fires when aimed, in range and cooled down, then waits the interval', () => {
    const first = stepBrain({ ...engaged(), cooldown: 0 }, see(150), def(), 0.1);
    expect(first.intent.fire).toBe(true);
    // Over the next 1.2 s the 1 s interval allows exactly one more shot.
    let state = first.state;
    let fired = 0;
    for (let i = 0; i < 12; i++) {
      const out = stepBrain(state, see(150), def(), 0.1);
      state = out.state;
      if (out.intent.fire) fired++;
    }
    expect(fired).toBe(1);
  });

  it('holds fire while the aim is off or the target is out of range', () => {
    const s = { ...engaged(), cooldown: 0 };
    expect(stepBrain(s, see(150, { aimError: AIM_TOLERANCE * 2 }), def(), 0.1).intent.fire).toBe(
      false,
    );
    expect(stepBrain(s, see(250), def(), 0.1).intent.fire).toBe(false);
  });
});

describe('stepBrain: losing the player', () => {
  it('searches the last known spot, then gives up', () => {
    const engaged = run(initialBrain(), see(150), def(), 10).state;
    const search = stepBrain(engaged, blind({ target: { x: 300, y: 0 } }), def(), 0.1);
    expect(search.state.mode).toBe('search');
    expect(search.intent.moveTo).toEqual({ x: 150, y: 0 });
    expect(search.intent.fire).toBe(false);
    const done = run(search.state, blind(), def(), Math.ceil(SEARCH_TIME / 0.1) + 1);
    expect(done.state.mode).toBe('idle');
  });

  it('re-engages straight away if it sees the player while searching', () => {
    const engaged = run(initialBrain(), see(150), def(), 10).state;
    const search = stepBrain(engaged, blind(), def(), 0.1).state;
    expect(stepBrain(search, see(120), def(), 0.1).state.mode).toBe('engage');
  });
});

describe('stepBrain: movement by behaviour', () => {
  const engage = (d: BrainDef, p: Perception) =>
    stepBrain(run(initialBrain(), p, d, 10).state, p, d, 0.1).intent.moveTo;

  it('patrols its waypoints in a loop while idle', () => {
    const patrol = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const p = blind({ patrol });
    const first = stepBrain(initialBrain(), p, def(), 0.1);
    // Standing on waypoint 0 already, so it heads for waypoint 1.
    expect(first.intent.moveTo).toEqual({ x: 100, y: 0 });
    const there = stepBrain(first.state, { ...p, self: { x: 100, y: 0 } }, def(), 0.1);
    expect(there.intent.moveTo).toEqual({ x: 0, y: 0 });
  });

  it('walks home when idle away from its spawn without a patrol', () => {
    const p = blind({ self: { x: 50, y: 0 }, home: { x: 0, y: 0 } });
    expect(stepBrain(initialBrain(), p, def(), 0.1).intent.moveTo).toEqual({ x: 0, y: 0 });
  });

  it('armor closes in from long range and holds at firing range', () => {
    expect(engage(def({ behaviour: 'armor' }), see(190))).toEqual({ x: 190, y: 0 });
    expect(engage(def({ behaviour: 'armor' }), see(100))).toBeNull();
  });

  it('infantry scatters away from a close tank, and holds otherwise', () => {
    const flee = engage(def({ behaviour: 'infantry' }), see(30))!;
    expect(flee.x).toBeLessThan(0);
    expect(engage(def({ behaviour: 'infantry' }), see(150))).toBeNull();
  });

  it('raiders circle the player at a distance', () => {
    const to = engage(def({ behaviour: 'raider' }), see(150))!;
    const r = Math.hypot(to.x - 150, to.y);
    expect(r).toBeCloseTo(200 * 0.6, 0);
    expect(Math.abs(to.y)).toBeGreaterThan(1);
  });

  it('static emplacements never move', () => {
    expect(engage(def({ behaviour: 'static' }), see(30))).toBeNull();
    const p = blind({ self: { x: 50, y: 0 }, home: { x: 0, y: 0 } });
    expect(stepBrain(initialBrain(), p, def({ behaviour: 'static' }), 0.1).intent.moveTo).toBe(
      null,
    );
  });
});
