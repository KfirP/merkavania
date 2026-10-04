import type Phaser from 'phaser';
import { getLanguage, isRtl, onLanguageChange, t } from '../i18n/i18n';
import { shouldPromptRotate } from '../logic/scale';
import { events } from './events';

/**
 * The "rotate your device" prompt (docs/ARCHITECTURE.md, Rendering): a DOM overlay over the
 * canvas while a touch device is held in portrait. Going portrait mid-game pauses it.
 */
export function installRotatePrompt(game: Phaser.Game): void {
  const el = document.getElementById('rotate');
  if (!el) return;
  const update = () => {
    const show = shouldPromptRotate(window.innerWidth, window.innerHeight, game.device.input.touch);
    el.textContent = t('ui.rotate_device');
    el.dir = isRtl() ? 'rtl' : 'ltr';
    el.lang = getLanguage();
    if (show && el.hidden) events.emit('ui:pause', undefined);
    el.hidden = !show;
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  onLanguageChange(update);
  // WorldScene may start after the prompt is already up: ask again once it's running.
  game.events.on('step', () => {
    if (!el.hidden && game.scene.isActive('World') && !game.scene.isPaused('World'))
      events.emit('ui:pause', undefined);
  });
  update();
}
