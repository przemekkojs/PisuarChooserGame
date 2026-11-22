import type { Difficulty, GameState } from '@pisuar/core';
import { formatTime } from './format';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Łatwy',
  medium: 'Średni',
  hard: 'Trudny',
};

/** Pause-menu info rows (pure, no Phaser). */
export function pauseLines(s: Readonly<GameState>): string[] {
  return [
    `Trudność: ${DIFFICULTY_LABEL[s.difficulty]}`,
    `Poziom: ${s.playerLevel + 1}`,
    `Punkty: ${s.balance}`,
    `Rekord: ${s.record}`,
    `Pozostały czas: ${formatTime(s.timeLeftMs)} s`,
    `Pominięcia: ${s.perkUses.skip}`,
    `Kontynuacje: ${s.perkUses.continue}`,
  ];
}
