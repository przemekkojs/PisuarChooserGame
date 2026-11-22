import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '@pisuar/core';
import { summaryInfo } from '../src/scene/summaryInfo';

function base(): GameState {
  const g = createGame({ seed: 3, balance: 0, records: { easy: 0, medium: 0, hard: 0 } });
  g.dispatch({ type: 'startGame', difficulty: 'easy' });
  return { ...g.state };
}

describe('summaryInfo', () => {
  it('timeout keeps the wetting title and stain animation', () => {
    expect(summaryInfo({ ...base(), phase: 'SUMMARY', endedByPlayer: false })).toEqual({
      title: 'Zsikałeś się!',
      wet: true,
    });
  });
  it('voluntary end of turn shows a neutral title and no stain', () => {
    expect(summaryInfo({ ...base(), phase: 'SUMMARY', endedByPlayer: true })).toEqual({
      title: 'Koniec tury',
      wet: false,
    });
  });
});
