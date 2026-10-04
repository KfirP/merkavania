import Phaser from 'phaser';
import { isRtl, onLanguageChange, t, type I18nKey } from '../../i18n/i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../../logic/scale';
import {
  HP_BAR,
  hudLayout,
  MINIMAP_CELL,
  PIP,
  type HudAnchor,
  type HudElement,
} from '../../logic/ui/hudLayout';
import { minimapCells, type MinimapCell } from '../../logic/ui/minimap';
import { RADIO_MAX_LINE } from '../../data/radio';
import { RadioQueue, revealedChars } from '../../logic/world/radio';
import { events, type GameEvents } from '../events';
import { textStyle, UI_PANEL } from '../ui/text';
import { SceneKey } from './keys';

const HP_COLOR = 0x6fbf4a;
const HP_LOW_COLOR = 0xd6453e;
/** Below this share of max HP the bar turns red. */
const LOW_HP = 0.3;
/** How long a pickup or depot message stays up, ms. */
const TOAST_MS = 2600;
const PIP_FULL = 0xf0e6c8;
const PIP_EMPTY = 0x4a4636;
const CELL_COLOR: Record<MinimapCell, number | null> = {
  none: null,
  unknown: null,
  visited: 0x8a7f5a,
  current: 0xf0e6c8,
};

/** The radio panel: top centre, under the touch map/pause buttons. */
const RADIO = { y: 28, width: RADIO_MAX_LINE * 8 + 8, pad: 4, line: 10 };
const RADIO_SPEAKER_COLOR = '#f0c040';
/** The boss bar: bottom centre, between the status block and the minimap side. */
const BOSS_BAR = { y: GAME_HEIGHT - 12, width: 200, height: 4 };
const BOSS_COLOR = 0xd6453e;

const hudText = () => textStyle(1, { backgroundColor: UI_PANEL, padding: { x: 2, y: 1 } });

/** What the `getHud` debug hook reports. */
export interface HudSnapshot {
  rtl: boolean;
  tier: string;
  hpText: string;
  hpBarX: number;
  secondary: string;
  /** Null while the tank has no repair kits. */
  repair: string | null;
  gunRounds: number;
  gunMax: number;
  /** The boss bar while a boss is awake: its name and the share of HP left. */
  boss: { name: string; share: number } | null;
  minimap: MinimapCell[][];
  /** The radio message on screen (text typed so far) and the keys waiting; null when quiet. */
  radio: { messageKey: string; speaker: string; shown: string; queued: string[] } | null;
}

/**
 * Runs on top of WorldScene. Bottom corner on the reading side: the Mk tier and main-gun rounds,
 * the selected secondary and repair kits, the active pawn's HP bar. Top corner opposite: a 3×3
 * minimap of the chunks around you. Bottom centre: short messages for pickups, depots, the hatch
 * and repairs. Mirrors in RTL (`logic/ui/hudLayout`), and rebuilds when the language changes.
 * Driven only by events, never by reaching into WorldScene.
 */
export class HudScene extends Phaser.Scene {
  private layout!: Record<HudElement, HudAnchor>;
  private fill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private tier!: Phaser.GameObjects.Text;
  private secondary!: Phaser.GameObjects.Text;
  private repair!: Phaser.GameObjects.Text;
  private pips!: Phaser.GameObjects.Graphics;
  private minimap!: Phaser.GameObjects.Graphics;
  private toast!: Phaser.GameObjects.Text;
  private toastTimer: Phaser.Time.TimerEvent | null = null;
  private bossName!: Phaser.GameObjects.Text;
  private bossBack!: Phaser.GameObjects.Rectangle;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private radioPanel!: Phaser.GameObjects.Rectangle;
  private radioSpeaker!: Phaser.GameObjects.Text;
  private radioText!: Phaser.GameObjects.Text;
  /** Survives language rebuilds (its texts are re-translated). */
  private readonly radio = new RadioQueue();
  /** Whose HP the bar shows: the tank (`player`) or the scout while it's out. */
  private hpTarget = 'player';
  private gun = { rounds: 0, max: 0 };
  private cells: MinimapCell[][] = [];
  /** The last payloads shown, replayed when a language change rebuilds the HUD. */
  private shown: {
    hp: Map<string, GameEvents['hp:changed']>;
    loadout?: GameEvents['loadout:changed'];
    tier?: GameEvents['tank:tier'];
    gun?: GameEvents['gun:state'];
    repair?: GameEvents['repair:changed'];
    boss?: GameEvents['boss:state'];
  } = { hp: new Map() };

