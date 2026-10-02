import Phaser from 'phaser';
import { isRtl, t, type I18nKey } from '../../i18n/i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import { events, type GameEvents } from '../events';
import { SceneKey } from './keys';

const BAR = { x: 4, width: 60, height: 4 };
const HP_COLOR = 0x6fbf4a;
const HP_LOW_COLOR = 0xd6453e;
/** Below this share of max HP the bar turns red. */
const LOW_HP = 0.3;
/** How long a pickup or depot message stays up, ms. */
const TOAST_MS = 2600;

const textStyle = (size: number): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'monospace',
  fontSize: `${size}px`,
  color: '#f0e6c8',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  padding: { x: 3, y: 2 },
  rtl: isRtl(),
});

/**
 * Runs on top of WorldScene: the active pawn's HP bar and the selected secondary (bottom left), and
 * a short message for pickups, depots and the hatch (bottom centre). M6 grows it into the full HUD. Driven only by events,
 * never by reaching into WorldScene.
 */
export class HudScene extends Phaser.Scene {
  private fill!: Phaser.GameObjects.Rectangle;
  private secondary!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  /** Whose HP the bar shows: the tank (`player`) or the scout while it's out. */
  private hpTarget = 'player';

  constructor() {
    super(SceneKey.Hud);
  }

  create(): void {
    const y = GAME_HEIGHT - BAR.height - 4;
    this.add
      .rectangle(BAR.x - 1, y - 1, BAR.width + 2, BAR.height + 2, 0x000000, 0.6)
      .setOrigin(0)
      .setStrokeStyle(1, 0x1f1f10);
    this.fill = this.add.rectangle(BAR.x, y, BAR.width, BAR.height, HP_COLOR).setOrigin(0);
    this.secondary = this.add.text(BAR.x - 1, y - 3, '', textStyle(8)).setOrigin(0, 1);
    // Bottom centre: clear of the debug overlay and of the HP bar.
    this.toast = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 24, '', textStyle(8))
      .setOrigin(0.5, 1)
      .setVisible(false);

    const pawn = events.latest('pawn:switched');
    if (pawn) this.onPawn(pawn);
    const hp = events.latest('hp:changed');
    if (hp) this.onHp(hp);
    const loadout = events.latest('loadout:changed');
    if (loadout) this.onLoadout(loadout);

    events.on('hp:changed', this.onHp, this);
    events.on('loadout:changed', this.onLoadout, this);
    events.on('pickup:collected', this.onPickup, this);
    events.on('depot:used', this.onDepot, this);
    events.on('pawn:switched', this.onPawn, this);
    events.on('hatch:refused', this.onHatchRefused, this);
    events.on('scout:died', this.onScoutDied, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off('pawn:switched', this.onPawn, this);
      events.off('hatch:refused', this.onHatchRefused, this);
      events.off('scout:died', this.onScoutDied, this);
      events.off('hp:changed', this.onHp, this);
      events.off('loadout:changed', this.onLoadout, this);
      events.off('pickup:collected', this.onPickup, this);
      events.off('depot:used', this.onDepot, this);
    });
  }

  private onHp({ target, hp, max }: GameEvents['hp:changed']): void {
    if (target !== this.hpTarget) return;
    const share = Phaser.Math.Clamp(hp / max, 0, 1);
    this.fill.width = Math.ceil(BAR.width * share);
    this.fill.fillColor = share < LOW_HP ? HP_LOW_COLOR : HP_COLOR;
  }

  private onLoadout({ selected, ammo, capacity }: GameEvents['loadout:changed']): void {
    this.secondary.setText(
      t(`hud.secondary.${selected}` as I18nKey, { ammo: ammo ?? 0, max: capacity ?? 0 }),
    );
  }

  private onPickup({ ability, minor }: GameEvents['pickup:collected']): void {
    const id = ability ?? minor;
    if (id) this.showToast(t(`pickup.${id}` as I18nKey));
  }

  private onDepot({ saved }: GameEvents['depot:used']): void {
    this.showToast(t(saved ? 'depot.saved' : 'depot.save_failed'));
  }

  private onPawn({ kind }: GameEvents['pawn:switched']): void {
    this.hpTarget = kind === 'scout' ? 'scout' : 'player';
  }

  private onHatchRefused({ reason }: GameEvents['hatch:refused']): void {
    if (reason === 'blocked') this.showToast(t('hatch.blocked'));
    if (reason === 'moving') this.showToast(t('hatch.moving'));
  }

  private onScoutDied(): void {
    this.showToast(t('hatch.scout_down'));
  }

  private showToast(text: string): void {
    this.toast.setText(text).setVisible(true).setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(TOAST_MS, () =>
      this.tweens.add({ targets: this.toast, alpha: 0, duration: 300 }),
    );
  }
}
