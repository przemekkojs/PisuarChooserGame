import { describe, it, expect } from 'vitest';
import { perkPrice } from '../src/perks';

describe('perkPrice', () => {
  it('doubles per use', () => {
    expect([0, 1, 2, 3].map((u) => perkPrice('skip', u))).toEqual([10, 20, 40, 80]);
    expect([0, 1, 2].map((u) => perkPrice('continue', u))).toEqual([15, 30, 60]);
  });
});
