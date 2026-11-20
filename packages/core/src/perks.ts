import { PERK_BASE } from './config';

export type PerkType = 'skip' | 'continue';

/** Price doubles with each use of the perk. */
export function perkPrice(type: PerkType, uses: number): number {
  return PERK_BASE[type] * 2 ** uses;
}
