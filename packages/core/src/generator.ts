import { DEFAULT_WEIGHTS, LEVELS } from './config';
import { urinalCost } from './cost';
import type { LevelParams } from './difficulty';
import type { Rng } from './rng';
import type { Board, CostWeights, Floor, OccupantKind, Slot } from './types';

const EPSILON = 1e-9;

/** True when at least 2 free slots exist and two of them differ in cost. */
function isValid(board: Board, w: CostWeights): boolean {
  const costs: number[] = [];
  board.forEach((s, i) => {
    if (!s.occupant) costs.push(urinalCost(board, i, w));
  });
  if (costs.length < 2) return false;
  return costs.some((c) => Math.abs(c - costs[0]!) > EPSILON);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function randomBoard(p: LevelParams, rng: Rng): Board {
  const occupants: OccupantKind[] = [];
  for (let i = 0; i < p.people; i++) occupants.push(i < p.smelly ? 'smelly' : 'plain');
  const kinds = shuffle(
    [...occupants.map((k): OccupantKind | null => k), ...Array<null>(p.urinals - p.people).fill(null)],
    rng,
  );
  const slots: Slot[] = kinds.map((k) => ({ floor: 'clean', occupant: k ? { kind: k } : null }));
  const effects: Floor[] = [...Array<Floor>(p.pee).fill('pee'), ...Array<Floor>(p.wet).fill('wet')];
  for (const floor of effects) {
    const under = rng.next() < LEVELS.effectUnderOccupantP;
    let pool = slots.filter((s) => s.floor === 'clean' && (under ? s.occupant : !s.occupant));
    if (pool.length === 0) pool = slots.filter((s) => s.floor === 'clean' && (under ? !s.occupant : s.occupant));
    if (pool.length === 0) break;
    pool[rng.int(0, pool.length - 1)]!.floor = floor;
  }
  return slots;
}

/**
 * Deterministic fallback: persons packed on the left, free slots clean on the
 * right. With >= 1 person and >= 2 free slots the nearest free slot always
 * costs more than the farthest, so the board is valid. Wet/pee floors are
 * dropped (the guarantee takes priority over the obstacle count).
 */
function fallbackBoard(p: LevelParams): Board {
  const board: Board = [];
  for (let i = 0; i < p.people; i++) board.push({ floor: 'clean', occupant: { kind: i < p.smelly ? 'smelly' : 'plain' } });
  while (board.length < p.urinals) board.push({ floor: 'clean', occupant: null });
  return board;
}

export function generateBoard(
  params: LevelParams,
  rng: Rng,
  w: CostWeights = DEFAULT_WEIGHTS,
): Board {
  for (let attempt = 0; attempt < LEVELS.maxGenerateAttempts; attempt++) {
    const board = randomBoard(params, rng);
    if (isValid(board, w)) return board;
  }
  return fallbackBoard(params);
}
