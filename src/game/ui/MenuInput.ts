import Phaser from 'phaser';
import { RisingEdge } from '../../logic/input/edge';
import { menuInputFromCode, type MenuInput } from '../../logic/ui/menu';

/** Standard-mapping gamepad buttons used by menus. */
const PAD = { a: 0, b: 1, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;
const STICK = 0.5;
/** Held keys auto-repeat (sliders, long lists), but confirm and back don't. */
const REPEATS = new Set<MenuInput>(['up', 'down', 'left', 'right']);

/**
 * Menu input from the keyboard (fixed keys: arrows/WASD, Enter/Space, Esc/Backspace) and the
 * gamepad (d-pad or left stick, A, B or Start). Menus run while WorldScene is paused, so they read
 * devices themselves instead of going through InputSystem.
 * Keys are plain DOM presses consumed once per frame (see DebugScene for why not Phaser's events).
 */
export class MenuInputReader {
  private codes: string[] = [];
  private readonly edges = new Map<string, RisingEdge>();
  private readonly onKey = (e: KeyboardEvent) => {
    const input = menuInputFromCode(e.code);
    if (e.repeat && (input === null || !REPEATS.has(input))) return;
    this.codes.push(e.code);
  };

  constructor(private readonly scene: Phaser.Scene) {
    window.addEventListener('keydown', this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    // Ignore presses that were already held when the menu opened (the Esc or Start that opened it).
    this.pad(true);
  }

  /**
   * Everything pressed since the last call: menu inputs, plus the raw DOM codes for key capture
   * (rebinding).
   */
  poll(): { inputs: MenuInput[]; codes: string[] } {
    const codes = this.codes.splice(0);
    const inputs = codes.map(menuInputFromCode).filter((i): i is MenuInput => i !== null);
    return { inputs: [...inputs, ...this.pad(false)], codes };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private pad(prime: boolean): MenuInput[] {
    const pad = this.scene.input.gamepad?.gamepads.find((p) => p?.connected);
    if (!pad) return [];
    const btn = (i: number) => (pad.buttons[i]?.value ?? 0) > STICK;
    const x = pad.axes[0]?.getValue() ?? 0;
    const y = pad.axes[1]?.getValue() ?? 0;
    const held: [MenuInput, boolean][] = [
      ['up', btn(PAD.up) || y < -STICK],
      ['down', btn(PAD.down) || y > STICK],
      ['left', btn(PAD.left) || x < -STICK],
      ['right', btn(PAD.right) || x > STICK],
      ['confirm', btn(PAD.a)],
      ['back', btn(PAD.b) || btn(PAD.start)],
    ];
    const out: MenuInput[] = [];
    for (const [input, down] of held) {
      let edge = this.edges.get(input);
      if (!edge) this.edges.set(input, (edge = new RisingEdge()));
      if (edge.update(down) && !prime) out.push(input);
    }
    return out;
  }
}
