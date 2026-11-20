import { perkPrice, type GameState } from '@pisuar/core';

/** Pure perk-button state (no Phaser) so it can be unit-tested. */

/** "Pomiń poziom (cena)" label + whether the player can use it now. */
export function skipInfo(s: Readonly<GameState>): { label: string; enabled: boolean } {
  const price = perkPrice('skip', s.perkUses.skip);
  const usable = s.phase === 'DOOR_CLOSED' || s.phase === 'PLAYING';
  return { label: `Pomiń poziom (${price})`, enabled: usable && s.balance >= price };
}

/** "Kontynuuj (cena)" label in the summary + whether the player can afford it. */
export function continueInfo(s: Readonly<GameState>): {
  label: string;
  price: number;
  enabled: boolean;
} {
  const price = perkPrice('continue', s.perkUses.continue);
  return {
    label: `Kontynuuj (${price})`,
    price,
    enabled: s.phase === 'SUMMARY' && s.balance >= price,
  };
}
