import { DEFAULT_WEIGHTS, LEVELS } from './config';
import { urinalCost } from './cost';
import type { LevelParams } from './difficulty';
import type { Rng } from './rng';
import type { Board, CostWeights, Floor, OccupantKind, Slot } from './types';

const EPSILON = 1e-9;

/** True when at least 2 free slots exist and two of them differ in cost. */
export function isValidBoard(board: Board, w: CostWeights = DEFAULT_WEIGHTS): boolean {
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

/** Occupant kinds for one board, in placement order (persons, then obstacles). */
function occupantKinds(p: LevelParams): OccupantKind[] {
  const kinds: OccupantKind[] = [];
  const specials: [OccupantKind, number][] = [
    ['splasher', p.splasher],
    ['shy', p.shy],
    ['smelly', p.smelly],
  ];
  for (const [kind, n] of specials) for (let i = 0; i < n; i++) kinds.push(kind);
  while (kinds.length < p.people) kinds.push('plain');
  for (let i = 0; i < p.outOfOrder; i++) kinds.push('outOfOrder');
  return kinds;
}

/** Effect budget as a list; wet first so splasher neighbours get wet when possible. */
function effectBudget(p: LevelParams): Floor[] {
  return [...Array<Floor>(p.wet).fill('wet'), ...Array<Floor>(p.pee).fill('pee')];
}

/**
 * Splashers wet their clean neighbours, paid from the effect budget.
 * Returns false when the budget cannot cover them (caller retries).
 */
function applySplasherFloors(slots: Slot[], budget: Floor[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]!.occupant?.kind !== 'splasher') continue;
    for (const j of [i - 1, i + 1]) {
      const n = slots[j];
      if (!n || n.floor !== 'clean') continue;
      const floor = budget.shift();
      if (!floor) return false;
      n.floor = floor;
    }
  }
  return true;
}

/** Spreads the remaining effects randomly, under occupants about half the time. */
function applyRandomFloors(slots: Slot[], budget: Floor[], rng: Rng): void {
  for (const floor of budget) {
    const under = rng.next() < LEVELS.effectUnderOccupantP;
    let pool = slots.filter((s) => s.floor === 'clean' && (under ? s.occupant : !s.occupant));
    if (pool.length === 0) pool = slots.filter((s) => s.floor === 'clean' && (under ? !s.occupant : s.occupant));
    if (pool.length === 0) break;
    pool[rng.int(0, pool.length - 1)]!.floor = floor;
  }
}

function randomBoard(p: LevelParams, rng: Rng): Board | null {
  const occupants = occupantKinds(p);
  const pair = p.pairs === 1 ? ['child', 'gap', 'parent'] : [];
  // Pair members count as 2 people; the gap is outside the budget.
  // Relies on occupantKinds order (specials, plain, outOfOrder): slicing out indices people-2..people-1 drops 2 plain persons.
  const rest = pair.length ? occupants.slice(0, p.people - 2).concat(occupants.slice(p.people)) : occupants;
  const kinds = shuffle(
    [...rest.map((k): OccupantKind | null => k), ...Array<null>(p.urinals - rest.length - pair.length).fill(null)],
    rng,
  );
  if (pair.length) {
    if (rng.next() < 0.5) pair.reverse();
    kinds.splice(rng.int(0, kinds.length), 0, ...(pair as OccupantKind[]));
  }
  const slots: Slot[] = kinds.map((k) => ({ floor: 'clean', occupant: k ? { kind: k } : null }));
  const budget = effectBudget(p);
  if (!applySplasherFloors(slots, budget)) return null;
  applyRandomFloors(slots, shuffle(budget, rng), rng);
  return slots;
}

/**
 * Deterministic fallback: persons packed on the left, free slots clean on the
 * right. With >= 1 person and >= 2 free slots the nearest free slot always
 * costs more than the farthest, so the board is valid. Random wet/pee floors are
 * dropped (the guarantee takes priority over the obstacle count).
 */
function fallbackBoard(p: LevelParams): Board {
  const board: Board = [];
  for (const kind of occupantKinds(p)) board.push({ floor: 'clean', occupant: { kind } });
  while (board.length < p.urinals) board.push({ floor: 'clean', occupant: null });
  // Splashers keep their invariant (wet neighbours) even in the fallback.
  board.forEach((s, i) => {
    if (s.occupant?.kind !== 'splasher') return;
    for (const j of [i - 1, i + 1]) if (board[j]) board[j]!.floor = 'wet';
  });
  return board;
}

export function generateBoard(
  params: LevelParams,
  rng: Rng,
  w: CostWeights = DEFAULT_WEIGHTS,
): Board {
  for (let attempt = 0; attempt < LEVELS.maxGenerateAttempts; attempt++) {
    const board = randomBoard(params, rng);
    if (board && isValidBoard(board, w)) return board;
  }
  return fallbackBoard(params);
}
