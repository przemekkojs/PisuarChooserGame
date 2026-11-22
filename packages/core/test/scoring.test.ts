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
  it('penalises a worse urinal by -round(3 * costDiff)', () => {
    // costs: idx1 = 1, idx4 = 0.125 -> diff 0.875 -> round(2.625) = 3
    const r = evaluatePick(parseBoard('X _ _ _ _'), 1);
    expect(r.kind).toBe('worse');
    expect(r.delta).toBe(-3);
  });
  it('floors the penalty at -1 for a tiny cost difference', () => {
    // idx3 = 0.25 vs best 0.125 -> diff 0.125 -> round(0.375) = 0 -> -1
    expect(evaluatePick(parseBoard('X _ _ _ _'), 3)).toMatchObject({ kind: 'worse', delta: -1 });
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
  it('caps the penalty at exactly -maxPenalty', () => {
    // idx1 cost 6 vs best (idx8) 0.1171875 -> 3 * 5.88 = 17.6 > 15
    const r = evaluatePick(parseBoard('Z _ Z _ _ _ _ _ _'), 1);
    expect(r.kind).toBe('worse');
    expect(r.best).toEqual([8]);
    expect(r.delta).toBe(-15);
  });
});

describe('timePenaltyMs', () => {
  it('computes penalties floored to 100 ms', () => {
    expect(timePenaltyMs(10000, 0.2)).toBe(2000);
    expect(timePenaltyMs(10000, 0.1)).toBe(1000);
    expect(timePenaltyMs(15000, 0.1)).toBe(1500);
    expect(timePenaltyMs(9400, 0.1)).toBe(900);
    expect(timePenaltyMs(15000, 0.2)).toBe(3000);
    expect(timePenaltyMs(12300, 0.1)).toBe(1200);
    expect(timePenaltyMs(9400, 0.2)).toBe(1800);
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
  it('uses the occupant penalty pct', () => {
    expect(occupiedPenaltyMs(parseBoard('G _ _'), 0, 10000)).toBe(2000);
    expect(occupiedPenaltyMs(parseBoard('Z _'), 0, 10000)).toBe(2000);
    expect(occupiedPenaltyMs(parseBoard('_ X'), 0, 10000)).toBe(0);
  });
});
