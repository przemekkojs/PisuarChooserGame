/** Pure layout helpers (no Phaser) so they can be unit-tested. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fraction of the width kept free on each side of the row. */
const MARGIN_FRAC = 0.04;
/** Gap between neighbours as a fraction of the width. */
const GAP_FRAC = 0.012;
/** Upper bound for a single urinal width (few urinals should not be huge). */
const MAX_W_FRAC = 0.22;
/** Urinal height relative to its width, capped by MAX_H_FRAC of the height. */
const ASPECT = 2.2;
const MAX_H_FRAC = 0.3;

/**
 * A single row of `count` equal urinals, left to right, with equal gaps and
 * symmetric side margins, vertically centred. Widths shrink so up to 18 fit.
 */
export function urinalRects(count: number, width: number, height: number): Rect[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const gap = width * GAP_FRAC;
  const inner = width - 2 * width * MARGIN_FRAC;
  const w = Math.min(width * MAX_W_FRAC, (inner - (n - 1) * gap) / n);
  const rowW = n * w + (n - 1) * gap;
  const left = (width - rowW) / 2;
  const h = Math.min(w * ASPECT, height * MAX_H_FRAC);
  const y = (height - h) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: left + i * (w + gap), y, w, h }));
}

/** Inclusive point-in-rect test. */
export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * Index of the urinal a tap at (x, y) belongs to, or -1. Each urinal's hit
 * zone extends half a gap to each side (so the whole row is tappable even when
 * 18 narrow urinals are shown) and `padY` above and below.
 */
export function hitIndex(rects: Rect[], x: number, y: number, padY: number): number {
  if (rects.length === 0) return -1;
  const first = rects[0]!;
  const halfGap = rects.length > 1 ? (rects[1]!.x - (first.x + first.w)) / 2 : 0;
  if (y < first.y - padY || y > first.y + first.h + padY) return -1;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    if (x >= r.x - halfGap && x < r.x + r.w + halfGap) return i;
  }
  return -1;
}
