/** Number formatting for UI text (the words around them come from i18n templates). */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `m:ss`, or `h:mm:ss` from an hour on. */
export function formatPlaytime(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Local date as `YYYY-MM-DD`: unambiguous in both languages and readable in the pixel font. */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatPercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
