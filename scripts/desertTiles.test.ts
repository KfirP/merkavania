import { describe, expect, it } from 'vitest';
import { RIM } from './mapBuild';
import { desertPalette, desertTiles } from './desertTiles';

const props = (id: number) =>
  Object.fromEntries((desertTiles[id]!.properties ?? []).map((p) => [p.name, p.value]));

describe('desert tileset', () => {
  const { ground, decor, above, scatter, tilecount } = desertPalette;
  const allIds = [
    ...Object.values(ground).flatMap((g) => [
      ...g.tiles.flat(),
      ...(g.wall === undefined ? [] : [g.wall]),
    ]),
    ...[...Object.values(decor), ...Object.values(above)].flat(2),
    ...scatter.tiles,
    ...(['n', 'e', 's', 'w'] as const).flatMap((d) => [
      desertPalette.ramp(d, false),
      desertPalette.ramp(d, true),
    ]),
    ...Array.from({ length: 15 }, (_, i) => desertPalette.rim(i + 1)),
  ];

  it('names only tiles that exist', () => {
    expect(tilecount).toBe(desertTiles.length);
    for (const id of allIds) {
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(tilecount);
    }
  });

  it('has the ground legend with the right terrains, shaded for every level', () => {
    const terrainOf: Record<string, string> = {
      '.': 'sand',
      ',': 'sand',
      '=': 'road',
      r: 'rock',
      '%': 'rubble',
      c: 'crawlspace',
    };
    for (const [ch, terrain] of Object.entries(terrainOf)) {
      expect(ground[ch]!.tiles).toHaveLength(4);
      for (const id of ground[ch]!.tiles.flat()) expect(props(id).terrain).toBe(terrain);
    }
  });

  it('makes walls solid', () => {
    for (const ch of ['#', 'B', 'S']) expect(props(ground[ch]!.wall!).solid).toBe(true);
  });

  it('gives every rubble tile a cleared look that is still rubble', () => {
    for (const id of ground['%']!.tiles.flat()) {
      const cleared = props(id).cleared as number;
      expect(props(cleared).terrain).toBe('rubble');
      expect(props(cleared).cleared).toBeUndefined();
    }
  });

  it('keeps overlays free of movement properties', () => {
    for (const mask of Object.values(RIM))
      expect(desertTiles[desertPalette.rim(mask)]!.properties).toBeUndefined();
    expect(desertTiles[desertPalette.ramp('n', true)]!.properties).toBeUndefined();
  });

  it('draws distinct normal and steep ramps', () => {
    const pixels = (id: number) =>
      JSON.stringify(Array.from({ length: 256 }, (_, i) => desertTiles[id]!.draw(i % 16, i >> 4)));
    expect(pixels(desertPalette.ramp('e', true))).not.toBe(pixels(desertPalette.ramp('e', false)));
  });
});
