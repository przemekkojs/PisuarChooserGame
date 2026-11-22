import { LEVELS } from './config';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type DynamicKind = 'mop' | 'arrive' | 'leave';

export interface LevelParams {
  urinals: number;
  timeMs: number;
  /** All people combined (including child and parent). */
  people: number;
  /** Subsets of `people`. */
  smelly: number;
  shy: number;
  splasher: number;
  /** 1 = child+parent pair (+gap), counts as 2 people. */
  pairs: 0 | 1;
  /** Extra obstacles, outside `people`. */
  outOfOrder: number;
  /** Total floor-effect budget (including wet from splashers). */
  wet: number;
  pee: number;
  /** Unlocked dynamic events (empty until later tasks). */
  dynamic: DynamicKind[];
  dynamicMax: 1 | 2;
}

export function startDifficultyLevel(d: Difficulty): number {
  return LEVELS.startLevels[d];
}

function growth(level: number, start: number, every: number): number {
  return level < start ? 0 : 1 + Math.floor((level - start) / every);
}

export function levelParams(difficultyLevel: number): LevelParams {
  const level = Number.isFinite(difficultyLevel) ? Math.max(1, Math.floor(difficultyLevel)) : 1;
  const urinals = Math.min(
    LEVELS.maxUrinals,
    LEVELS.baseUrinals + Math.floor((level - 1) / LEVELS.urinalEvery),
  );
  const people = Math.min(urinals - 2, Math.max(1, Math.round(urinals * LEVELS.peopleShare)));
  const outOfOrder = Math.min(
    urinals - 2 - people,
    growth(level, LEVELS.unlock.outOfOrder, LEVELS.outOfOrderEvery),
  );
  // Pair = child + gap + parent (3 slots, 2 people); at least 4 slots stay free (2 is the hard minimum; 4 keeps pHit low enough for balance).
  // Looser budgets (2-3 free) raise pHit and break the balance test's non-decreasing difficulty at L9/L11.
  const pairs: 0 | 1 =
    level >= LEVELS.unlock.pair && urinals >= 5 && people >= 3 && urinals - people - 1 - outOfOrder >= 4 ? 1 : 0;
  // Person subsets share one cap: pair members are never special, and with
  // 2+ people a plain one stays so a smelly/plain mix persists.
  const smellyCap = pairs ? people - 2 : people >= 2 ? people - 1 : people;
  const smelly = Math.min(smellyCap, growth(level, LEVELS.smellyStart, LEVELS.smellyEvery));
  const shy = Math.min(smellyCap - smelly, growth(level, LEVELS.unlock.shy, LEVELS.shyEvery));
  const effectCap = Math.floor(people * LEVELS.effectShareOfPeople);
  // A splasher wets both neighbours, so it needs two effects from the budget.
  const splasher = Math.min(
    smellyCap - smelly - shy,
    Math.floor(effectCap / 2),
    growth(level, LEVELS.unlock.splasher, LEVELS.splasherEvery),
  );
  const pee = Math.min(effectCap, growth(level, LEVELS.peeStart, LEVELS.peeEvery));
  const wetWanted = Math.min(effectCap - pee, growth(level, LEVELS.wetStart, LEVELS.wetEvery));
  const wet = Math.max(wetWanted, 2 * splasher - pee);
  const raw = LEVELS.baseTimeMs - LEVELS.timeStepMs * (level - 1);
  const timeMs = Math.max(LEVELS.minTimeMs, Math.round(raw / 100) * 100);
  return {
    urinals,
    timeMs,
    people,
    smelly,
    shy,
    splasher,
    pairs,
    outOfOrder,
    wet,
    pee,
    dynamic: [],
    dynamicMax: 1,
  };
}