  constructor() {
    super(SceneKey.Hud);
  }

  create(): void {
    this.radio.clear();
    this.hpTarget = 'player';
    this.shown = { hp: new Map() };
    this.build();

    const handlers: { [K in keyof GameEvents]?: (p: GameEvents[K]) => void } = {
      'pawn:switched': this.onPawn,
      'hp:changed': this.onHp,
      'loadout:changed': this.onLoadout,
      'tank:tier': this.onTier,
      'gun:state': this.onGun,
      'repair:changed': this.onRepair,
      'map:changed': this.onMap,
      'world:chunks': this.onChunks,
      'boss:state': this.onBoss,
    };
    // Overlays start after WorldScene's first emits: catch up, then follow.
    for (const [name, fn] of Object.entries(handlers)) {
      const event = name as keyof GameEvents;
      const latest = events.latest(event);
      if (latest !== undefined) (fn as (p: unknown) => void).call(this, latest);
      events.on(event, fn as (p: unknown) => void, this);
    }
    const toasts: { [K in keyof GameEvents]?: (p: GameEvents[K]) => void } = {
      'pickup:collected': this.onPickup,
      'depot:used': this.onDepot,
      'hatch:refused': this.onHatchRefused,
      'scout:died': this.onScoutDied,
      'repair:used': this.onRepairUsed,
      'radio:message': this.onRadio,
      'radio:skip': this.onRadioSkip,
      'tank:upgraded': this.onUpgraded,
    };
    for (const [name, fn] of Object.entries(toasts))
      events.on(name as keyof GameEvents, fn as (p: unknown) => void, this);

    const offLanguage = onLanguageChange(() => this.rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offLanguage();
      for (const [name, fn] of Object.entries({ ...handlers, ...toasts }))
        events.off(name as keyof GameEvents, fn as (p: unknown) => void, this);
    });
  }

  /** A new language may flip the layout: redraw everything from what was last shown. */
  private rebuild(): void {
    this.toastTimer?.remove();
    this.toastTimer = null;
    this.tweens.killAll();
    this.children.removeAll(true);
    this.build();
    const { hp, loadout, tier, gun, repair, boss } = this.shown;
    for (const payload of hp.values()) this.onHp(payload);
    if (loadout) this.onLoadout(loadout);
    if (tier) this.onTier(tier);
    if (gun) this.onGun(gun);
    if (repair) this.onRepair(repair);
    if (boss) this.onBoss(boss);
    this.drawMinimap();
    this.radio.retext((m) => t(m.messageKey as I18nKey));
  }

  override update(_time: number, delta: number): void {
    // The radio holds still while the world is paused (pause menu, map).
    if (!this.scene.isPaused(SceneKey.World)) this.radio.tick(delta / 1000);
    this.drawRadio();
  }

  private build(): void {
    const l = (this.layout = hudLayout(isRtl()));

    const bar = l.hpBar;
    this.add
      .rectangle(bar.x - bar.dir, bar.y - 1, HP_BAR.width + 2, HP_BAR.height + 2, 0x000000, 0.6)
      .setOrigin(bar.originX, 0)
      .setStrokeStyle(1, 0x1f1f10);
    this.fill = this.add
      .rectangle(bar.x, bar.y, HP_BAR.width, HP_BAR.height, HP_COLOR)
      .setOrigin(bar.originX, 0);
    const text = (a: HudAnchor) => this.add.text(a.x, a.y, '', hudText()).setOrigin(a.originX, 0);
    this.hpText = text(l.hpText);
    this.tier = text(l.tier);
    this.secondary = text(l.secondary);
    this.repair = text(l.repair).setVisible(false);
    this.pips = this.add.graphics();
    this.minimap = this.add.graphics();
    // Bottom centre: clear of the debug overlay and of the status block.
    this.toast = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '', {
        ...hudText(),
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 160 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);

    this.bossName = this.add
      .text(GAME_WIDTH / 2, BOSS_BAR.y - 2, '', hudText())
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.bossBack = this.add
      .rectangle(GAME_WIDTH / 2, BOSS_BAR.y, BOSS_BAR.width + 2, BOSS_BAR.height + 2, 0, 0.6)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x1f1f10)
      .setVisible(false);
    this.bossFill = this.add
      .rectangle(
        (GAME_WIDTH - BOSS_BAR.width) / 2,
        BOSS_BAR.y + 1,
        BOSS_BAR.width,
        BOSS_BAR.height,
        BOSS_COLOR,
      )
      .setOrigin(0, 0)
      .setVisible(false);

    const rtl = isRtl();
    const left = (GAME_WIDTH - RADIO.width) / 2;
    const textX = rtl ? left + RADIO.width - RADIO.pad : left + RADIO.pad;
    this.radioPanel = this.add
      .rectangle(GAME_WIDTH / 2, RADIO.y, RADIO.width, RADIO.line, 0x000000, 0.75)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, 0x8a7f5a)
      .setVisible(false)
      .setInteractive()
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.radio.skip());
    this.radioSpeaker = this.add
      .text(textX, RADIO.y + RADIO.pad, '', textStyle(1, { color: RADIO_SPEAKER_COLOR }))
      .setOrigin(rtl ? 1 : 0, 0)
      .setVisible(false);
    this.radioText = this.add
      .text(textX, RADIO.y + RADIO.pad + RADIO.line + 2, '', textStyle(1))
      .setOrigin(rtl ? 1 : 0, 0)
      .setVisible(false);
  }

  private drawRadio(): void {
    const cur = this.radio.current;
    for (const o of [this.radioPanel, this.radioSpeaker, this.radioText]) o.setVisible(!!cur);
    if (!cur) return;
    this.radioSpeaker.setText(t(`radio.speaker.${cur.speaker}` as I18nKey));
    this.radioText.setText(cur.text.slice(0, revealedChars(cur.text, cur.elapsed)));
    const lines = cur.text.split('\n').length;
    this.radioPanel.height = RADIO.pad * 2 + RADIO.line * (lines + 1) + 2;
    this.radioPanel.input?.hitArea.setSize(RADIO.width, this.radioPanel.height);
  }

  private onRadio({ messageKey, speaker }: GameEvents['radio:message']): void {
    this.radio.push({ messageKey, speaker, text: t(messageKey as I18nKey) });
  }

  private onBoss(boss: GameEvents['boss:state']): void {
    this.shown.boss = boss;
    for (const o of [this.bossName, this.bossBack, this.bossFill]) o.setVisible(boss.active);
    if (!boss.active) return;
    this.bossName.setText(t(`boss.${boss.bossType}` as I18nKey));
    this.bossFill.width = Math.ceil((BOSS_BAR.width * boss.hp) / boss.max);
    // The bar drains toward the reading side's end.
    this.bossFill.x = isRtl()
      ? (GAME_WIDTH + BOSS_BAR.width) / 2 - this.bossFill.width
      : (GAME_WIDTH - BOSS_BAR.width) / 2;
  }

  private onUpgraded({ mk }: GameEvents['tank:upgraded']): void {
    this.showToast(t(`upgrade.${mk}` as I18nKey));
  }

  private onRadioSkip(): void {
    this.radio.skip();
  }

  snapshot(): HudSnapshot {
    return {
      rtl: isRtl(),
      tier: this.tier.text,
      hpText: this.hpText.text,
      hpBarX: this.fill.getBounds().x,
      secondary: this.secondary.text,
      repair: this.repair.visible ? this.repair.text : null,
      gunRounds: this.gun.rounds,
      gunMax: this.gun.max,
      boss: this.bossFill.visible
        ? { name: this.bossName.text, share: this.bossFill.width / BOSS_BAR.width }
        : null,
      minimap: this.cells.map((row) => [...row]),
      radio: this.radio.current && {
        messageKey: this.radio.current.messageKey,
        speaker: this.radio.current.speaker,
        shown: this.radioText.text,
        queued: this.radio.queued.map((m) => m.messageKey),
      },
    };
  }

  private onHp(payload: GameEvents['hp:changed']): void {
    const { target, hp, max } = payload;
    if (target === 'player' || target === 'scout') this.shown.hp.set(target, payload);
    if (target !== this.hpTarget) return;
    const share = Phaser.Math.Clamp(hp / max, 0, 1);
    this.fill.width = Math.ceil(HP_BAR.width * share);
    this.fill.fillColor = share < LOW_HP ? HP_LOW_COLOR : HP_COLOR;
    this.hpText.setText(String(Math.ceil(hp)));
  }

  private onLoadout(loadout: GameEvents['loadout:changed']): void {
    this.shown.loadout = loadout;
    const { selected, ammo, capacity } = loadout;
    this.secondary.setText(
      t(`hud.secondary.${selected}` as I18nKey, { ammo: ammo ?? 0, max: capacity ?? 0 }),
    );
  }

  private onTier(tier: GameEvents['tank:tier']): void {
    this.shown.tier = tier;
    const { mk } = tier;
    this.tier.setText(mk.toUpperCase());
  }

  private onGun(gun: GameEvents['gun:state']): void {
    this.shown.gun = gun;
    const { rounds, max } = gun;
    this.gun = { rounds, max };
    const a = this.layout.gun;
    this.pips.clear();
    for (let i = 0; i < max; i++) {
      const x = a.dir > 0 ? a.x + i * PIP.pitch : a.x - i * PIP.pitch - PIP.size;
      this.pips.fillStyle(i < rounds ? PIP_FULL : PIP_EMPTY);
      this.pips.fillRect(x, a.y, PIP.size, PIP.size);
    }
  }

  private onRepair(repair: GameEvents['repair:changed']): void {
    this.shown.repair = repair;
    const { charges, capacity } = repair;
    this.repair.setText(t('hud.repair', { n: charges, max: capacity })).setVisible(capacity > 0);
  }

  private onMap(): void {
    this.drawMinimap();
  }

  private onChunks(): void {
    this.drawMinimap();
  }

  private drawMinimap(): void {
    const map = events.latest('map:changed');
    const world = events.latest('world:chunks');
    if (!map || !world) return;
    this.cells = minimapCells(map.chunks, map.visited, world.chunk);
    const a = this.layout.minimap;
    const size = this.cells.length;
    const w = size * MINIMAP_CELL.w;
    const left = a.originX === 1 ? a.x - w : a.x;
    const g = this.minimap.clear();
    g.fillStyle(0x000000, 0.5).fillRect(left - 1, a.y - 1, w + 2, size * MINIMAP_CELL.h + 2);
    this.cells.forEach((row, cy) =>
      row.forEach((cell, cx) => {
        const color = CELL_COLOR[cell];
        if (color === null) return;
        g.fillStyle(color).fillRect(
          left + cx * MINIMAP_CELL.w + 1,
          a.y + cy * MINIMAP_CELL.h + 1,
          MINIMAP_CELL.w - 2,
          MINIMAP_CELL.h - 2,
        );
      }),
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
    const hp = this.shown.hp.get(this.hpTarget);
    if (hp) this.onHp(hp);
  }

  private onHatchRefused({ reason }: GameEvents['hatch:refused']): void {
    if (reason === 'blocked') this.showToast(t('hatch.blocked'));
    if (reason === 'moving') this.showToast(t('hatch.moving'));
  }

  private onScoutDied(): void {
    this.showToast(t('hatch.scout_down'));
  }

  private onRepairUsed({ hp }: GameEvents['repair:used']): void {
    this.showToast(t('repair.used', { hp }));
  }

  private showToast(text: string): void {
    this.toast.setText(text).setVisible(true).setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(TOAST_MS, () =>
      this.tweens.add({ targets: this.toast, alpha: 0, duration: 300 }),
    );
  }
}
