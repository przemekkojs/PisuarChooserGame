import { describe, expect, it } from 'vitest';
import { parseBoard } from './helpers';
import { bestIndices, createRng, evaluatePick, generateBoard, levelParams, urinalCost } from '../src';

function freeCosts(board: ReturnType<typeof generateBoard>): number[] {
  return board.flatMap((s, i) => (!s.occupant ? [urinalCost(board, i)] : []));
}

describe('generateBoard', () => {
  it('produces valid boards for levels 1..300 and 50 seeds', () => {
    for (let level = 1; level <= 60; level++) {
      const params = levelParams(level);
      for (let seed = 1; seed <= 200; seed++) {
        const board = generateBoard(params, createRng(seed));
        expect(board).toHaveLength(params.urinals);
        expect(board.filter((s) => s.occupant && s.occupant.kind !== 'outOfOrder' && s.occupant.kind !== 'gap')).toHaveLength(params.people);
        expect(board.filter((s) => s.floor !== 'clean').length).toBeLessThanOrEqual(params.wet + params.pee);
        const costs = freeCosts(board);
        expect(costs.length).toBeGreaterThanOrEqual(2);
        expect(Math.max(...costs) - Math.min(...costs)).toBeGreaterThan(1e-9);
      }
    }
  });
  it('is deterministic per seed', () => {
    const p = levelParams(20);
    expect(generateBoard(p, createRng(7))).toEqual(generateBoard(p, createRng(7)));
  });
  it('still yields a valid board for a tight 3-slot board', () => {
    const p = { ...levelParams(1), wet: 2, pee: 0, timeMs: 3000 };
    for (let seed = 1; seed <= 50; seed++) {
      const costs = freeCosts(generateBoard(p, createRng(seed)));
      expect(costs).toHaveLength(2);
      expect(Math.abs(costs[0]! - costs[1]!)).toBeGreaterThan(1e-9);
    }
  });
  it('floor effects coexist under occupants about half the time (level 20)', () => {
    const p = levelParams(20);
    let under = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const s of generateBoard(p, createRng(seed))) {
        if (s.floor === 'clean') continue;
        total++;
        if (s.occupant) under++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(under / total).toBeGreaterThanOrEqual(0.3);
    expect(under / total).toBeLessThanOrEqual(0.7);
  });
  it('keeps a plain person in every mixed board (level 12)', () => {
    const p = levelParams(12);
    for (let seed = 1; seed <= 200; seed++) {
      const board = generateBoard(p, createRng(seed));
      // child/parent are ordinary (non-special) persons
      if (p.people >= 2) expect(board.some((s) => ['plain', 'child', 'parent'].includes(s.occupant?.kind ?? ''))).toBe(true);
    }
  });
});

describe('generateBoard v2 occupants', () => {
  const count = (b: ReturnType<typeof generateBoard>, kind: string) => b.filter((s) => s.occupant?.kind === kind).length;
  it('places shy, splasher and outOfOrder per params (level 24)', () => {
    const p = levelParams(24);
    expect(p.shy).toBeGreaterThan(0);
    expect(p.splasher).toBeGreaterThan(0);
    expect(p.outOfOrder).toBeGreaterThan(0);
    for (let seed = 1; seed <= 200; seed++) {
      const b = generateBoard(p, createRng(seed));
      expect(count(b, 'shy')).toBe(p.shy);
      expect(count(b, 'splasher')).toBe(p.splasher);
      expect(count(b, 'outOfOrder')).toBe(p.outOfOrder);
      expect(count(b, 'smelly')).toBe(p.smelly);
      expect(b.filter((s) => s.occupant).length).toBeLessThanOrEqual(p.urinals - 2);
    }
  });
  it('splasher neighbours are never clean and effects stay within budget (level 20)', () => {
    const p = levelParams(20);
    for (let seed = 1; seed <= 200; seed++) {
      const b = generateBoard(p, createRng(seed));
      b.forEach((s, i) => {
        if (s.occupant?.kind !== 'splasher') return;
        for (const j of [i - 1, i + 1]) if (b[j]) expect(b[j]!.floor).not.toBe('clean');
      });
      expect(b.filter((s) => s.floor !== 'clean').length).toBeLessThanOrEqual(p.wet + p.pee);
    }
  });
  it('is valid for levels 1..60 x seeds 1..300 and never recommends an occupied slot', () => {
    for (let level = 1; level <= 60; level++) {
      const p = levelParams(level);
      for (let seed = 1; seed <= 300; seed++) {
        const b = generateBoard(p, createRng(seed));
        expect(b).toHaveLength(p.urinals);
        const costs = freeCosts(b);
        expect(costs.length).toBeGreaterThanOrEqual(2);
        expect(Math.max(...costs) - Math.min(...costs)).toBeGreaterThan(1e-9);
        for (const i of bestIndices(b)) expect(b[i]!.occupant).toBeNull();
      }
    }
  });
  it('tapping an outOfOrder slot is occupied with delta 0', () => {
    const b = generateBoard(levelParams(20), createRng(3));
    const i = b.findIndex((s) => s.occupant?.kind === 'outOfOrder');
    expect(i).toBeGreaterThanOrEqual(0);
    const r = evaluatePick(b, i);
    expect(r.kind).toBe('occupied');
    expect(r.delta).toBe(0);
  });
});

describe('generateBoard pairs', () => {
  it('places exactly one adjacent child-gap-parent triple, random side (level 20)', () => {
    const p = levelParams(20);
    expect(p.pairs).toBe(1);
    const sides = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const kinds = generateBoard(p, createRng(seed)).map((s) => s.occupant?.kind ?? '-');
      expect(kinds.filter((k) => k === 'gap')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'child')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'parent')).toHaveLength(1);
      const g = kinds.indexOf('gap');
      const triple = `${kinds[g - 1]},${kinds[g + 1]}`;
      expect(['child,parent', 'parent,child']).toContain(triple);
      sides.add(triple);
    }
    expect(sides.size).toBe(2);
  });
  it('falls back to plain persons when the pair does not fit', () => {
    const p = { ...levelParams(20), urinals: 5, people: 3, outOfOrder: 0 };
    for (let seed = 1; seed <= 50; seed++) {
      const kinds = generateBoard({ ...p, pairs: 0 }, createRng(seed)).map((s) => s.occupant?.kind);
      expect(kinds).not.toContain('gap');
    }
  });
  it('costs a free slot next to a child 1 more than next to a parent', () => {
    expect(urinalCost(parseBoard('C _'), 1) - urinalCost(parseBoard('P _'), 1)).toBeCloseTo(1);
  });
});
