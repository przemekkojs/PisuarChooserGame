import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { OccupantKind } from '@pisuar/core';
import { ASSET_MANIFEST, IMAGE_SIZES } from '../src/assets';
import { occupantColor, occupantLabel } from '../src/scene/placeholders';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const assetsMd = readFileSync(fileURLToPath(new URL('../../../assets/ASSETS.md', import.meta.url)), 'utf8');

describe('asset manifest', () => {
  it('has all required keys', () => {
    expect(Object.keys(ASSET_MANIFEST.images).sort()).toEqual(
      [
        'bg_floor', 'bg_wall', 'door', 'floor_pee', 'floor_wet', 'hand', 'hero', 'hero_wet', 'person',
        'person_child', 'person_parent', 'person_shy', 'person_smelly', 'person_splasher', 'urinal', 'urinal_oos',
      ],
    );
    expect(Object.keys(ASSET_MANIFEST.sounds).sort()).toEqual(
      ['door_open', 'perk', 'pick_bad', 'pick_good', 'pick_occupied', 'tick', 'timeout'],
    );
  });

  it('uses relative paths only', () => {
    for (const p of [...Object.values(ASSET_MANIFEST.images), ...Object.values(ASSET_MANIFEST.sounds)]) {
      expect(p.startsWith('/')).toBe(false);
    }
  });

  for (const [key, path] of Object.entries(ASSET_MANIFEST.images)) {
    it(`image ${key} exists and is a well-formed SVG`, () => {
      const file = resolve(publicDir, path);
      expect(existsSync(file)).toBe(true);
      const text = readFileSync(file, 'utf8').trim();
      expect(text.startsWith('<svg')).toBe(true);
      expect(text).toContain('viewBox');
      expect(text.endsWith('</svg>')).toBe(true);
      // Duplicate attributes on one tag make the XML invalid (browsers refuse the image).
      for (const tag of text.match(/<[a-zA-Z][^>]*>/g) ?? []) {
        const names = [...tag.matchAll(/\s([a-zA-Z:-]+)="/g)].map((m) => m[1]);
        expect(new Set(names).size, tag).toBe(names.length);
      }
    });
  }

  for (const [key, path] of Object.entries(ASSET_MANIFEST.images)) {
    it(`IMAGE_SIZES for ${key} matches the SVG viewBox`, () => {
      const text = readFileSync(resolve(publicDir, path), 'utf8');
      const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(text);
      expect(vb).not.toBeNull();
      expect(IMAGE_SIZES[key]).toEqual({ w: Number(vb![1]), h: Number(vb![2]) });
    });
  }

  it('has a 1920x1080 wall and a 1920x380 floor', () => {
    expect(IMAGE_SIZES.bg_wall).toEqual({ w: 1920, h: 1080 });
    expect(IMAGE_SIZES.bg_floor).toEqual({ w: 1920, h: 380 });
  });

  for (const [key, path] of Object.entries(ASSET_MANIFEST.sounds)) {
    it(`sound ${key} exists and is a valid WAV`, () => {
      const file = resolve(publicDir, path);
      expect(existsSync(file)).toBe(true);
      const b = readFileSync(file);
      expect(b.toString('ascii', 0, 4)).toBe('RIFF');
      expect(b.toString('ascii', 8, 12)).toBe('WAVE');
      expect(b.toString('ascii', 12, 16)).toBe('fmt ');
      expect(b.toString('ascii', 36, 40)).toBe('data');
      const dataLen = b.readUInt32LE(40);
      expect(dataLen).toBeGreaterThan(0);
      expect(b.length).toBe(44 + dataLen);
    });
  }

  it('documents every key in assets/ASSETS.md', () => {
    for (const key of [...Object.keys(ASSET_MANIFEST.images), ...Object.keys(ASSET_MANIFEST.sounds)]) {
      expect(assetsMd).toContain('`' + key + '`');
    }
  });
});

describe('occupant placeholders', () => {
  const kinds: OccupantKind[] = ['plain', 'smelly', 'parent', 'child', 'gap', 'shy', 'splasher', 'outOfOrder'];
  it('gives every kind a non-empty label and a distinct colour', () => {
    for (const k of kinds) expect(occupantLabel(k).length).toBeGreaterThan(0);
    expect(new Set(kinds.map(occupantLabel)).size).toBe(kinds.length);
    expect(new Set(kinds.map(occupantColor)).size).toBe(kinds.length);
  });
  it('parent and child differ from plain and smelly', () => {
    for (const k of ['parent', 'child'] as const) {
      expect([occupantColor('plain'), occupantColor('smelly')]).not.toContain(occupantColor(k));
    }
  });
});
