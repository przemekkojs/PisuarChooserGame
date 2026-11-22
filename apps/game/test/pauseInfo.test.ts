import { describe, expect, it } from 'vitest';
import { createGame, type Difficulty } from '@pisuar/core';
import { pauseLines } from '../src/scene/pauseInfo';

function state(d: Difficulty) {
  const g = createGame({ seed: 5, balance: 0, records: { easy: 7, medium: 8, hard: 9 } });
  g.dispatch({ type: 'startGame', difficulty: d });
  g.dispatch({ type: 'openDoor' });
  g.dispatch({ type: 'tick', dtMs: 2340 });
  return { ...g.state, balance: 42, playerLevel: 3, perkUses: { skip: 2, continue: 1 } };
}

describe('pauseLines', () => {
  it('lists difficulty (Polish), level, points, record, time left and perk uses', () => {
    const s = state('medium');
    const lines = pauseLines(s);
    expect(lines).toContain('Trudność: Średni');
    expect(lines).toContain('Poziom: 4');
    expect(lines).toContain('Punkty: 42');
    expect(lines).toContain(`Rekord: ${s.record}`);
    expect(lines.some((l) => l.startsWith('Pozostały czas: ') && l.endsWith(' s'))).toBe(true);
    expect(lines).toContain('Pominięcia: 2');
    expect(lines).toContain('Kontynuacje: 1');
  });
  it('maps all difficulties', () => {
    expect(pauseLines(state('easy'))[0]).toBe('Trudność: Łatwy');
    expect(pauseLines(state('hard'))[0]).toBe('Trudność: Trudny');
  });
  it('formats time with one decimal', () => {
    const s = { ...state('easy'), timeLeftMs: 12345 };
    expect(pauseLines(s)).toContain('Pozostały czas: 12.3 s');
  });
});
