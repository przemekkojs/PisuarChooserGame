import { describe, expect, it } from 'vitest';
import { applyEvent, planEvents, TELEGRAPH_MS } from '../src/events';
import type { ScheduledEvent } from '../src/events';
import { levelParams } from '../src/difficulty';
import type { LevelParams } from '../src/difficulty';
import { LEVELS } from '../src/config';
import { createRng } from '../src/rng';
import { parseBoard } from './helpers';

const BOARD = parseBoard('X _ _ M _ Z _ _');
const TIME_MS = 9000;

function params(over: Partial<LevelParams> = {}): LevelParams {
  return { ...levelParams(14), dynamic: ['mop'], dynamicMax: 1, ...over };
}

function plan(seed: number, over: Partial<LevelParams> = {}, board = BOARD, timeMs = TIME_MS): ScheduledEvent[] {
  let id = 0;
  return planEvents(board, params(over), timeMs, createRng(seed), () => ++id);
}

function mop(index: number): ScheduledEvent {
  return { id: 1, kind: 'mop', index, telegraphAtMs: 3000, applyAtMs: 4500, telegraphed: true };
}

describe('planEvents (mop)', () => {
  it('is deterministic per board and seed', () => {
    for (let seed = 1; seed <= 20; seed++) expect(plan(seed)).toEqual(plan(seed));
  });

  it('plans nothing when no dynamic kind is unlocked', () => {
    for (let seed = 1; seed <= 50; seed++) expect(plan(seed, { dynamic: [] })).toEqual([]);
  });

  it('plans a mop on a free clean slot in about half of the levels', () => {
    let some = 0;
    const N = 400;
    const [lo, hi] = LEVELS.dynamic.windows.mop;
    for (let seed = 1; seed <= N; seed++) {
      const evs = plan(seed);
      expect(evs.length).toBeLessThanOrEqual(1);
      if (evs.length === 0) continue;
      some++;
      const ev = evs[0]!;
      expect(ev.kind).toBe('mop');
      expect(BOARD[ev.index]!.occupant).toBeNull();
      expect(BOARD[ev.index]!.floor).toBe('clean');
      expect(ev.applyAtMs % 100).toBe(0);
      expect(ev.applyAtMs).toBeGreaterThanOrEqual(lo * TIME_MS);
      expect(ev.applyAtMs).toBeLessThanOrEqual(hi * TIME_MS);
      expect(ev.applyAtMs).toBeGreaterThanOrEqual(TELEGRAPH_MS);
      expect(ev.telegraphAtMs).toBe(ev.applyAtMs - TELEGRAPH_MS);
      expect(ev.telegraphed).toBe(false);
    }
    expect(some / N).toBeGreaterThan(0.4);
    expect(some / N).toBeLessThan(0.6);
  });

  it('uses distinct ids from nextId', () => {
    let id = 100;
    for (let seed = 1; seed <= 30; seed++) {
      const evs = planEvents(BOARD, params(), TIME_MS, createRng(seed), () => ++id);
      for (const ev of evs) expect(ev.id).toBe(id);
    }
  });

  it('clamps applyAtMs to >= TELEGRAPH_MS on short levels', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const ev of plan(seed, {}, BOARD, 2000)) {
        expect(ev.applyAtMs).toBeGreaterThanOrEqual(TELEGRAPH_MS);
        expect(ev.applyAtMs % 100).toBe(0);
        expect(ev.telegraphAtMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('with dynamicMax 2 plans at most two different kinds, telegraphs >= TELEGRAPH_MS apart', () => {
    const board = parseBoard('X _ _ M _ Z _ _ X _');
    let sawTwo = false;
    for (let seed = 1; seed <= 200; seed++) {
      const evs = plan(seed, { dynamic: ['mop', 'leave', 'arrive'], dynamicMax: 2 }, board);
      expect(evs.length).toBeLessThanOrEqual(2);
      if (evs.length === 2) {
        sawTwo = true;
        expect(evs[0]!.kind).not.toBe(evs[1]!.kind);
        expect(evs[0]!.index).not.toBe(evs[1]!.index);
        expect(evs[1]!.telegraphAtMs - evs[0]!.telegraphAtMs).toBeGreaterThanOrEqual(TELEGRAPH_MS);
      }
    }
    expect(sawTwo).toBe(true);
  });

  it('plans nothing when there is no free clean slot', () => {
    const board = parseBoard('X M S Z _ M');
    const noClean = parseBoard('X M S Z M S');
    for (let seed = 1; seed <= 50; seed++) {
      expect(plan(seed, {}, noClean)).toEqual([]);
      for (const ev of plan(seed, {}, board)) expect(board[ev.index]!.floor).toBe('clean');
    }
  });
});

describe('applyEvent (mop)', () => {
  it('wets only the target slot and leaves the input untouched', () => {
    const before = JSON.stringify(BOARD);
    const next = applyEvent(BOARD, mop(1), createRng(1));
    expect(next).not.toBeNull();
    expect(next![1]!.floor).toBe('wet');
    next!.forEach((s, i) => {
      if (i !== 1) expect(s).toEqual(BOARD[i]);
    });
    expect(JSON.stringify(BOARD)).toBe(before);
  });

  it('returns null when the target is no longer a free clean slot', () => {
    expect(applyEvent(BOARD, mop(0), createRng(1))).toBeNull(); // occupied
    expect(applyEvent(BOARD, mop(3), createRng(1))).toBeNull(); // already wet
    expect(applyEvent(BOARD, mop(99), createRng(1))).toBeNull(); // out of range
  });

  it('returns null when the resulting board would be invalid', () => {
    // Two free slots: wetting the clean one makes both cost the same.
    expect(applyEvent(parseBoard('M X _'), mop(2), createRng(1))).toBeNull();
  });
});

describe('planEvents (arrive, leave)', () => {
  const B = parseBoard('X _ P:M C G Z Y O _ H');
  it('arrive targets a free slot within its window', () => {
    const [lo, hi] = LEVELS.dynamic.windows.arrive;
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const ev of plan(seed, { dynamic: ['arrive'] }, B)) {
        n++;
        expect(ev.kind).toBe('arrive');
        expect(B[ev.index]!.occupant).toBeNull();
        expect(ev.applyAtMs).toBeGreaterThanOrEqual(lo * TIME_MS);
        expect(ev.applyAtMs).toBeLessThanOrEqual(hi * TIME_MS);
      }
    }
    expect(n).toBeGreaterThan(0);
  });
  it('leave targets only plain or smelly people outside the pair, within its window', () => {
    const board = parseBoard('X _ P C G Z Y O _ H');
    const [lo, hi] = LEVELS.dynamic.windows.leave;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const ev of plan(seed, { dynamic: ['leave'] }, board)) {
        seen.add(ev.index);
        expect(['plain', 'smelly']).toContain(board[ev.index]!.occupant!.kind);
        expect(ev.applyAtMs).toBeGreaterThanOrEqual(lo * TIME_MS);
        expect(ev.applyAtMs).toBeLessThanOrEqual(hi * TIME_MS);
      }
    }
    expect([...seen].sort()).toEqual([0, 5]);
  });
  it('plans nothing without a candidate', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(plan(seed, { dynamic: ['leave'] }, parseBoard('P C G _ _ O Y'))).toEqual([]);
      expect(plan(seed, { dynamic: ['arrive'] }, parseBoard('X Z X'))).toEqual([]);
    }
  });
});

