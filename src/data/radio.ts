/** Radio messages (GAME_DESIGN.md, Narrative): who can be on the other end of the line. */
export const radioSpeakers = ['command', 'unknown'] as const;
export type RadioSpeaker = (typeof radioSpeakers)[number];

/** A message's on-screen time: a base plus a little per character, seconds. */
export const RADIO_BASE_SECONDS = 2.5;
export const RADIO_SECONDS_PER_CHAR = 0.06;
/** Characters revealed per second by the typewriter. */
export const RADIO_TYPE_RATE = 40;
/** A point radio object triggers within this distance of the pawn, px. */
export const RADIO_POINT_RADIUS = 24;
