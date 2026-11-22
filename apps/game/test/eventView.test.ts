import { describe, expect, it } from 'vitest';
import type { DynamicKind } from '@pisuar/core';
import { shadowFor } from '../src/scene/eventView';

describe('shadowFor', () => {
  const kinds: DynamicKind[] = ['mop', 'arrive', 'leave'];
  it('gives every dynamic kind a non-empty glyph', () => {
    for (const k of kinds) expect(shadowFor(k).glyph.length).toBeGreaterThan(0);
  });
  it('uses distinct glyphs and tints per kind', () => {
    expect(new Set(kinds.map((k) => shadowFor(k).glyph)).size).toBe(kinds.length);
    expect(new Set(kinds.map((k) => shadowFor(k).tint)).size).toBe(kinds.length);
  });
});