describe('applyEvent (arrive, leave)', () => {
  const ev = (kind: 'arrive' | 'leave', index: number): ScheduledEvent => ({
    id: 1, kind, index, telegraphAtMs: 3000, applyAtMs: 4500, telegraphed: true,
  });
  const B = parseBoard('X _ _ M _ Z');
  it('arrive always seats a plain person below the smelly level', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const next = applyEvent(B, ev('arrive', 1), createRng(seed), LEVELS.dynamic.arriveSmellyLevel - 1);
      expect(next![1]!.occupant).toEqual({ kind: 'plain' });
    }
  });
  it('arrive is smelly in about 25% of cases from the smelly level', () => {
    let smelly = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const next = applyEvent(B, ev('arrive', 1), createRng(seed), LEVELS.dynamic.arriveSmellyLevel);
      if (next![1]!.occupant!.kind === 'smelly') smelly++;
    }
    expect(smelly / N).toBeGreaterThan(0.15);
    expect(smelly / N).toBeLessThan(0.35);
  });
  it('leave frees the slot with a wet floor and keeps the board valid', () => {
    const next = applyEvent(B, ev('leave', 0), createRng(1), 30);
    expect(next![0]).toEqual({ floor: 'wet', occupant: null });
    expect(B[0]!.occupant).not.toBeNull();
  });
  it('leave keeps a pee floor (never downgrades pee to wet)', () => {
    const next = applyEvent(parseBoard('X:S _ _ M _ Z'), ev('leave', 0), createRng(1), 30);
    expect(next![0]).toEqual({ floor: 'pee', occupant: null });
  });
  it('a smelly person can leave too', () => {
    const next = applyEvent(B, ev('leave', 5), createRng(1), 30);
    expect(next![5]).toEqual({ floor: 'wet', occupant: null });
  });
  it('returns null when the target is wrong', () => {
    expect(applyEvent(B, ev('arrive', 0), createRng(1), 30)).toBeNull();
    expect(applyEvent(B, ev('leave', 1), createRng(1), 30)).toBeNull();
    expect(applyEvent(parseBoard('P C G _ _'), ev('leave', 0), createRng(1), 30)).toBeNull();
    expect(applyEvent(B, ev('leave', 99), createRng(1), 30)).toBeNull();
  });
  it('arrive on one of exactly two free slots is cancelled', () => {
    expect(applyEvent(parseBoard('X _ _ X'), ev('arrive', 1), createRng(1), 30)).toBeNull();
  });
  it('leave that results in equal costs is cancelled', () => {
    expect(applyEvent(parseBoard('X M M'), ev('leave', 0), createRng(1), 30)).toBeNull();
  });
});
