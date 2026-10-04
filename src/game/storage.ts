import type { StorageLike } from '../logic/save/save';

/** localStorage, or a throwaway in-memory store where it's blocked (private mode, sandboxes). */
export function browserStorage(): StorageLike {
  try {
    const probe = 'merkavania.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}
