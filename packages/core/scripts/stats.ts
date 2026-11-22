import { createRng } from '../src/rng';
import { levelParams } from '../src/difficulty';
import { generateBoard } from '../src/generator';
import { evaluatePick } from '../src/scoring';

export interface LevelStats {
  level: number;
  urinals: number;
  persons: number;
  smelly: number;
  wet: number;
  pee: number;
  timeMs: number;
  pHit: number;
  expDelta: number;
  difficulty: number;
  /** Share of boards with at least one floor effect under an occupant. */
  underOccupantPct: number;
}

export const SEEDS = 200;
const LEVEL1_TIME = levelParams(1).timeMs;

/** Stats for one level: uniform random pick among free urinals, averaged over fixed seeds. */
export function levelStats(level: number, seeds = SEEDS): LevelStats {
  const p = levelParams(level);
  let hits = 0;
  let picks = 0;
  let deltaSum = 0;
  let underOcc = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const board = generateBoard(p, createRng(seed * 7919 + level));
    if (board.some((s) => s.occupant && s.floor !== 'clean')) underOcc++;
    const free: number[] = [];
    board.forEach((s, i) => {
      if (!s.occupant) free.push(i);
    });
    for (const i of free) {
      const r = evaluatePick(board, i);
      picks++;
      deltaSum += r.delta;
      if (r.kind === 'best') hits++;
    }
  }
  const pHit = hits / picks;
  // difficulty index: harder with lower hit chance and less time
  const difficulty = (1 / pHit) * (LEVEL1_TIME / p.timeMs);
  return {
    level,
    urinals: p.urinals,
    persons: p.people,
    smelly: p.smelly,
    wet: p.wet,
    pee: p.pee,
    timeMs: p.timeMs,
    pHit,
    expDelta: deltaSum / picks,
    difficulty,
    underOccupantPct: underOcc / seeds,
  };
}

