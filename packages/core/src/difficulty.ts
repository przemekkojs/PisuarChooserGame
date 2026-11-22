import { LEVELS } from './config';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type DynamicKind = 'mop' | 'arrive' | 'leave';

/** All dynamic kinds, in unlock order. */
const DYNAMIC_KINDS: readonly DynamicKind[] = ['mop', 'leave', 'arrive'];

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
  /** Unlocked dynamic event kinds. */
  dynamic: DynamicKind[];
  dynamicMax: 1 | 2;
}

export function startDifficultyLevel(d: Difficulty): number {
  return LEVELS.startLevels[d];
}

function growth(level: number, start: number, every: number): number {
  return level < start ? 0 : 1 + Math.floor((level - start) / every);
}

type SpecialKind = 'smelly' | 'shy' | 'splasher';
const SPECIAL_KINDS: readonly SpecialKind[] = ['smelly', 'shy', 'splasher'];

/**
 * Splits `cap` special persons among the wanted counts, one per kind per round
 * (round-robin). The starting kind rotates with the level, so when the cap is
 * smaller than the number of unlocked kinds each of them still shows up on
 * some levels instead of the first one always winning. Deterministic.
 */
function splitSpecials(level: number, cap: number, wanted: Record<SpecialKind, number>): Record<SpecialKind, number> {
  const out: Record<SpecialKind, number> = { smelly: 0, shy: 0, splasher: 0 };
  const kinds = SPECIAL_KINDS.filter((k) => wanted[k] > 0);
  // Offset +1: the newest kind leads on its unlock level (shy at L12, splasher at L16).
  const order = kinds.map((_, i) => kinds[(i + level + 1) % kinds.length]!);
  let left = cap;
  while (left > 0 && order.some((k) => out[k] < wanted[k])) {
    for (const k of order) {
      if (left === 0) break;
      if (out[k] < wanted[k]) {
        out[k]++;
        left--;
      }
    }
  }
  return out;
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
  // 2+ people at least one plain person always remains (spec 6).
  const specialCap = Math.max(0, people >= 2 ? people - 1 - 2 * pairs : people);
  const effectCap = Math.floor(people * LEVELS.effectShareOfPeople);
  const { smelly, shy, splasher } = splitSpecials(level, specialCap, {
    smelly: growth(level, LEVELS.smellyStart, LEVELS.smellyEvery),
    shy: growth(level, LEVELS.unlock.shy, LEVELS.shyEvery),
    // A splasher wets both neighbours, so it needs two wet floors from the budget.
    splasher: Math.min(Math.floor(effectCap / 2), growth(level, LEVELS.unlock.splasher, LEVELS.splasherEvery)),
  });
  // Wet floors for splashers are reserved first; pee takes the rest but leaves
  // one slot for a random wet floor once wet is unlocked and the budget allows.
  const wetMin = 2 * splasher;
  const free = effectCap - wetMin;
  const pee = Math.max(
    0,
    Math.min(free - (free >= 2 && level >= LEVELS.wetStart ? 1 : 0), growth(level, LEVELS.peeStart, LEVELS.peeEvery)),
  );
  const wet = Math.min(effectCap - pee, Math.max(wetMin, growth(level, LEVELS.wetStart, LEVELS.wetEvery)));
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
    dynamic: DYNAMIC_KINDS.filter((k) => level >= LEVELS.dynamic.unlock[k]),
    dynamicMax: level >= LEVELS.dynamic.secondEventLevel ? 2 : 1,
  };
}
