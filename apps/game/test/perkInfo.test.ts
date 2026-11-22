import { describe, expect, it } from 'vitest';
import { createGame, perkPrice, type GameState } from '@pisuar/core';
import { continueInfo, skipInfo } from '../src/scene/perkInfo';

function base(): GameState {
  const g = createGame({ seed: 3, balance: 0, records: { easy: 0, medium: 0, hard: 0 } });
  g.dispatch({ type: 'startGame', difficulty: 'easy' });
  return { ...g.state };
}

describe('skipInfo', () => {
  it('label carries the current price; enabled only when affordable in DOOR_CLOSED/PLAYING', () => {
    const price = perkPrice('skip', 1);
    const s = { ...base(), perkUses: { skip: 1, continue: 0 }, balance: price };
    expect(skipInfo(s)).toEqual({ label: `Pomiń poziom (${price})`, enabled: true });
    expect(skipInfo({ ...s, balance: price - 1 }).enabled).toBe(false);
    expect(skipInfo({ ...s, phase: 'PLAYING' }).enabled).toBe(true);
    expect(skipInfo({ ...s, phase: 'SUMMARY' }).enabled).toBe(false);
    expect(skipInfo({ ...s, phase: 'LEVEL_RESULT' }).enabled).toBe(false);
  });
});

describe('continueInfo', () => {
  it('label carries the doubling price; enabled only in SUMMARY when affordable', () => {
    const p0 = perkPrice('continue', 0);
    const p2 = perkPrice('continue', 2);
    const s = { ...base(), phase: 'SUMMARY' as const, balance: p0 };
    expect(continueInfo(s)).toEqual({ label: `Kontynuuj (${p0})`, price: p0, enabled: true });
    expect(continueInfo({ ...s, balance: p0 - 1 }).enabled).toBe(false);
    expect(continueInfo({ ...s, phase: 'PLAYING' }).enabled).toBe(false);
    expect(continueInfo({ ...s, endedByPlayer: true }).enabled).toBe(false);
    const used = { ...s, perkUses: { skip: 0, continue: 2 }, balance: p2 - 1 };
    expect(continueInfo(used)).toEqual({ label: `Kontynuuj (${p2})`, price: p2, enabled: false });
  });
});
