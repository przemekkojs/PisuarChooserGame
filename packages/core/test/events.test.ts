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
    for (let seed = 1; seed <= 200; seed++) {
      const evs = plan(seed, { dynamic: ['mop', 'leave', 'arrive'], dynamicMax: 2 });
      expect(evs.length).toBeLessThanOrEqual(2);
      if (evs.length === 2) {
        expect(evs[0]!.kind).not.toBe(evs[1]!.kind);
        expect(evs[1]!.telegraphAtMs - evs[0]!.telegraphAtMs).toBeGreaterThanOrEqual(TELEGRAPH_MS);
      }
    }
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
