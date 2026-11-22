import { describe, it, expect } from 'vitest';
import { VERSION } from '../src';

describe('smoke', () => {
  it('exports VERSION', () => expect(VERSION).toBe('0.1.0'));
});
