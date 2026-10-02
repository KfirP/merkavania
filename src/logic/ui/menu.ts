/**
 * Menu focus and value rules shared by the title, pause and settings screens. A menu is a list
 * of items; `navigate` applies one input and says what happened. Rendering and reading devices
 * live in game/ui/Menu.ts.
 */

export type MenuItem =
  | { kind: 'action'; id: string; disabled?: boolean }
  /** Cycles through `options`; `value` is the index of the current one. */
  | { kind: 'choice'; id: string; options: readonly string[]; value: number; disabled?: boolean }
  /** 0..1 in `step`s. */
  | { kind: 'slider'; id: string; value: number; step: number; disabled?: boolean };

export type MenuInput = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

export type MenuEvent =
  | { type: 'none' }
  /** Focus moved. */
  | { type: 'focus' }
  | { type: 'activate'; id: string }
  /** A choice's new option index, or a slider's new value. */
  | { type: 'change'; id: string; value: number }
  | { type: 'back' };

const enabled = (item: MenuItem | undefined) => item !== undefined && !item.disabled;

export function firstFocus(items: readonly MenuItem[]): number {
  return items.findIndex(enabled);
}

/** The next enabled item from `from` in direction `dir`, wrapping; `from` if there's no other. */
function step(items: readonly MenuItem[], from: number, dir: 1 | -1): number {
  for (let i = 1; i <= items.length; i++) {
    const at = (((from + dir * i) % items.length) + items.length) % items.length;
    if (enabled(items[at])) return at;
  }
  return from;
}

/** Slider values are kept to 2 decimals so repeated steps don't drift (0.1 + 0.2). */
const round = (v: number) => Math.round(v * 100) / 100;

export function navigate(
  items: readonly MenuItem[],
  focus: number,
  input: MenuInput,
): { focus: number; event: MenuEvent } {
  const none = { type: 'none' } as const;
  if (!enabled(items[focus])) focus = firstFocus(items);
  if (focus < 0) return { focus: -1, event: input === 'back' ? { type: 'back' } : none };
  const item = items[focus]!;

  switch (input) {
    case 'up':
    case 'down': {
      const next = step(items, focus, input === 'down' ? 1 : -1);
      return { focus: next, event: next === focus ? none : { type: 'focus' } };
    }
    case 'back':
      return { focus, event: { type: 'back' } };
    case 'confirm':
      if (item.kind === 'action') return { focus, event: { type: 'activate', id: item.id } };
      if (item.kind === 'choice')
        return {
          focus,
          event: { type: 'change', id: item.id, value: (item.value + 1) % item.options.length },
        };
      return { focus, event: none };
    case 'left':
    case 'right': {
      const dir = input === 'right' ? 1 : -1;
      if (item.kind === 'choice') {
        const n = item.options.length;
        return {
          focus,
          event: { type: 'change', id: item.id, value: (((item.value + dir) % n) + n) % n },
        };
      }
      if (item.kind === 'slider') {
        const value = round(Math.min(1, Math.max(0, item.value + dir * item.step)));
        return {
          focus,
          event: value === item.value ? none : { type: 'change', id: item.id, value },
        };
      }
      return { focus, event: none };
    }
  }
}

const CODE_INPUTS: Readonly<Record<string, MenuInput>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
  Backspace: 'back',
};

/** The menu input for a DOM `KeyboardEvent.code` (fixed keys, so a bad keybind can't trap you). */
export function menuInputFromCode(code: string): MenuInput | null {
  return CODE_INPUTS[code] ?? null;
}
