import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatIssue } from '../src/logic/world/validate';
import { validateAll } from './validate-maps';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

describe('validate:maps', () => {
  it('finds the test world, its tilesets and the shared elevation tileset', () => {
    const { files } = validateAll(PUBLIC);
    expect(files).toContain('maps/test/test.world');
    expect(files).toContain('maps/test/test_x03_y01.tmj');
    expect(files).toContain('maps/shared/elevation.tsj');
  });

  it('reports no issues for the maps in the repo', () => {
    expect(validateAll(PUBLIC).issues.map(formatIssue)).toEqual([]);
  });
});
