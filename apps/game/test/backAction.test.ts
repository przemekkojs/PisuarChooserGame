import { describe, expect, it } from 'vitest';
import { backAction } from '../src/backAction';

describe('backAction', () => {
  it('maps screen and pause state', () => {
    expect(backAction('play', false)).toBe('pause');
    expect(backAction('play', true)).toBe('resume');
    expect(backAction('summary', false)).toBe('summaryOk');
    expect(backAction('start', false)).toBe('exit');
  });
});
