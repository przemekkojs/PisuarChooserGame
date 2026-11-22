import { describe, it, expect } from 'vitest';
import { createGame } from '../src/game';
import type { Game, GameEvent } from '../src/game';
import { bestIndices } from '../src/cost';
import { evaluatePick, occupiedPenaltyMs } from '../src/scoring';
import { levelParams } from '../src/difficulty';
import type { Difficulty } from '../src/difficulty';

const NO_RECORDS: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };

function mk(opts: { seed?: number; balance?: number; records?: Record<Difficulty, number> } = {}): Game {
  return createGame({
    seed: opts.seed ?? 42,
    balance: opts.balance ?? 0,
    records: opts.records ?? { ...NO_RECORDS },
  });
}

function bestIndex(g: Game): number {
  return bestIndices(g.state.board)[0]!;
}

function worseIndex(g: Game): number {
  const b = g.state.board;
  const best = bestIndices(b);
  const i = b.findIndex((s, idx) => !s.occupant && !best.includes(idx));
  if (i < 0) throw new Error('no worse urinal');
  return i;
}

function occupiedIndex(g: Game, smelly?: boolean): number {
  return g.state.board.findIndex(
    (s) => s.occupant !== null && (smelly === undefined || (s.occupant.kind === 'smelly') === smelly),
  );
}

/** From DOOR_CLOSED: open, pick best, nextLevel -> DOOR_CLOSED. */
function solveLevel(g: Game): GameEvent[] {
  const ev: GameEvent[] = [];
  ev.push(...g.dispatch({ type: 'openDoor' }));
  ev.push(...g.dispatch({ type: 'pickUrinal', index: bestIndex(g) }));
  ev.push(...g.dispatch({ type: 'nextLevel' }));
  return ev;
}

/** From DOOR_CLOSED: open and let the time run out -> SUMMARY. */
function lose(g: Game): GameEvent[] {
  return [...g.dispatch({ type: 'openDoor' }), ...g.dispatch({ type: 'tick', dtMs: 1e6 })];
}

function snapshot(g: Game): unknown {
  return JSON.parse(JSON.stringify(g.state));
}

describe('createGame: initial state', () => {
  it('starts in START with injected balance and easy record', () => {
    const g = mk({ balance: 77, records: { easy: 4, medium: 2, hard: 1 } });
    expect(g.state.phase).toBe('START');
    expect(g.state.balance).toBe(77);
    expect(g.state.record).toBe(4);
    expect(g.state.difficulty).toBe('easy');
  });
});

describe('full flow', () => {
  it('easy: start -> open -> best pick -> LEVEL_RESULT -> next -> DOOR_CLOSED', () => {
    const g = mk({ balance: 0 });
    const e1 = g.dispatch({ type: 'startGame', difficulty: 'easy' });
    expect(g.state.phase).toBe('DOOR_CLOSED');
    expect(g.state.playerLevel).toBe(0);
    expect(g.state.difficultyLevel).toBe(1);
    expect(g.state.levelTimeMs).toBe(levelParams(1).timeMs);
    expect(e1).toEqual([{ type: 'LevelStarted', board: g.state.board, timeMs: levelParams(1).timeMs }]);

    expect(g.dispatch({ type: 'openDoor' })).toEqual([{ type: 'DoorOpening' }]);
    expect(g.state.phase).toBe('PLAYING');
    expect(g.state.timeLeftMs).toBe(levelParams(1).timeMs);

    const best = bestIndices(g.state.board);
    const e3 = g.dispatch({ type: 'pickUrinal', index: best[0]! });
    expect(e3).toEqual([{ type: 'PickedBest', best }, { type: 'NewRecord', difficulty: 'easy', level: 1 }]);
    expect(g.state.phase).toBe('LEVEL_RESULT');
    expect(g.state.playerLevel).toBe(1);
    expect(g.state.balance).toBe(10);
    expect(g.state.difficultyLevel).toBe(1);

    const e4 = g.dispatch({ type: 'nextLevel' });
    expect(g.state.phase).toBe('DOOR_CLOSED');
    expect(g.state.difficultyLevel).toBe(2);
    expect(e4).toEqual([{ type: 'LevelStarted', board: g.state.board, timeMs: levelParams(2).timeMs }]);
  });
});

