import { DEFAULT_WEIGHTS } from './config';
import type { Board, CostWeights } from './types';

const EPSILON = 1e-9;

export function urinalCost(board: Board, index: number, w: CostWeights = DEFAULT_WEIGHTS): number {
  const slot = board[index];
  if (!slot || slot.occupant) return Infinity;
  let cost = w.floor[slot.floor];
  for (let j = 0; j < board.length; j++) {
    const other = board[j];
    if (j === index || !other || !other.occupant) continue;
    const steps = Math.abs(j - index) - 1;
    const spec = w.occupants[other.occupant.kind];
    cost += spec.weight * Math.pow(spec.decayBase, steps);
    cost += w.floor[other.floor] * Math.pow(w.floorScentDecay, steps);
  }
  return cost;
}

export function bestIndices(board: Board, w: CostWeights = DEFAULT_WEIGHTS): number[] {
  const costs = board.map((_, i) => urinalCost(board, i, w));
  const min = Math.min(...costs);
  if (min === Infinity) return [];
  const result: number[] = [];
  costs.forEach((c, i) => {
    if (c - min <= EPSILON) result.push(i);
  });
  return result;
}
