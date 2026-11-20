import type { Board, Slot } from '../src/types';

const TOKENS: Record<string, Slot> = {
  X: { kind: 'person', smelly: false },
  Z: { kind: 'person', smelly: true },
  _: { kind: 'free', floor: 'clean' },
  M: { kind: 'free', floor: 'wet' },
  S: { kind: 'free', floor: 'pee' },
};

export function parseBoard(s: string): Board {
  return s
    .trim()
    .split(/\s+/)
    .map((t) => {
      const slot = TOKENS[t];
      if (!slot) throw new Error(`Unknown board token: ${t}`);
      return { ...slot };
    });
}
