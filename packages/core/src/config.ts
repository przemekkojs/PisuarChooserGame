import type { CostWeights } from './types';

export const DEFAULT_WEIGHTS: CostWeights = {
  floor: { clean: 0, wet: 1, pee: 3 },
  smellyMultiplier: 3,
  decayBase: 0.5,
};

/** Tunable level-progression constants (consumed by levelParams). */
export const LEVELS = {
  baseUrinals: 3,
  maxUrinals: 18,
  /** +1 urinal every N levels. */
  urinalEvery: 2,
  basePersons: 1,
  /** +1 person every N levels. */
  personEvery: 12,
  /** Smelly persons: first appear at smellyStart, +1 every smellyEvery levels. */
  smellyStart: 6,
  smellyEvery: 5,
  /** Wet floors: first appear at wetStart, +1 every wetEvery levels. */
  wetStart: 5,
  wetEvery: 5,
  /** Pee puddles: first appear at peeStart, +1 every peeEvery levels. */
  peeStart: 10,
  peeEvery: 8,
  baseTimeMs: 15000,
  minTimeMs: 3000,
  timeStepMs: 300,
  /** Max random draws before the deterministic fallback board is used. */
  maxGenerateAttempts: 100,
  startLevels: { easy: 1, medium: 8, hard: 15 },
} as const;

/** Scoring constants. */
export const SCORING = {
  rewardBest: 10,
  penaltyPerCost: 3,
  maxPenalty: 15,
  occupiedPct: 0.1,
  smellyPct: 0.2,
} as const;

/** Base perk prices (doubled per use). */
export const PERK_BASE = { skip: 10, continue: 15 } as const;