describe('pickUrinal', () => {
  it('worse pick reduces balance by the penalty and still advances playerLevel', () => {
    const g = mk({ balance: 100 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    const i = worseIndex(g);
    const { delta, best } = evaluatePick(g.state.board, i);
    expect(delta).toBeLessThan(0);
    const ev = g.dispatch({ type: 'pickUrinal', index: i });
    expect(ev[0]).toEqual({ type: 'PickedWorse', best, lost: -delta });
    expect(g.state.balance).toBe(100 + delta);
    expect(g.state.playerLevel).toBe(1);
    expect(g.state.phase).toBe('LEVEL_RESULT');
  });

  it('worse pick never drops balance below 0', () => {
    const g = mk({ balance: 0 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    g.dispatch({ type: 'pickUrinal', index: worseIndex(g) });
    expect(g.state.balance).toBe(0);
    expect(g.state.playerLevel).toBe(1);
  });

  it('occupied pick reduces time by exactly the penalty and keeps PLAYING', () => {
    const g = mk({ balance: 5 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    const i = occupiedIndex(g);
    const pen = occupiedPenaltyMs(g.state.board, i, g.state.levelTimeMs);
    expect(pen).toBe(1500);
    const before = g.state.timeLeftMs;
    expect(g.dispatch({ type: 'pickUrinal', index: i })).toEqual([
      { type: 'PickedOccupied', index: i, penaltyMs: pen },
    ]);
    expect(g.state.timeLeftMs).toBe(before - pen);
    expect(g.state.phase).toBe('PLAYING');
    expect(g.state.balance).toBe(5);
    expect(g.state.playerLevel).toBe(0);
    // can click the same occupied urinal again
    g.dispatch({ type: 'pickUrinal', index: i });
    expect(g.state.timeLeftMs).toBe(before - 2 * pen);
  });

  it('penalty >= time left -> TimedOut, SUMMARY, timeLeftMs 0', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    g.dispatch({ type: 'tick', dtMs: g.state.timeLeftMs - 1000 }); // 1000 ms left
    expect(g.state.timeLeftMs).toBe(1000);
    const i = occupiedIndex(g);
    const ev = g.dispatch({ type: 'pickUrinal', index: i });
    expect(ev).toEqual([
      { type: 'PickedOccupied', index: i, penaltyMs: 1500 },
      { type: 'TimedOut' },
    ]);
    expect(g.state.phase).toBe('SUMMARY');
    expect(g.state.timeLeftMs).toBe(0);
  });

  it('penalty exactly equal to time left also times out', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    g.dispatch({ type: 'tick', dtMs: g.state.timeLeftMs - 1500 });
    const ev = g.dispatch({ type: 'pickUrinal', index: occupiedIndex(g) });
    expect(ev.map((e) => e.type)).toEqual(['PickedOccupied', 'TimedOut']);
    expect(g.state.phase).toBe('SUMMARY');
    expect(g.state.timeLeftMs).toBe(0);
  });
});

describe('tick', () => {
  it('does nothing in DOOR_CLOSED', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const before = snapshot(g);
    expect(g.dispatch({ type: 'tick', dtMs: 5000 })).toEqual([]);
    expect(snapshot(g)).toEqual(before);
    g.dispatch({ type: 'openDoor' });
    expect(g.state.timeLeftMs).toBe(levelParams(1).timeMs);
  });

  it('counts down in PLAYING with 100 ms resolution, keeping sub-100 ms remainders', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    const full = g.state.timeLeftMs;
    g.dispatch({ type: 'tick', dtMs: 250 });
    expect(g.state.timeLeftMs).toBe(full - 200);
    for (let k = 0; k < 10; k++) g.dispatch({ type: 'tick', dtMs: 16 }); // +160 -> 410 total
    expect(g.state.timeLeftMs).toBe(full - 400);
    expect(g.state.timeLeftMs % 100).toBe(0);
  });

  it('reaching 0 -> TimedOut and SUMMARY', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    expect(g.dispatch({ type: 'tick', dtMs: g.state.timeLeftMs })).toEqual([{ type: 'TimedOut' }]);
    expect(g.state.phase).toBe('SUMMARY');
    expect(g.state.timeLeftMs).toBe(0);
  });

  it('dtMs 1e9 -> TimedOut without exception', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    expect(() => g.dispatch({ type: 'tick', dtMs: 1e9 })).not.toThrow();
    expect(g.state.phase).toBe('SUMMARY');
    expect(g.state.timeLeftMs).toBe(0);
  });

  it('NaN, negative and infinite dtMs are ignored', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    const before = snapshot(g);
    for (const dtMs of [NaN, -100, -Infinity, Infinity]) {
      expect(g.dispatch({ type: 'tick', dtMs })).toEqual([]);
    }
    expect(snapshot(g)).toEqual(before);
  });
});

