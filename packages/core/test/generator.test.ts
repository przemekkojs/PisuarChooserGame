import { describe, expect, it } from 'vitest';
import { createRng, generateBoard, levelParams, urinalCost } from '../src';

function freeCosts(board: ReturnType<typeof generateBoard>): number[] {
  return board.flatMap((s, i) => (!s.occupant ? [urinalCost(board, i)] : []));
}

describe('generateBoard', () => {
  it('produces valid boards for levels 1..300 and 50 seeds', () => {
    for (let level = 1; level <= 300; level++) {
      const params = levelParams(level);
      for (let seed = 1; seed <= 50; seed++) {
        const board = generateBoard(params, createRng(seed));
        expect(board).toHaveLength(params.urinals);
        expect(board.filter((s) => s.occupant)).toHaveLength(params.persons);
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
    const p = { urinals: 3, persons: 1, smellyPersons: 0, wet: 2, pee: 0, timeMs: 3000 };
    for (let seed = 1; seed <= 50; seed++) {
      const costs = freeCosts(generateBoard(p, createRng(seed)));
      expect(costs).toHaveLength(2);
      expect(Math.abs(costs[0]! - costs[1]!)).toBeGreaterThan(1e-9);
    }
  });
});
