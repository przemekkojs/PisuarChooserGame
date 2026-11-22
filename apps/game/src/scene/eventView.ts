import type { DynamicKind } from '@pisuar/core';

/** Look of a telegraph marker: a glyph on the shadow tinted per event kind (pure). */
export function shadowFor(kind: DynamicKind): { glyph: string; tint: number } {
  switch (kind) {
    case 'mop': return { glyph: '~', tint: 0x3d8fd6 };
    case 'arrive': return { glyph: '+', tint: 0xe3a21b };
    case 'leave': return { glyph: '-', tint: 0xff6b6b };
  }
}
