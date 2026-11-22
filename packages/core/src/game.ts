import type { Board } from './types';
import type { Difficulty, DynamicKind } from './difficulty';
import type { PerkType } from './perks';
import { levelParams, startDifficultyLevel } from './difficulty';
import { generateBoard } from './generator';
import { createRng } from './rng';
import { evaluatePick, occupiedPenaltyMs } from './scoring';
import { perkPrice } from './perks';
import { applyEvent, copyBoard, planEvents } from './events';
import type { ScheduledEvent } from './events';

export type Phase = 'START' | 'DOOR_CLOSED' | 'PLAYING' | 'LEVEL_RESULT' | 'SUMMARY';

export type Command =
  | { type: 'startGame'; difficulty: Difficulty }
  | { type: 'openDoor' }
  | { type: 'pickUrinal'; index: number }
  | { type: 'tick'; dtMs: number }
  | { type: 'skipLevel' }
  | { type: 'nextLevel' }
  | { type: 'buyPerk'; perk: PerkType }
  | { type: 'acknowledgeSummary' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'endRun' };

export type GameEvent =
  | { type: 'DoorOpening' }
  | { type: 'LevelStarted'; board: Board; timeMs: number }
  | { type: 'PickedBest'; best: number[] }
  | { type: 'PickedWorse'; best: number[]; lost: number }
  | { type: 'PickedOccupied'; index: number; penaltyMs: number }
  | { type: 'TimedOut' }
  | { type: 'PerkBought'; perk: PerkType; price: number }
  | { type: 'PerkRejected'; perk: PerkType }
  | { type: 'NewRecord'; difficulty: Difficulty; level: number }
  | { type: 'Paused' }
  | { type: 'Resumed' }
  | { type: 'RunEnded' }
  | { type: 'Telegraphed'; id: number; kind: DynamicKind; index: number }
  | { type: 'Applied'; id: number; kind: DynamicKind; index: number; board: Board }
  | { type: 'Cancelled'; id: number };

export interface GameState {
  phase: Phase;
  difficulty: Difficulty;
  /** Levels solved by picking a free urinal (the UI shows playerLevel + 1). */
  playerLevel: number;
  /** Drives board parameters; +1 on every new board. */
  difficultyLevel: number;
  balance: number;
  board: Board;
  /** Always a multiple of 100 ms. */
  timeLeftMs: number;
  levelTimeMs: number;
  perkUses: Record<PerkType, number>;
  /** Stored record for the current difficulty. */
  record: number;
  /** True while the run is paused; all gameplay commands are ignored. */
  paused: boolean;
  /** True when the run ended by endRun (no Continue perk offered). */
  endedByPlayer: boolean;
  /** Dynamic events of the current level not applied yet, sorted by applyAtMs. */
  pending: ScheduledEvent[];
}

export interface Game {
  /** A fresh snapshot on every access; mutating it does not affect the game. */
  readonly state: Readonly<GameState>;
  dispatch(cmd: Command): GameEvent[];
}

export interface GameOptions {
  seed: number;
  balance: number;
  records: Record<Difficulty, number>;
}

const TIMER_STEP_MS = 100;

