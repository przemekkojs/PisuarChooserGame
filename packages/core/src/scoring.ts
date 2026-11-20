import type { Board, CostWeights } from './types';
import { DEFAULT_WEIGHTS, SCORING } from './config';
import { urinalCost, bestIndices } from './cost';

export type PickKind = 'best' | 'worse' | 'occupied';

/**
 * Evaluates picking `index`. An out-of-range index never throws: it is
 * treated as `occupied` with delta 0.
 */
export function evaluatePick(
  board: Board,
  index: number,
  w: CostWeights = DEFAULT_WEIGHTS,
): { kind: PickKind; delta: number; best: number[] } {
  const best = bestIndices(board, w);
  const slot = board[index];
  if (!slot || slot.kind === 'person') return { kind: 'occupied', delta: 0, best };
  if (best.includes(index)) return { kind: 'best', delta: SCORING.rewardBest, best };
  const top = best[0];
  if (top === undefined) return { kind: 'occupied', delta: 0, best };
  const diff = urinalCost(board, index, w) - urinalCost(board, top, w);
  const penalty = Math.min(SCORING.maxPenalty, Math.max(1, Math.round(SCORING.penaltyPerCost * diff)));
  return { kind: 'worse', delta: -penalty, best };
}

/** Time lost for picking an occupied urinal, floored to 100 ms. */
export function timePenaltyMs(fullTimeMs: number, smelly: boolean): number {
  const pct = smelly ? SCORING.smellyPct : SCORING.occupiedPct;
  return Math.floor((fullTimeMs * pct) / 100) * 100;
}

/** Penalty for picking `index`; 0 unless that slot is occupied. */
export function occupiedPenaltyMs(board: Board, index: number, fullTimeMs: number): number {
  const slot = board[index];
  if (!slot || slot.kind !== 'person') return 0;
  return timePenaltyMs(fullTimeMs, slot.smelly);
}
