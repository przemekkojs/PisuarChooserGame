import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/game';

// Generated boards always keep >= 3 free slots at levels with events, so the
// invalidating case is forced: applyEvent behaves as when an `arrive` would
// take one of exactly two free slots (it returns null, see events.test.ts).
vi.mock('../src/events', async (orig) => ({
  ...(await orig<typeof import('../src/events')>()),
  applyEvent: () => null,
}));

const { createGame } = await import('../src/game');

describe('state machine: Cancelled', () => {
  it('a null applyEvent emits Cancelled, keeps the board and clears pending', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g: Game = createGame({ seed, balance: 1e12, records: { easy: 0, medium: 0, hard: 0 } });
      g.dispatch({ type: 'startGame', difficulty: 'hard' });
      while (g.state.difficultyLevel < 24) g.dispatch({ type: 'skipLevel' });
      g.dispatch({ type: 'openDoor' });
      const ev = g.state.pending[0];
      if (!ev) continue;
      const before = g.state.board;
      expect(g.dispatch({ type: 'tick', dtMs: ev.telegraphAtMs }).map((e) => e.type)).toEqual(['Telegraphed']);
      const evs = g.dispatch({ type: 'tick', dtMs: ev.applyAtMs - ev.telegraphAtMs });
      expect(evs).toEqual([{ type: 'Cancelled', id: ev.id }]);
      expect(g.state.board).toEqual(before);
      expect(g.state.pending).toEqual([]);
      return;
    }
    throw new Error('no seed with an event');
  });
});
