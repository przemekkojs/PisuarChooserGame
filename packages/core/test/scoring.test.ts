import { describe, it, expect } from 'vitest';
import { evaluatePick, timePenaltyMs, occupiedPenaltyMs } from '../src/scoring';
import { parseBoard } from './helpers';

describe('evaluatePick', () => {
  it('rewards the best urinal', () => {
    const r = evaluatePick(parseBoard('X _ _ _ _'), 4);
    expect(r.kind).toBe('best');
    expect(r.delta).toBe(10);
    expect(r.best).toEqual([4]);
  });
  it('penalises a worse urinal', () => {
    const r = evaluatePick(parseBoard('X _ _ _ _'), 1);
    expect(r.kind).toBe('worse');
    expect(r.delta).toBeLessThan(0);
    expect(r.delta).toBeGreaterThanOrEqual(-15);
  });
  it('gives 0 for occupied and out-of-range', () => {
    const b = parseBoard('X _ _ _ _');
    expect(evaluatePick(b, 0)).toMatchObject({ kind: 'occupied', delta: 0 });
    expect(evaluatePick(b, 99)).toMatchObject({ kind: 'occupied', delta: 0 });
    expect(evaluatePick(b, -1)).toMatchObject({ kind: 'occupied', delta: 0 });
  });
  it('treats ties as best', () => {
    const b = parseBoard('X _ X _ X');
    expect(evaluatePick(b, 1)).toMatchObject({ kind: 'best', delta: 10 });
    expect(evaluatePick(b, 3)).toMatchObject({ kind: 'best', delta: 10 });
  });
  it('never penalises below -maxPenalty', () => {
    const b = parseBoard('Z M M M M M M M _');
    for (let i = 0; i < b.length; i++) {
      const r = evaluatePick(b, i);
      if (r.kind === 'worse') expect(r.delta).toBeGreaterThanOrEqual(-15);
    }
  });
});

describe('timePenaltyMs', () => {
  it('computes penalties floored to 100 ms', () => {
    expect(timePenaltyMs(15000, false)).toBe(1500);
    expect(timePenaltyMs(9400, false)).toBe(900);
    expect(timePenaltyMs(15000, true)).toBe(3000);
  });
});

describe('occupiedPenaltyMs', () => {
  it('uses smelly pct for smelly persons, 0 otherwise', () => {
    const b = parseBoard('X Z _');
    expect(occupiedPenaltyMs(b, 0, 15000)).toBe(1500);
    expect(occupiedPenaltyMs(b, 1, 15000)).toBe(3000);
    expect(occupiedPenaltyMs(b, 2, 15000)).toBe(0);
    expect(occupiedPenaltyMs(b, 9, 15000)).toBe(0);
  });
});
