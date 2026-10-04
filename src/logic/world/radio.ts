import {
  RADIO_BASE_SECONDS,
  RADIO_POINT_RADIUS,
  RADIO_SECONDS_PER_CHAR,
  RADIO_TYPE_RATE,
  type RadioSpeaker,
} from '../../data/radio';
import type { RadioSpec } from './objects';

/**
 * Radio messages (GAME_DESIGN.md, Narrative): `radio` objects play when the active pawn enters
 * them, one message at a time, typed out on the HUD. Numbers are in data/radio.ts.
 */

/** Inside a rect radio, or within `RADIO_POINT_RADIUS` of a point radio. */
export function inRadioRange(spec: RadioSpec, p: { x: number; y: number }): boolean {
  if (spec.width === 0 && spec.height === 0)
    return Math.hypot(p.x - spec.x, p.y - spec.y) <= RADIO_POINT_RADIUS;
  return Math.abs(p.x - spec.x) <= spec.width / 2 && Math.abs(p.y - spec.y) <= spec.height / 2;
}

/**
 * One frame of radio triggers: a radio fires when the pawn enters it (not while it stays), unless
 * it's a `once` radio already `heard`. Returns the radios to play, in map order, and the keys the
 * pawn is now inside (feed them back next frame).
 */
export function stepRadios(
  specs: readonly RadioSpec[],
  pos: { x: number; y: number },
  inside: ReadonlySet<string>,
  heard: (key: string) => boolean,
): { fire: RadioSpec[]; inside: Set<string> } {
  const now = new Set<string>();
  const fire: RadioSpec[] = [];
  for (const spec of specs) {
    if (!inRadioRange(spec, pos)) continue;
    now.add(spec.key);
    if (!inside.has(spec.key) && !(spec.once && heard(spec.key))) fire.push(spec);
  }
  return { fire, inside: now };
}

/** Seconds a message stays up once it starts. */
export function radioDuration(text: string): number {
  return RADIO_BASE_SECONDS + text.length * RADIO_SECONDS_PER_CHAR;
}

/** Characters of `text` the typewriter shows after `elapsed` seconds. */
export function revealedChars(text: string, elapsed: number): number {
  return Math.min(text.length, Math.floor(elapsed * RADIO_TYPE_RATE));
}

export interface RadioMessage {
  messageKey: string;
  speaker: RadioSpeaker;
  /** The translated text (line breaks included). */
  text: string;
}

/** Messages waiting to play; the head is on screen for its `radioDuration`. */
export class RadioQueue {
  private readonly items: (RadioMessage & { elapsed: number })[] = [];

  push(message: RadioMessage): void {
    this.items.push({ ...message, elapsed: 0 });
  }

  /** The message on screen and how long it has been up, or null. */
  get current(): (RadioMessage & { elapsed: number }) | null {
    return this.items[0] ?? null;
  }

  get queued(): RadioMessage[] {
    return this.items.slice(1);
  }

  tick(dt: number): void {
    const head = this.items[0];
    if (!head) return;
    head.elapsed += dt;
    if (head.elapsed >= radioDuration(head.text)) this.items.shift();
  }

  /** Finishes typing the message on screen, or (if it's fully shown) moves on to the next. */
  skip(): void {
    const head = this.items[0];
    if (!head) return;
    const typed = head.text.length / RADIO_TYPE_RATE;
    if (head.elapsed < typed) head.elapsed = typed;
    else this.items.shift();
  }

  /** New text for every message (the language changed). */
  retext(translate: (message: RadioMessage) => string): void {
    for (const item of this.items) item.text = translate(item);
  }

  clear(): void {
    this.items.length = 0;
  }
}
