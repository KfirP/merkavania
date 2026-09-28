import type Phaser from 'phaser';
import { computeZoom } from '../logic/scale';

/** Keeps the canvas at the largest integer zoom that fits the window; index.html letterboxes it. */
export function installIntegerScaling(game: Phaser.Game): void {
  const apply = () => game.scale.setZoom(computeZoom(window.innerWidth, window.innerHeight));
  window.addEventListener('resize', apply);
  apply();
}
