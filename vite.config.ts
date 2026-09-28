import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the game from /merkavania/; deploy.yml sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB minified
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
