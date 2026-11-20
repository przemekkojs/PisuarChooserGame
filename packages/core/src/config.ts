import type { CostWeights } from './types';

export const DEFAULT_WEIGHTS: CostWeights = {
  floor: { clean: 0, wet: 1, pee: 3 },
  smellyMultiplier: 3,
  decayBase: 0.5,
};