describe('perks', () => {
  it('skip: price 10 then 20, playerLevel unchanged, difficulty +1, -> DOOR_CLOSED', () => {
    const g = mk({ balance: 100 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const e1 = g.dispatch({ type: 'skipLevel' });
    expect(e1).toEqual([
      { type: 'PerkBought', perk: 'skip', price: 10 },
      { type: 'LevelStarted', board: g.state.board, timeMs: levelParams(2).timeMs },
    ]);
    expect(g.state.balance).toBe(90);
    expect(g.state.playerLevel).toBe(0);
    expect(g.state.difficultyLevel).toBe(2);
    expect(g.state.phase).toBe('DOOR_CLOSED');
    expect(g.state.perkUses.skip).toBe(1);

    g.dispatch({ type: 'openDoor' });
    const e2 = g.dispatch({ type: 'buyPerk', perk: 'skip' }); // alias, from PLAYING
    expect(e2[0]).toEqual({ type: 'PerkBought', perk: 'skip', price: 20 });
    expect(g.state.balance).toBe(70);
    expect(g.state.difficultyLevel).toBe(3);
    expect(g.state.phase).toBe('DOOR_CLOSED');
    expect(g.state.perkUses.skip).toBe(2);
  });

  it('skip with too little balance -> PerkRejected, state unchanged', () => {
    const g = mk({ balance: 9 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const before = snapshot(g);
    expect(g.dispatch({ type: 'skipLevel' })).toEqual([{ type: 'PerkRejected', perk: 'skip' }]);
    expect(snapshot(g)).toEqual(before);
  });

  it('skip is not allowed in LEVEL_RESULT, SUMMARY or START', () => {
    const g = mk({ balance: 100 });
    expect(g.dispatch({ type: 'skipLevel' })).toEqual([]);
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    g.dispatch({ type: 'pickUrinal', index: bestIndex(g) });
    const before = snapshot(g);
    expect(g.dispatch({ type: 'skipLevel' })).toEqual([]);
    expect(g.dispatch({ type: 'buyPerk', perk: 'skip' })).toEqual([]);
    expect(snapshot(g)).toEqual(before);
  });

  it('continue: price 15 then 30, playerLevel unchanged, difficulty +1, full time', () => {
    const g = mk({ balance: 100 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    lose(g);
    expect(g.state.balance).toBe(100); // loss does not take balance
    const e1 = g.dispatch({ type: 'buyPerk', perk: 'continue' });
    expect(e1).toEqual([
      { type: 'PerkBought', perk: 'continue', price: 15 },
      { type: 'LevelStarted', board: g.state.board, timeMs: levelParams(2).timeMs },
    ]);
    expect(g.state.phase).toBe('DOOR_CLOSED');
    expect(g.state.balance).toBe(85);
    expect(g.state.playerLevel).toBe(0);
    expect(g.state.difficultyLevel).toBe(2);
    expect(g.state.timeLeftMs).toBe(levelParams(2).timeMs);

    lose(g);
    const e2 = g.dispatch({ type: 'buyPerk', perk: 'continue' });
    expect(e2[0]).toEqual({ type: 'PerkBought', perk: 'continue', price: 30 });
    expect(g.state.balance).toBe(55);
    expect(g.state.difficultyLevel).toBe(3);
    expect(g.state.perkUses.continue).toBe(2);
  });

  it('continue with too little balance -> PerkRejected, state unchanged', () => {
    const g = mk({ balance: 14 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    lose(g);
    const before = snapshot(g);
    expect(g.dispatch({ type: 'buyPerk', perk: 'continue' })).toEqual([
      { type: 'PerkRejected', perk: 'continue' },
    ]);
    expect(snapshot(g)).toEqual(before);
  });

  it('continue is only allowed in SUMMARY', () => {
    const g = mk({ balance: 100 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const before = snapshot(g);
    expect(g.dispatch({ type: 'buyPerk', perk: 'continue' })).toEqual([]);
    expect(snapshot(g)).toEqual(before);
  });

  it('perkUses are reset by a new game', () => {
    const g = mk({ balance: 1000 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'skipLevel' });
    lose(g);
    g.dispatch({ type: 'buyPerk', perk: 'continue' });
    lose(g);
    expect(g.state.perkUses).toEqual({ skip: 1, continue: 1 });
    g.dispatch({ type: 'acknowledgeSummary' });
    expect(g.state.phase).toBe('START');
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    expect(g.state.perkUses).toEqual({ skip: 0, continue: 0 });
    expect(g.dispatch({ type: 'skipLevel' })[0]).toEqual({ type: 'PerkBought', perk: 'skip', price: 10 });
  });
});

describe('level counters', () => {
  it('solve 2, skip once, lose, continue twice -> playerLevel 2, difficultyLevel 1+2+1+2 = 6', () => {
    const g = mk({ balance: 1000 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    solveLevel(g);
    solveLevel(g);
    expect(g.state.playerLevel).toBe(2);
    expect(g.state.difficultyLevel).toBe(3);
    g.dispatch({ type: 'skipLevel' });
    expect(g.state.difficultyLevel).toBe(4);
    lose(g);
    g.dispatch({ type: 'buyPerk', perk: 'continue' });
    lose(g);
    g.dispatch({ type: 'buyPerk', perk: 'continue' });
    expect(g.state.playerLevel).toBe(2);
    expect(g.state.difficultyLevel).toBe(6);
    expect(g.state.levelTimeMs).toBe(levelParams(6).timeMs);
  });

  it("startGame('hard') starts at difficultyLevel 15", () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'hard' });
    expect(g.state.difficulty).toBe('hard');
    expect(g.state.difficultyLevel).toBe(15);
    expect(g.state.playerLevel).toBe(0);
    expect(g.state.levelTimeMs).toBe(levelParams(15).timeMs);
    expect(g.state.board.length).toBe(levelParams(15).urinals);
  });

  it("startGame('medium') starts at difficultyLevel 8", () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'medium' });
    expect(g.state.difficultyLevel).toBe(8);
  });
});

describe('record', () => {
  it('loss at playerLevel 9 leaves record 9; NewRecord emitted on each raising pick', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const records: GameEvent[] = [];
    for (let k = 0; k < 9; k++) records.push(...solveLevel(g).filter((e) => e.type === 'NewRecord'));
    expect(records).toEqual(
      Array.from({ length: 9 }, (_, k) => ({ type: 'NewRecord', difficulty: 'easy', level: k + 1 })),
    );
    expect(g.state.record).toBe(9);
    const lost = lose(g);
    expect(lost.some((e) => e.type === 'NewRecord')).toBe(false);
    expect(g.state.record).toBe(9);
    expect(g.dispatch({ type: 'acknowledgeSummary' })).toEqual([]);
    expect(g.state.phase).toBe('START');
    expect(g.state.record).toBe(9);
  });

  it('only emits NewRecord when exceeding the stored record', () => {
    const g = mk({ records: { easy: 2, medium: 0, hard: 0 } });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    expect(solveLevel(g).some((e) => e.type === 'NewRecord')).toBe(false);
    expect(solveLevel(g).some((e) => e.type === 'NewRecord')).toBe(false);
    expect(solveLevel(g).filter((e) => e.type === 'NewRecord')).toEqual([
      { type: 'NewRecord', difficulty: 'easy', level: 3 },
    ]);
    expect(g.state.record).toBe(3);
  });

  it('skip and continue never raise the record', () => {
    const g = mk({ balance: 1000 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const ev: GameEvent[] = [];
    ev.push(...g.dispatch({ type: 'skipLevel' }));
    ev.push(...g.dispatch({ type: 'skipLevel' }));
    ev.push(...lose(g));
    ev.push(...g.dispatch({ type: 'buyPerk', perk: 'continue' }));
    ev.push(...lose(g));
    ev.push(...g.dispatch({ type: 'acknowledgeSummary' }));
    expect(ev.some((e) => e.type === 'NewRecord')).toBe(false);
    expect(g.state.record).toBe(0);
  });

  it('records are independent per difficulty', () => {
    const g = mk({ records: { easy: 5, medium: 0, hard: 3 } });
    g.dispatch({ type: 'startGame', difficulty: 'medium' });
    expect(g.state.record).toBe(0);
    expect(solveLevel(g).filter((e) => e.type === 'NewRecord')).toEqual([
      { type: 'NewRecord', difficulty: 'medium', level: 1 },
    ]);
    lose(g);
    g.dispatch({ type: 'acknowledgeSummary' });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    expect(g.state.record).toBe(5);
    expect(solveLevel(g).some((e) => e.type === 'NewRecord')).toBe(false);
    lose(g);
    g.dispatch({ type: 'acknowledgeSummary' });
    g.dispatch({ type: 'startGame', difficulty: 'hard' });
    expect(g.state.record).toBe(3);
    lose(g);
    g.dispatch({ type: 'acknowledgeSummary' });
    g.dispatch({ type: 'startGame', difficulty: 'medium' });
    expect(g.state.record).toBe(1); // remembered within the session
  });
});

describe('invalid commands', () => {
  it('wrong-phase commands return [] and leave state unchanged', () => {
    const g = mk({ balance: 100 });
    const cases: Array<[() => void, Parameters<Game['dispatch']>[0][]]> = [
      [() => {}, [
        { type: 'openDoor' }, { type: 'pickUrinal', index: 0 }, { type: 'nextLevel' },
        { type: 'tick', dtMs: 100 }, { type: 'acknowledgeSummary' }, { type: 'buyPerk', perk: 'continue' },
      ]],
      [() => g.dispatch({ type: 'startGame', difficulty: 'easy' }), [
        { type: 'startGame', difficulty: 'easy' }, { type: 'pickUrinal', index: 0 }, { type: 'nextLevel' },
        { type: 'acknowledgeSummary' },
      ]],
      [() => g.dispatch({ type: 'openDoor' }), [
        { type: 'startGame', difficulty: 'hard' }, { type: 'openDoor' }, { type: 'nextLevel' },
        { type: 'acknowledgeSummary' }, { type: 'buyPerk', perk: 'continue' },
      ]],
      [() => g.dispatch({ type: 'pickUrinal', index: bestIndex(g) }), [
        { type: 'startGame', difficulty: 'easy' }, { type: 'openDoor' }, { type: 'pickUrinal', index: 0 },
        { type: 'tick', dtMs: 100 }, { type: 'acknowledgeSummary' },
      ]],
      [() => { g.dispatch({ type: 'nextLevel' }); lose(g); }, [
        { type: 'startGame', difficulty: 'easy' }, { type: 'openDoor' }, { type: 'pickUrinal', index: 0 },
        { type: 'tick', dtMs: 100 }, { type: 'nextLevel' }, { type: 'skipLevel' },
      ]],
    ];
    for (const [setup, cmds] of cases) {
      setup();
      const before = snapshot(g);
      for (const c of cmds) expect(g.dispatch(c)).toEqual([]);
      expect(snapshot(g)).toEqual(before);
    }
  });

  it('pickUrinal(-1), (99) and non-integer index return [] and leave state unchanged', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    const before = snapshot(g);
    for (const index of [-1, 99, 0.5, NaN]) {
      expect(g.dispatch({ type: 'pickUrinal', index })).toEqual([]);
    }
    expect(snapshot(g)).toEqual(before);
  });

  it('mutating the exposed state does not affect the game', () => {
    const g = mk({ balance: 10 });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const s = g.state as { balance: number; board: unknown[] };
    s.balance = 9999;
    s.board.length = 0;
    expect(g.state.balance).toBe(10);
    expect(g.state.board.length).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  function run(seed: number): { events: GameEvent[]; boards: unknown[] } {
    const g = mk({ seed, balance: 1000 });
    const events: GameEvent[] = [];
    const boards: unknown[] = [];
    events.push(...g.dispatch({ type: 'startGame', difficulty: 'easy' }));
    for (let k = 0; k < 5; k++) {
      boards.push(g.state.board);
      events.push(...solveLevel(g));
    }
    events.push(...g.dispatch({ type: 'skipLevel' }));
    boards.push(g.state.board);
    events.push(...lose(g));
    events.push(...g.dispatch({ type: 'buyPerk', perk: 'continue' }));
    boards.push(g.state.board);
    return { events, boards };
  }

  it('same seed and commands -> identical boards and events', () => {
    expect(run(123)).toEqual(run(123));
  });

  it('different seeds give different board sequences', () => {
    expect(run(1).boards).not.toEqual(run(2).boards);
  });
});

describe('pause, resume and endRun', () => {
  function playing(opts: Parameters<typeof mk>[0] = {}): Game {
    const g = mk(opts);
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    g.dispatch({ type: 'openDoor' });
    return g;
  }

  it('pause emits Paused once and sets paused', () => {
    const g = playing();
    expect(g.dispatch({ type: 'pause' })).toEqual([{ type: 'Paused' }]);
    expect(g.state.paused).toBe(true);
    expect(g.dispatch({ type: 'pause' })).toEqual([]);
  });

  it('ignores gameplay commands while paused', () => {
    const g = playing();
    g.dispatch({ type: 'pause' });
    const before = g.state.timeLeftMs;
    expect(g.dispatch({ type: 'tick', dtMs: 5000 })).toEqual([]);
    expect(g.dispatch({ type: 'pickUrinal', index: 0 })).toEqual([]);
    expect(g.dispatch({ type: 'skipLevel' })).toEqual([]);
    expect(g.dispatch({ type: 'openDoor' })).toEqual([]);
    expect(g.state.timeLeftMs).toBe(before);
  });

  it('resume continues without losing time', () => {
    const g = playing();
    g.dispatch({ type: 'pause' });
    const before = g.state.timeLeftMs;
    expect(g.dispatch({ type: 'resume' })).toEqual([{ type: 'Resumed' }]);
    expect(g.state.paused).toBe(false);
    g.dispatch({ type: 'tick', dtMs: 100 });
    expect(g.state.timeLeftMs).toBe(before - 100);
    expect(g.dispatch({ type: 'resume' })).toEqual([]);
  });

  it('pause works in DOOR_CLOSED; openDoor blocked until resume', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    expect(g.dispatch({ type: 'pause' })).toEqual([{ type: 'Paused' }]);
    expect(g.dispatch({ type: 'openDoor' })).toEqual([]);
    g.dispatch({ type: 'resume' });
    expect(g.dispatch({ type: 'openDoor' })).toEqual([{ type: 'DoorOpening' }]);
  });

  it('pause is ignored outside PLAYING/DOOR_CLOSED', () => {
    const g = mk();
    expect(g.dispatch({ type: 'pause' })).toEqual([]);
  });

  it('endRun from PLAYING, paused, DOOR_CLOSED and LEVEL_RESULT goes to SUMMARY', () => {
    const fromPlaying = playing();
    const fromPaused = playing();
    fromPaused.dispatch({ type: 'pause' });
    const fromDoor = mk();
    fromDoor.dispatch({ type: 'startGame', difficulty: 'easy' });
    const fromResult = playing();
    fromResult.dispatch({ type: 'pickUrinal', index: bestIndex(fromResult) });
    expect(fromResult.state.phase).toBe('LEVEL_RESULT');
    for (const g of [fromPlaying, fromPaused, fromDoor, fromResult]) {
      expect(g.dispatch({ type: 'endRun' })).toEqual([{ type: 'RunEnded' }]);
      expect(g.state.phase).toBe('SUMMARY');
      expect(g.state.paused).toBe(false);
      expect(g.state.endedByPlayer).toBe(true);
    }
  });

  it('endRun is ignored in START and SUMMARY', () => {
    const g = mk();
    expect(g.dispatch({ type: 'endRun' })).toEqual([]);
    const h = playing();
    h.dispatch({ type: 'endRun' });
    expect(h.dispatch({ type: 'endRun' })).toEqual([]);
  });

  it('after endRun: no continue perk; acknowledge resets endedByPlayer', () => {
    const g = playing({ balance: 1e6 });
    g.dispatch({ type: 'endRun' });
    expect(g.dispatch({ type: 'buyPerk', perk: 'continue' })).toEqual([]);
    expect(g.state.balance).toBe(1e6);
    g.dispatch({ type: 'acknowledgeSummary' });
    expect(g.state.phase).toBe('START');
    expect(g.state.endedByPlayer).toBe(false);
  });

  it('record counts solved levels only; endRun emits no second NewRecord', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    const evs: GameEvent[] = [];
    evs.push(...solveLevel(g));
    evs.push(...solveLevel(g));
    expect(g.state.playerLevel).toBe(2);
    expect(evs.filter((e) => e.type === 'NewRecord')).toHaveLength(2);
    const end = g.dispatch({ type: 'endRun' });
    expect(end).toEqual([{ type: 'RunEnded' }]);
    expect(g.state.record).toBe(2);
  });

  it('playerLevel after endRun mid-level equals solved count', () => {
    const g = mk();
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    solveLevel(g);
    g.dispatch({ type: 'openDoor' });
    g.dispatch({ type: 'endRun' });
    expect(g.state.playerLevel).toBe(1);
  });

  it('a new startGame resets paused and endedByPlayer', () => {
    const g = playing();
    g.dispatch({ type: 'endRun' });
    g.dispatch({ type: 'acknowledgeSummary' });
    g.dispatch({ type: 'startGame', difficulty: 'easy' });
    expect(g.state.paused).toBe(false);
    expect(g.state.endedByPlayer).toBe(false);
  });
});

describe('pickUrinal on gap, child and parent', () => {
  it('gap costs 20% and child/parent 10% as PickedOccupied', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40 && seen.size < 3; seed++) {
      const g = mk({ seed });
      g.dispatch({ type: 'startGame', difficulty: 'hard' });
      g.dispatch({ type: 'openDoor' });
      const board = g.state.board;
      const time = g.state.levelTimeMs;
      for (const kind of ['gap', 'child', 'parent'] as const) {
        const index = board.findIndex((s) => s.occupant?.kind === kind);
        if (index < 0 || seen.has(kind)) continue;
        seen.add(kind);
        const pct = kind === 'gap' ? 0.2 : 0.1;
        const penaltyMs = Math.floor((time * pct) / 100) * 100;
        expect(g.dispatch({ type: 'pickUrinal', index })).toEqual([{ type: 'PickedOccupied', index, penaltyMs }]);
        expect(g.state.phase).toBe('PLAYING');
        break;
      }
    }
    expect([...seen].sort()).toEqual(['child', 'gap', 'parent']);
  });
});
