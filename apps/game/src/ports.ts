import type { Difficulty } from '@pisuar/core';

export interface PlatformServices {
  submitHighestLevel(d: Difficulty, level: number): Promise<void>;
}

export const noopPlatform: PlatformServices = {
  submitHighestLevel: () => Promise.resolve(),
};
