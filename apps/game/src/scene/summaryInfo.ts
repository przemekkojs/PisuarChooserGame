import type { GameState } from '@pisuar/core';

/** Pure summary-overlay presentation (no Phaser): timeout wets the hero, a voluntary end does not. */
export function summaryInfo(s: Readonly<GameState>): { title: string; wet: boolean } {
  return s.endedByPlayer ? { title: 'Koniec tury', wet: false } : { title: 'Zsikałeś się!', wet: true };
}
