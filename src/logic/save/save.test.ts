import { describe, expect, it } from 'vitest';
import { collectPickup, newGame, useDepot, visitChunk } from '../state/gameState';
import { migrate, type Migrations } from './migrations';
import { deserialize, SAVE_VERSION, SaveStore, serialize, slotKey, type StorageLike } from './save';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function progressed() {
  const s = newGame();
  collectPickup(s, { key: 'test_x00_y02:mortar_1', ability: 'mortar' });
  collectPickup(s, { key: 'test_x00_y02:plate_1', minor: 'armor_plate' });
  s.flags.set('test_x00_y01:sandbag_1');
  s.selectedSecondary = 'mortar';
  s.secondaryAmmo.mortar = 3;
  useDepot(s, 'test_x00_y02:depot_1');
  s.secondaryAmmo.mortar = 2;
  visitChunk(s, 'test', 'test_x01_y01');
  s.playtimeMs = 12345;
  return s;
}

describe('serialize / deserialize', () => {
  it('writes the versioned ARCHITECTURE.md shape', () => {
    const data = serialize(progressed(), 1000);
    expect(data).toEqual({
      version: SAVE_VERSION,
      updatedAt: 1000,
      playtimeMs: 12345,
      mk: 'mk2',
      abilities: ['mortar'],
      minor: { armor_plate: 1, ammo_rack: 0, repair_kit: 0 },
      selectedSecondary: 'mortar',
      secondaryAmmo: { mortar: 2 },
      depotId: 'test_x00_y02:depot_1',
      flags: {
        'test_x00_y02:mortar_1': true,
        'test_x00_y02:plate_1': true,
        'test_x00_y01:sandbag_1': true,
      },
      visitedChunks: { test: ['test_x01_y01'] },
    });
  });

  it('round-trips through JSON', () => {
    const s = progressed();
    const back = deserialize(JSON.parse(JSON.stringify(serialize(s, 1))))!;
    expect(back).not.toBeNull();
    expect({ ...back, flags: back.flags.toJSON().sort() }).toEqual({
      ...s,
      flags: s.flags.toJSON().sort(),
    });
  });

  it('rejects junk and saves from a newer game', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('nope')).toBeNull();
    expect(deserialize({ version: SAVE_VERSION })).toBeNull();
    expect(deserialize({ ...serialize(newGame(), 1), version: SAVE_VERSION + 1 })).toBeNull();
    expect(deserialize({ ...serialize(newGame(), 1), mk: 'mk9' })).toBeNull();
  });

  it('drops unknown ids instead of failing the whole save', () => {
    const data = { ...serialize(newGame(), 1), abilities: ['mortar', 'laser_eyes'] };
    expect(deserialize(data)!.abilities).toEqual(['mortar']);
    const sel = { ...serialize(newGame(), 1), selectedSecondary: 'flamethrower' };
    expect(deserialize(sel)!.selectedSecondary).toBe('coax_mg');
  });
});

describe('migrate', () => {
  // A synthetic history: v0 had no visitedChunks and called the depot `lastDepot`.
  const history: Migrations = {
    0: (old) => {
      const { lastDepot, ...rest } = old as { lastDepot: string | null };
      return { ...rest, depotId: lastDepot, visitedChunks: {}, version: 1 };
    },
  };

  it('runs every step from the stored version to the target', () => {
    const v0 = { version: 0, lastDepot: 'a:depot', abilities: [] };
    expect(migrate(v0, history, 1)).toEqual({
      version: 1,
      depotId: 'a:depot',
      visitedChunks: {},
      abilities: [],
    });
  });

  it('returns null when a step is missing or the save is newer', () => {
    expect(migrate({ version: 0 }, {}, 1)).toBeNull();
    expect(migrate({ version: 2 }, history, 1)).toBeNull();
    expect(migrate({ version: 1, x: 1 }, history, 1)).toEqual({ version: 1, x: 1 });
  });
});

describe('SaveStore', () => {
  it('uses one key per slot, 1–3', () => {
    expect(slotKey(1)).toBe('merkavania.save.1');
    expect(() => slotKey(0)).toThrow();
    expect(() => slotKey(4)).toThrow();
  });

  it('saves and loads each slot independently', () => {
    const storage = fakeStorage();
    const store = new SaveStore(storage, () => 42);
    expect(store.load(1)).toBeNull();
    store.save(2, progressed());
    expect(store.load(1)).toBeNull();
    expect(store.load(2)!.abilities).toEqual(['mortar']);
    expect(store.info(2)).toEqual({ updatedAt: 42, playtimeMs: 12345 });
    store.clear(2);
    expect(store.load(2)).toBeNull();
  });

  it('treats corrupt JSON as an empty slot', () => {
    const storage = fakeStorage();
    storage.setItem(slotKey(1), '{oops');
    expect(new SaveStore(storage).load(1)).toBeNull();
  });

  it('survives storage that throws (private mode)', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const store = new SaveStore(broken);
    expect(store.load(1)).toBeNull();
    expect(store.save(1, newGame())).toBe(false);
  });
});
