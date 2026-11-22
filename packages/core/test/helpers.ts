import type { Board, Floor, OccupantKind, Slot } from '../src/types';

const OCCUPANT_TOKENS: Record<string, OccupantKind> = {
  X: 'plain',
  Z: 'smelly',
  C: 'child',
  P: 'parent',
  G: 'gap',
  Y: 'shy',
  H: 'splasher',
  O: 'outOfOrder',
};

const FREE_TOKENS: Record<string, Floor> = { _: 'clean', M: 'wet', S: 'pee' };
const FLOOR_SUFFIX: Record<string, Floor> = { M: 'wet', S: 'pee' };

/**
 * Board from tokens `<occ>[:<floor>]`: free slots `_` (clean) / `M` (wet) /
 * `S` (pee); occupants X plain, Z smelly, C child, P parent, G gap, Y shy,
 * H splasher, O outOfOrder; suffix `:M` / `:S` sets the floor under them.
 */
export function parseBoard(s: string): Board {
  return s
    .trim()
    .split(/\s+/)
    .map((t): Slot => {
      const [head = '', suffix] = t.split(':');
      const freeFloor = FREE_TOKENS[head];
      if (freeFloor && suffix === undefined) return { floor: freeFloor, occupant: null };
      const kind = OCCUPANT_TOKENS[head];
      const floor = suffix === undefined ? 'clean' : FLOOR_SUFFIX[suffix];
      if (!kind || !floor) throw new Error(`Unknown board token: ${t}`);
      return { floor, occupant: { kind } };
    });
}
