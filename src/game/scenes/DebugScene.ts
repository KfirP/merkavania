import Phaser from 'phaser';
import { t } from '../../i18n/i18n';
import { events, type GameEvents, type PawnTelemetry, type WorldState } from '../events';
import { SceneKey } from './keys';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '8px',
  color: '#ffffff',
  backgroundColor: '#00000080',
  padding: { x: 2, y: 1 },
};

/** Debug overlay (`?debug=1` or dev builds). Backtick shows/hides it; 1 toggles physics bodies. */
export class DebugScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.Text;
  private pawn: PawnTelemetry | null = null;
  private gun: GameEvents['gun:state'] | null = null;
  private world: WorldState | null = null;
  /** DOM `code`s pressed since the last frame, in order. */
  private pressed: string[] = [];

  constructor() {
    super(SceneKey.Debug);
  }

  create(): void {
    this.text = this.add.text(2, 2, '', TEXT_STYLE).setScrollFactor(0);

    // Plain DOM presses, consumed once per frame. Phaser re-dispatches its per-frame key queue on
    // every key event (so `keydown-*` listeners can fire twice), and JustDown loses a press whose
    // down and up land in the same frame.
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat) this.pressed.push(e.code);
    };
    window.addEventListener('keydown', onKey);

    const onPawn = (p: PawnTelemetry) => (this.pawn = p);
    const onGun = (g: GameEvents['gun:state']) => (this.gun = g);
    const onWorld = (w: WorldState) => (this.world = w);
    events.on('debug:pawn', onPawn);
    events.on('gun:state', onGun);
    events.on('world:chunks', onWorld);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off('debug:pawn', onPawn);
      events.off('gun:state', onGun);
      events.off('world:chunks', onWorld);
      window.removeEventListener('keydown', onKey);
    });
  }

  override update(): void {
    for (const code of this.pressed.splice(0)) {
      if (code === 'Backquote') this.text.setVisible(!this.text.visible);
      else if (code === 'Digit1' && this.text.visible) events.emit('debug:toggleBodies', undefined);
      else if (code === 'Digit2' && this.text.visible)
        events.emit('debug:toggleElevation', undefined);
    }
    if (!this.text.visible) return;
    const deg = (rad: number) => Math.round(Phaser.Math.RadToDeg(rad));
    const lines = [t('debug.fps', { fps: Math.round(this.game.loop.actualFps) })];
    if (this.pawn) {
      const p = this.pawn;
      lines.push(
        t('debug.pawn', {
          x: Math.round(p.x),
          y: Math.round(p.y),
          heading: deg(p.heading),
          speed: Math.round(p.speed),
          turret: deg(p.turretAngle),
        }),
        t('debug.input', { device: p.device }),
      );
      if (this.world)
        lines.push(
          t('debug.world', { chunk: p.chunk, level: p.level, loaded: this.world.loaded.length }),
        );
    }
    if (this.gun)
      lines.push(
        this.gun.refillRemaining > 0
          ? t('debug.gun_refill', { seconds: this.gun.refillRemaining.toFixed(1) })
          : t('debug.gun', { rounds: this.gun.rounds, max: this.gun.max }),
      );
    lines.push(t('debug.hint'));
    this.text.setText(lines);
  }
}
