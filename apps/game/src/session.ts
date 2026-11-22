import {
  createGame,
  type Difficulty,
  type Game,
  type GameEvent,
  type GameState,
} from '@pisuar/core';
import type { Saved, Storage } from './storage';
import type { PlatformServices } from './ports';

/**
 * Glue between a run (core `Game`) and persistence/platform. Phaser-free so it
 * can be unit-tested. Only the balance and per-difficulty records are saved
 * (spec 5.4/5.6); a run itself is never persisted.
 */
export interface Session {
  /** Loads the saved balance and records. */
  init(): Promise<void>;
  /** A fresh run on `d`, already started (DOOR_CLOSED). */
  newGame(d: Difficulty): Game;
  /**
   * Reacts to one batch of events of a run on `d`; `state` is the run's state
   * after those events. The in-memory copy is updated synchronously; the
   * returned promise settles when this batch's save (and submit) is done.
   * Never rejects.
   */
  onEvents(d: Difficulty, state: Readonly<GameState>, events: GameEvent[]): Promise<void>;
  getBalance(): number;
  getRecords(): Record<Difficulty, number>;
}

export interface SessionDeps {
  storage: Storage;
  platform: PlatformServices;
  seed: () => number;
}

/** Events after which the balance may differ from the saved one. */
const BALANCE_EVENTS = new Set<GameEvent['type']>(['PickedBest', 'PickedWorse', 'PerkBought']);

export function createSession(deps: SessionDeps): Session {
  let saved: Saved = { balance: 0, records: { easy: 0, medium: 0, hard: 0 } };
  /** Tail of the write queue: saves run one at a time, in call order. */
  let queue: Promise<void> = Promise.resolve();

  const snapshot = (): Saved => ({ balance: saved.balance, records: { ...saved.records } });

  function enqueueSave(): Promise<void> {
    const data = snapshot();
    queue = queue
      .then(() => deps.storage.save(data))
      .catch(() => {
        // storage already swallows errors; this keeps the queue alive regardless
      });
    return queue;
  }

  async function submit(d: Difficulty, level: number): Promise<void> {
    try {
      await deps.platform.submitHighestLevel(d, level);
    } catch {
      // leaderboard is best-effort; the local record is already saved
    }
  }

  return {
    async init() {
      saved = await deps.storage.load();
    },

    newGame(d) {
      const game = createGame({ seed: deps.seed(), balance: saved.balance, records: { ...saved.records } });
      game.dispatch({ type: 'startGame', difficulty: d });
      return game;
    },

    onEvents(d, state, events) {
      let dirty = false;
      let recordLevel: number | null = null;
      for (const ev of events) {
        if (BALANCE_EVENTS.has(ev.type)) dirty = true;
        if (ev.type === 'NewRecord' && ev.level > saved.records[d]) {
          saved.records[d] = ev.level;
          recordLevel = ev.level;
          dirty = true;
        }
      }
      if (!dirty) return Promise.resolve();
      saved.balance = Math.max(0, state.balance);
      const work = [enqueueSave()];
      if (recordLevel !== null) work.push(submit(d, recordLevel));
      return Promise.all(work).then(() => undefined);
    },

    getBalance: () => saved.balance,
    getRecords: () => ({ ...saved.records }),
  };
}
