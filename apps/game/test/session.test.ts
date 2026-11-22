import { describe, expect, it, vi } from 'vitest';
import { createGame, type Difficulty, type GameEvent, type GameState } from '@pisuar/core';
import { createSession } from '../src/session';
import type { Saved, Storage } from '../src/storage';
import type { PlatformServices } from '../src/ports';

const ZERO: Saved = { balance: 0, records: { easy: 0, medium: 0, hard: 0 } };

function fakeStorage(initial: Saved = ZERO, delays: number[] = []) {
  let stored: Saved = structuredClone(initial);
  const saves: Saved[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let call = 0;
  const storage: Storage = {
    load: async () => structuredClone(stored),
    save: async (s) => {
      const delay = delays[call++] ?? 0;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, delay));
      stored = structuredClone(s);
      saves.push(structuredClone(s));
      inFlight -= 1;
    },
  };
  return {
    storage,
    saves,
    get stored() {
      return stored;
    },
    get maxInFlight() {
      return maxInFlight;
    },
  };
}

function fakePlatform(reject = false) {
  const submitHighestLevel = vi.fn((_d: Difficulty, _l: number) =>
    reject ? Promise.reject(new Error('offline')) : Promise.resolve(),
  );
  const platform: PlatformServices = { submitHighestLevel };
  return { platform, submitHighestLevel };
}

/** A real state snapshot with the given balance (other fields do not matter here). */
function stateWith(balance: number, difficulty: Difficulty = 'easy'): GameState {
  const g = createGame({ seed: 1, balance, records: ZERO.records });
  g.dispatch({ type: 'startGame', difficulty });
  return { ...g.state };
}

const ev = {
  best: { type: 'PickedBest', best: [0] } as GameEvent,
  perk: { type: 'PerkBought', perk: 'continue', price: 10 } as GameEvent,
  record: (difficulty: Difficulty, level: number): GameEvent => ({
    type: 'NewRecord',
    difficulty,
    level,
  }),
};

describe('session', () => {
  it('init loads the saved balance and records into newGame', async () => {
    const st = fakeStorage({ balance: 50, records: { easy: 3, medium: 7, hard: 1 } });
    const s = createSession({ storage: st.storage, platform: fakePlatform().platform, seed: () => 42 });
    await s.init();
    const game = s.newGame('medium');
    expect(game.state.phase).toBe('DOOR_CLOSED');
    expect(game.state.difficulty).toBe('medium');
    expect(game.state.balance).toBe(50);
    expect(game.state.record).toBe(7);
    expect(s.getBalance()).toBe(50);
    expect(s.getRecords()).toEqual({ easy: 3, medium: 7, hard: 1 });
  });

  it('persists and submits a NewRecord once', async () => {
    const st = fakeStorage({ balance: 5, records: { easy: 0, medium: 7, hard: 0 } });
    const p = fakePlatform();
    const s = createSession({ storage: st.storage, platform: p.platform, seed: () => 1 });
    await s.init();
    await s.onEvents('medium', stateWith(5, 'medium'), [ev.record('medium', 8)]);
    expect(st.saves).toHaveLength(1);
    expect(st.stored.records).toEqual({ easy: 0, medium: 8, hard: 0 });
    expect(p.submitHighestLevel).toHaveBeenCalledTimes(1);
    expect(p.submitHighestLevel).toHaveBeenCalledWith('medium', 8);
    expect(s.getRecords().medium).toBe(8);
  });

  it('does not persist or submit an equal or lower record', async () => {
    const st = fakeStorage({ balance: 5, records: { easy: 0, medium: 7, hard: 0 } });
    const p = fakePlatform();
    const s = createSession({ storage: st.storage, platform: p.platform, seed: () => 1 });
    await s.init();
    await s.onEvents('medium', stateWith(5, 'medium'), [ev.record('medium', 7)]);
    await s.onEvents('medium', stateWith(5, 'medium'), [ev.record('medium', 3)]);
    expect(p.submitHighestLevel).not.toHaveBeenCalled();
    expect(st.stored.records.medium).toBe(7);
    expect(s.getRecords().medium).toBe(7);
  });

  it('saves the balance after PickedBest and PerkBought', async () => {
    const st = fakeStorage();
    const s = createSession({ storage: st.storage, platform: fakePlatform().platform, seed: () => 1 });
    await s.init();
    await s.onEvents('easy', stateWith(70), [ev.best]);
    expect(st.stored.balance).toBe(70);
    await s.onEvents('easy', stateWith(20), [ev.perk]);
    expect(st.stored.balance).toBe(20);
    expect(s.getBalance()).toBe(20);
    expect(s.newGame('easy').state.balance).toBe(20);
  });

  it('does not save for events that cannot change balance or record', async () => {
    const st = fakeStorage();
    const s = createSession({ storage: st.storage, platform: fakePlatform().platform, seed: () => 1 });
    await s.init();
    await s.onEvents('easy', stateWith(0), [{ type: 'TimedOut' }, { type: 'DoorOpening' }]);
    expect(st.saves).toHaveLength(0);
  });

  it('ignores RunEnded, Paused and Resumed: no save, balance unchanged', async () => {
    const st = fakeStorage({ ...ZERO, balance: 40 });
    const s = createSession({ storage: st.storage, platform: fakePlatform().platform, seed: () => 1 });
    await s.init();
    await expect(
      s.onEvents('easy', stateWith(999), [{ type: 'Paused' }, { type: 'Resumed' }, { type: 'RunEnded' }]),
    ).resolves.toBeUndefined();
    expect(st.saves).toHaveLength(0);
    expect(s.getBalance()).toBe(40);
  });

  it('tolerates a rejected submit and keeps the local save', async () => {
    const st = fakeStorage();
    const p = fakePlatform(true);
    const s = createSession({ storage: st.storage, platform: p.platform, seed: () => 1 });
    await s.init();
    await expect(
      s.onEvents('hard', stateWith(15, 'hard'), [ev.best, ev.record('hard', 1)]),
    ).resolves.toBeUndefined();
    expect(p.submitHighestLevel).toHaveBeenCalledWith('hard', 1);
    expect(st.stored).toEqual({ balance: 15, records: { easy: 0, medium: 0, hard: 1 } });
    expect(s.newGame('hard').state.record).toBe(1);
  });

  it('tolerates a synchronously throwing submit', async () => {
    const st = fakeStorage();
    const platform: PlatformServices = {
      submitHighestLevel: () => {
        throw new Error('boom');
      },
    };
    const s = createSession({ storage: st.storage, platform, seed: () => 1 });
    await s.init();
    await expect(s.onEvents('easy', stateWith(0), [ev.record('easy', 2)])).resolves.toBeUndefined();
    expect(st.stored.records.easy).toBe(2);
  });

  it('serializes concurrent saves; the final saved state is the latest one', async () => {
    // The first save is the slowest: without a queue it would land last.
    const st = fakeStorage(ZERO, [30, 10, 0]);
    const s = createSession({ storage: st.storage, platform: fakePlatform().platform, seed: () => 1 });
    await s.init();
    await Promise.all([
      s.onEvents('easy', stateWith(10), [ev.best]),
      s.onEvents('easy', stateWith(20), [ev.best, ev.record('easy', 1)]),
      s.onEvents('easy', stateWith(30), [ev.best, ev.record('easy', 2)]),
    ]);
    expect(st.maxInFlight).toBe(1);
    expect(st.saves.map((x) => x.balance)).toEqual([10, 20, 30]);
    expect(st.stored).toEqual({ balance: 30, records: { easy: 2, medium: 0, hard: 0 } });
  });
});