export function createGame(opts: GameOptions): Game {
  const rng = createRng(opts.seed);
  const records: Record<Difficulty, number> = { ...opts.records };
  const s: GameState = {
    phase: 'START',
    difficulty: 'easy',
    playerLevel: 0,
    difficultyLevel: startDifficultyLevel('easy'),
    balance: Math.max(0, opts.balance),
    board: [],
    timeLeftMs: 0,
    levelTimeMs: 0,
    perkUses: { skip: 0, continue: 0 },
    record: records.easy,
    paused: false,
    endedByPlayer: false,
    pending: [],
  };
  let lastEventId = 0;
  const nextEventId = (): number => ++lastEventId;
  /** Sub-100 ms time accumulated by tick, not yet shown in timeLeftMs. */
  let tickRemainder = 0;

  function newBoard(difficultyLevel: number): GameEvent {
    const params = levelParams(difficultyLevel);
    s.difficultyLevel = difficultyLevel;
    s.board = generateBoard(params, rng);
    s.levelTimeMs = params.timeMs;
    s.timeLeftMs = params.timeMs;
    tickRemainder = 0;
    s.pending = [];
    s.phase = 'DOOR_CLOSED';
    return { type: 'LevelStarted', board: copyBoard(s.board), timeMs: params.timeMs };
  }

  function timeOut(): GameEvent {
    s.timeLeftMs = 0;
    tickRemainder = 0;
    s.pending = [];
    s.phase = 'SUMMARY';
    return { type: 'TimedOut' };
  }

  function buy(perk: PerkType): GameEvent[] {
    const price = perkPrice(perk, s.perkUses[perk]);
    if (s.balance < price) return [{ type: 'PerkRejected', perk }];
    s.balance -= price;
    s.perkUses[perk] += 1;
    return [{ type: 'PerkBought', perk, price }, newBoard(s.difficultyLevel + 1)];
  }

  function skip(): GameEvent[] {
    if (s.phase !== 'DOOR_CLOSED' && s.phase !== 'PLAYING') return [];
    return buy('skip');
  }

  function pick(index: number): GameEvent[] {
    if (s.phase !== 'PLAYING') return [];
    if (!Number.isInteger(index) || index < 0 || index >= s.board.length) return [];
    const slot = s.board[index]!;
    if (slot.occupant) {
      const penaltyMs = occupiedPenaltyMs(s.board, index, s.levelTimeMs);
      const ev: GameEvent[] = [{ type: 'PickedOccupied', index, penaltyMs }];
      s.timeLeftMs -= penaltyMs;
      ev.push(...(s.timeLeftMs <= 0 ? [timeOut()] : advanceEvents()));
      return ev;
    }
    const { kind, delta, best } = evaluatePick(s.board, index);
    s.balance = Math.max(0, s.balance + delta);
    const ev: GameEvent[] =
      kind === 'best' ? [{ type: 'PickedBest', best }] : [{ type: 'PickedWorse', best, lost: -delta }];
    s.playerLevel += 1;
    s.pending = [];
    s.phase = 'LEVEL_RESULT';
    if (s.playerLevel > s.record) {
      s.record = s.playerLevel;
      records[s.difficulty] = s.playerLevel;
      ev.push({ type: 'NewRecord', difficulty: s.difficulty, level: s.playerLevel });
    }
    return ev;
  }

  function tick(dtMs: number): GameEvent[] {
    if (s.phase !== 'PLAYING') return [];
    if (!Number.isFinite(dtMs) || dtMs < 0) return [];
    tickRemainder += dtMs;
    const steps = Math.floor(tickRemainder / TIMER_STEP_MS);
    if (steps === 0) return [];
    tickRemainder -= steps * TIMER_STEP_MS;
    s.timeLeftMs -= steps * TIMER_STEP_MS;
    return s.timeLeftMs <= 0 ? [timeOut()] : advanceEvents();
  }

  /**
   * Telegraphs and applies pending events whose time has come (elapsed since
   * the door opened). Called after every time change while PLAYING.
   */
  function advanceEvents(): GameEvent[] {
    const elapsed = s.levelTimeMs - s.timeLeftMs;
    const out: GameEvent[] = [];
    for (const ev of [...s.pending]) {
      if (!ev.telegraphed && elapsed >= ev.telegraphAtMs) {
        ev.telegraphed = true;
        out.push({ type: 'Telegraphed', id: ev.id, kind: ev.kind, index: ev.index });
      }
      if (elapsed < ev.applyAtMs) continue;
      s.pending = s.pending.filter((p) => p !== ev);
      const next = applyEvent(s.board, ev, rng, s.difficultyLevel);
      if (next) {
        s.board = next;
        out.push({ type: 'Applied', id: ev.id, kind: ev.kind, index: ev.index, board: copyBoard(next) });
      } else {
        out.push({ type: 'Cancelled', id: ev.id });
      }
    }
    return out;
  }

  /** Commands that still work while paused. */
  const PAUSE_PASSTHROUGH = new Set<Command['type']>(['resume', 'endRun']);

  function dispatch(cmd: Command): GameEvent[] {
    if (s.paused && !PAUSE_PASSTHROUGH.has(cmd.type)) return [];
    switch (cmd.type) {
      case 'startGame': {
        if (s.phase !== 'START') return [];
        s.difficulty = cmd.difficulty;
        s.record = records[cmd.difficulty];
        s.playerLevel = 0;
        s.paused = false;
        s.endedByPlayer = false;
        s.perkUses = { skip: 0, continue: 0 };
        return [newBoard(startDifficultyLevel(cmd.difficulty))];
      }
      case 'openDoor': {
        if (s.phase !== 'DOOR_CLOSED') return [];
        s.phase = 'PLAYING';
        s.timeLeftMs = s.levelTimeMs;
        tickRemainder = 0;
        s.pending = planEvents(s.board, levelParams(s.difficultyLevel), s.levelTimeMs, rng, nextEventId);
        // A telegraph at elapsed 0 (short levels) goes out with the door, keeping the full TELEGRAPH_MS warning.
        return [{ type: 'DoorOpening' }, ...advanceEvents()];
      }
      case 'pickUrinal':
        return pick(cmd.index);
      case 'tick':
        return tick(cmd.dtMs);
      case 'skipLevel':
        return skip();
      case 'nextLevel':
        if (s.phase !== 'LEVEL_RESULT') return [];
        return [newBoard(s.difficultyLevel + 1)];
      case 'buyPerk':
        if (cmd.perk === 'skip') return skip();
        if (cmd.perk === 'continue' && s.phase === 'SUMMARY' && !s.endedByPlayer) return buy('continue');
        return [];
      case 'acknowledgeSummary':
        if (s.phase !== 'SUMMARY') return [];
        s.phase = 'START';
        s.endedByPlayer = false;
        return [];
      case 'pause':
        if (s.phase !== 'PLAYING' && s.phase !== 'DOOR_CLOSED') return [];
        s.paused = true;
        return [{ type: 'Paused' }];
      case 'resume':
        if (!s.paused) return [];
        s.paused = false;
        return [{ type: 'Resumed' }];
      case 'endRun':
        if (s.phase === 'START' || s.phase === 'SUMMARY') return [];
        s.paused = false;
        s.endedByPlayer = true;
        tickRemainder = 0;
        s.pending = [];
        s.phase = 'SUMMARY';
        return [{ type: 'RunEnded' }];
      default:
        return [];
    }
  }

  return {
    get state(): Readonly<GameState> {
      return {
        ...s,
        board: copyBoard(s.board),
        perkUses: { ...s.perkUses },
        pending: s.pending.map((e) => ({ ...e })),
      };
    },
    dispatch,
  };
}
