import { LEVELS } from './config';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface LevelParams {
  urinals: number;
  persons: number;
  smellyPersons: number;
  wet: number;
  pee: number;
  timeMs: number;
}

export function startDifficultyLevel(d: Difficulty): number {
  return LEVELS.startLevels[d];
}

function growth(level: number, start: number, every: number): number {
  return level < start ? 0 : 1 + Math.floor((level - start) / every);
}

export function levelParams(difficultyLevel: number): LevelParams {
  const level = Math.max(1, Math.floor(difficultyLevel));
  const urinals = Math.min(
    LEVELS.maxUrinals,
    LEVELS.baseUrinals + Math.floor((level - 1) / LEVELS.urinalEvery),
  );
  const persons = Math.min(
    urinals - 2,
    LEVELS.basePersons + Math.floor((level - 1) / LEVELS.personEvery),
  );
  const free = urinals - persons;
  const smellyPersons = Math.min(persons, growth(level, LEVELS.smellyStart, LEVELS.smellyEvery));
  const pee = Math.min(free, growth(level, LEVELS.peeStart, LEVELS.peeEvery));
  const wet = Math.min(free - pee, growth(level, LEVELS.wetStart, LEVELS.wetEvery));
  const raw = LEVELS.baseTimeMs - LEVELS.timeStepMs * (level - 1);
  const timeMs = Math.max(LEVELS.minTimeMs, Math.round(raw / 100) * 100);
  return { urinals, persons, smellyPersons, wet, pee, timeMs };
}
