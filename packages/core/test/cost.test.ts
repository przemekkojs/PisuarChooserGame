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
  it('adds floor under an occupant to the neighbour cost', () => {
    expect(urinalCost(parseBoard('X _'), 1)).toBe(1);
    expect(urinalCost(parseBoard('X:M _'), 1)).toBe(2);
    expect(urinalCost(parseBoard('Z:S _ _'), 1)).toBe(6);
    expect(urinalCost(parseBoard('Z:S _ _'), 2)).toBe(3);
  });
  it('weighs occupant kinds', () => {
    expect(urinalCost(parseBoard('C _'), 1)).toBe(2);
    expect(urinalCost(parseBoard('P _'), 1)).toBe(1);
    expect(urinalCost(parseBoard('Y _ _'), 1)).toBe(1);
    expect(urinalCost(parseBoard('Y _ _'), 2)).toBeCloseTo(0.8);
    expect(urinalCost(parseBoard('O _'), 1)).toBe(0);
  });
  it('gives any occupant infinite cost', () => {
    const b = parseBoard('X Z C P G Y H O _');
    for (let i = 0; i < 8; i++) expect(urinalCost(b, i)).toBe(Infinity);
  });
  it('free slot does not affect a neighbour beyond its own floor', () => {
    expect(urinalCost(parseBoard('M _'), 1)).toBe(0);
  });
});
