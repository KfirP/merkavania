/**
 * Keyboard bindings (docs/ARCHITECTURE.md, Input). Keys are named like Phaser's `KeyCodes`
 * (`W`, `UP`, `SPACE`, `THREE`) so the adapter can pass them straight to `addKeys`. The mouse
 * buttons and the pause key aren't rebindable: Esc always pauses, so a bad binding can't lock the
 * player out of the settings.
 */

export const bindableActions = [
  'throttle_fwd',
  'throttle_back',
  'turn_left',
  'turn_right',
  'cycle_prev',
  'cycle_next',
  'hatch',
  'interact',
  'repair',
  'map',
] as const;
export type BindableAction = (typeof bindableActions)[number];
export type Keybinds = Record<BindableAction, string[]>;

/** Keys per action: a primary and an alternative. */
export const BIND_SLOTS = 2;
export const PAUSE_KEY = 'ESC';

const DEFAULTS: Readonly<Record<BindableAction, readonly string[]>> = {
  throttle_fwd: ['W', 'UP'],
  throttle_back: ['S', 'DOWN'],
  turn_left: ['A', 'LEFT'],
  turn_right: ['D', 'RIGHT'],
  cycle_prev: ['Q'],
  cycle_next: ['E'],
  hatch: ['F'],
  interact: ['SPACE'],
  repair: ['R'],
  map: ['M', 'TAB'],
};

export function defaultKeybinds(): Keybinds {
  return Object.fromEntries(bindableActions.map((a) => [a, [...DEFAULTS[a]]])) as Keybinds;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** DOM `KeyboardEvent.code` → key name, for everything but letters and digits. */
const CODE_NAMES: Readonly<Record<string, string>> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  Space: 'SPACE',
  Tab: 'TAB',
  Enter: 'ENTER',
  Backspace: 'BACKSPACE',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
  ControlLeft: 'CTRL',
  ControlRight: 'CTRL',
  AltLeft: 'ALT',
  AltRight: 'ALT',
  CapsLock: 'CAPS_LOCK',
  Escape: 'ESC',
  Comma: 'COMMA',
  Period: 'PERIOD',
  Slash: 'FORWARD_SLASH',
  Backslash: 'BACK_SLASH',
  Semicolon: 'SEMICOLON',
  Quote: 'QUOTES',
  BracketLeft: 'OPEN_BRACKET',
  BracketRight: 'CLOSED_BRACKET',
  Minus: 'MINUS',
  Equal: 'PLUS',
  Backquote: 'BACKTICK',
  Insert: 'INSERT',
  Delete: 'DELETE',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PAGE_UP',
  PageDown: 'PAGE_DOWN',
};

const KEY_NAMES = new Set([...LETTERS, ...DIGITS, ...Object.values(CODE_NAMES)]);

/** A key an action may be bound to (any known key except pause). */
export function isBindableKey(key: string): boolean {
  return key !== PAUSE_KEY && KEY_NAMES.has(key);
}

/** The key name for a DOM `KeyboardEvent.code`, or null if it isn't one we bind. */
export function keyNameFromEvent(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return DIGITS[Number(digit[1])]!;
  return CODE_NAMES[code] ?? null;
}

const copy = (b: Keybinds): Keybinds =>
  Object.fromEntries(bindableActions.map((a) => [a, [...b[a]]])) as Keybinds;

/**
 * Puts `key` in `action`'s slot (past the last key if the slot is beyond it) and takes it away
 * from any action that had it. Unbindable keys leave the bindings unchanged.
 */
export function rebind(b: Keybinds, action: BindableAction, slot: number, key: string): Keybinds {
  if (!isBindableKey(key)) return copy(b);
  const next = copy(b);
  for (const a of bindableActions) next[a] = next[a].filter((k) => k !== key);
  const keys = next[action];
  const at = Math.min(Math.max(0, slot), keys.length, BIND_SLOTS - 1);
  keys[at] = key;
  return next;
}

/** Clears `action`'s key in `slot`. */
export function unbind(b: Keybinds, action: BindableAction, slot: number): Keybinds {
  const next = copy(b);
  next[action] = next[action].filter((_, i) => i !== slot);
  return next;
}

/**
 * Stored bindings → valid ones: unknown actions and keys are dropped, a key bound twice stays
 * with the first action, and an action that isn't a list of keys gets its defaults.
 */
export function sanitizeKeybinds(raw: unknown): Keybinds {
  const defaults = defaultKeybinds();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaults;
  const stored = raw as Record<string, unknown>;
  const used = new Set<string>();
  const out = {} as Keybinds;
  for (const a of bindableActions) {
    const value = stored[a];
    const keys = Array.isArray(value)
      ? value.filter((k): k is string => typeof k === 'string' && isBindableKey(k))
      : defaults[a];
    out[a] = keys.filter((k) => !used.has(k)).slice(0, BIND_SLOTS);
    for (const k of out[a]) used.add(k);
  }
  return out;
}
