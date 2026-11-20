import { describe, expect, it } from 'vitest';
import { contains, hitIndex, urinalRects } from '../src/scene/layout';

const W = 1080;
const H = 1920;
const EPS = 1e-6;

describe('urinalRects', () => {
  for (let count = 3; count <= 18; count++) {
    it(`lays out ${count} urinals in one row inside the screen`, () => {
      const rects = urinalRects(count, W, H);
      expect(rects).toHaveLength(count);
      for (const r of rects) {
        expect(r.w).toBeGreaterThan(0);
        expect(r.h).toBeGreaterThan(0);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(W + EPS);
        expect(r.y + r.h).toBeLessThanOrEqual(H + EPS);
      }
      // single row
      for (const r of rects) expect(r.y).toBeCloseTo(rects[0]!.y);
      // sorted left to right, non-overlapping, equal gaps
      const gaps: number[] = [];
      for (let i = 1; i < count; i++) {
        const prev = rects[i - 1]!;
        const cur = rects[i]!;
        expect(cur.x).toBeGreaterThan(prev.x);
        const gap = cur.x - (prev.x + prev.w);
        expect(gap).toBeGreaterThan(0);
        gaps.push(gap);
      }
      for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!);
      // symmetric horizontal margins
      const left = rects[0]!.x;
      const right = W - (rects[count - 1]!.x + rects[count - 1]!.w);
      expect(left).toBeGreaterThan(0);
      expect(left).toBeCloseTo(right);
    });
  }

  it('gives equal widths to every urinal', () => {
    const rects = urinalRects(18, W, H);
    for (const r of rects) expect(r.w).toBeCloseTo(rects[0]!.w);
  });

  it('shrinks urinals as the count grows', () => {
    expect(urinalRects(18, W, H)[0]!.w).toBeLessThan(urinalRects(3, W, H)[0]!.w);
  });
});

describe('hitIndex', () => {
  const rects = urinalRects(5, W, H);

  it('returns the urinal under the point', () => {
    rects.forEach((r, i) => expect(hitIndex(rects, r.x + r.w / 2, r.y + r.h / 2, 0)).toBe(i));
  });

  it('maps a tap in the gap to the nearer neighbour', () => {
    const a = rects[1]!;
    const b = rects[2]!;
    const gapStart = a.x + a.w;
    const gap = b.x - gapStart;
    expect(hitIndex(rects, gapStart + gap * 0.25, a.y + 1, 0)).toBe(1);
    expect(hitIndex(rects, gapStart + gap * 0.75, a.y + 1, 0)).toBe(2);
  });

  it('accepts taps within padY above or below the row', () => {
    const r = rects[0]!;
    expect(hitIndex(rects, r.x + 1, r.y - 50, 60)).toBe(0);
    expect(hitIndex(rects, r.x + 1, r.y + r.h + 50, 60)).toBe(0);
    expect(hitIndex(rects, r.x + 1, r.y - 70, 60)).toBe(-1);
  });

  it('returns -1 far outside the row or for an empty layout', () => {
    expect(hitIndex(rects, 1, rects[0]!.y + 1, 0)).toBe(-1);
    expect(hitIndex(rects, W - 1, rects[0]!.y + 1, 0)).toBe(-1);
    expect(hitIndex([], 10, 10, 100)).toBe(-1);
  });
});

describe('contains', () => {
  it('is inclusive of the rect edges', () => {
    const r = { x: 10, y: 20, w: 30, h: 40 };
    expect(contains(r, 10, 20)).toBe(true);
    expect(contains(r, 40, 60)).toBe(true);
    expect(contains(r, 41, 30)).toBe(false);
    expect(contains(r, 20, 19)).toBe(false);
  });
});

describe('hitIndex with 18 urinals', () => {
  const rects = urinalRects(18, W, H);
  const first = rects[0]!;
  const last = rects[17]!;
  const midY = first.y + first.h / 2;
  const gap = rects[1]!.x - (first.x + first.w);
  const PAD = 220;

  it('maps taps in the gap between neighbours to the nearest slot', () => {
    for (let i = 0; i < 17; i++) {
      const edge = rects[i]!.x + rects[i]!.w;
      // just left of the gap midpoint -> slot i, just right -> slot i + 1
      expect(hitIndex(rects, edge + gap / 2 - 0.01, midY, PAD)).toBe(i);
      expect(hitIndex(rects, edge + gap / 2 + 0.01, midY, PAD)).toBe(i + 1);
    }
  });

  it('maps the extreme margins within half a gap to the outer slots', () => {
    expect(hitIndex(rects, first.x - gap / 2 + 0.01, midY, PAD)).toBe(0);
    expect(hitIndex(rects, last.x + last.w + gap / 2 - 0.01, midY, PAD)).toBe(17);
  });

  it('returns -1 beyond the outer zones and outside the vertical band', () => {
    expect(hitIndex(rects, first.x - gap / 2 - 0.01, midY, PAD)).toBe(-1);
    expect(hitIndex(rects, 0, midY, PAD)).toBe(-1);
    expect(hitIndex(rects, W, midY, PAD)).toBe(-1);
    expect(hitIndex(rects, first.x + 1, first.y - PAD - 1, PAD)).toBe(-1);
    expect(hitIndex(rects, first.x + 1, first.y + first.h + PAD + 1, PAD)).toBe(-1);
  });
});
