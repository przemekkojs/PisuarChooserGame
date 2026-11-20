import { describe, it, expect } from 'vitest';
import { bestIndices, urinalCost } from '../src/cost';
import { parseBoard } from './helpers';

describe('cost function acceptance', () => {
  it('picks the far end next to one person', () => {
    expect(bestIndices(parseBoard('X _ _ _ _'))).toEqual([4]);
  });
  it('picks the middle between two people', () => {
    expect(bestIndices(parseBoard('X _ _ _ X'))).toEqual([2]);
  });
  it('returns ties in ascending order', () => {
    expect(bestIndices(parseBoard('_ X _ X _'))).toEqual([0, 4]);
  });
  it('prefers distance from a smelly person over a wet floor', () => {
    const b = parseBoard('X M X Z _');
    expect(urinalCost(b, 4)).toBeLessThan(urinalCost(b, 1));
  });
  it('prefers a gap between two people over a crowded end', () => {
    const b = parseBoard('X _ X X _ X X');
    expect(urinalCost(b, 1)).toBeLessThan(urinalCost(b, 4));
  });
  it('gives occupied slots infinite cost', () => {
    expect(urinalCost(parseBoard('X _'), 0)).toBe(Infinity);
  });
  it('wet floor costs more than clean with nobody around', () => {
    expect(urinalCost(parseBoard('M'), 0)).toBeGreaterThan(urinalCost(parseBoard('_'), 0));
  });
});
