import { describe, expect, it } from 'vitest';
import { formatTime, levelLabel } from '../src/scene/format';

describe('formatTime', () => {
  it('shows seconds with one decimal', () => {
    expect(formatTime(12300)).toBe('12.3');
    expect(formatTime(15000)).toBe('15.0');
    expect(formatTime(100)).toBe('0.1');
    expect(formatTime(0)).toBe('0.0');
  });

  it('clamps negatives to 0.0', () => {
    expect(formatTime(-500)).toBe('0.0');
  });

  it('truncates sub-100 ms rather than rounding up', () => {
    expect(formatTime(12399)).toBe('12.3');
  });
});

describe('levelLabel', () => {
  it('shows the level the player is attempting (solved + 1)', () => {
    expect(levelLabel(0)).toBe('1');
    expect(levelLabel(9)).toBe('10');
  });
});
