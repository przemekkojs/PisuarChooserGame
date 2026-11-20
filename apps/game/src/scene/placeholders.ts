import type Phaser from 'phaser';
import type { Slot } from '@pisuar/core';
import type { Rect } from './layout';

/** The single placeholder palette (cartoon style: flat fills + thick outlines). */
export const PALETTE = {
  background: 0x1b2030,
  wall: 0x2c3550,
  outline: 0x0b0d12,
  door: 0x8a5a2b,
  doorPanel: 0xa06a36,
  hand: 0xf1c27d,
  urinal: 0xeef2f5,
  floor: { clean: 0x9fb3c8, wet: 0x3d8fd6, pee: 0xe3c21b },
  person: 0x6b4fa0,
  smelly: 0x4f8a2b,
  best: 0x2ecc71,
  wrong: 0xe74c3c,
  button: 0x34495e,
  buttonDisabled: 0x555a60,
  text: '#ffffff',
  textDim: '#9aa3ad',
  textGood: '#2ecc71',
  textBad: '#ff5c5c',
} as const;

export const OUTLINE_PX = 6;

/** Rounded rectangle with the palette outline. */
export function outlinedRect(
  g: Phaser.GameObjects.Graphics,
  r: Rect,
  fill: number,
  radius = 12,
): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(r.x, r.y, r.w, r.h, radius);
  g.lineStyle(OUTLINE_PX, PALETTE.outline, 1);
  g.strokeRoundedRect(r.x, r.y, r.w, r.h, radius);
}

/**
 * One board slot: a floor strip under the urinal, the urinal bowl, and for an
 * occupied slot a person block (smelly persons get a different colour; the
 * scene adds the text marker).
 */
export function drawSlot(g: Phaser.GameObjects.Graphics, r: Rect, slot: Slot): void {
  const floorH = Math.max(24, r.h * 0.12);
  const floorFill = slot.kind === 'free' ? PALETTE.floor[slot.floor] : PALETTE.floor.clean;
  outlinedRect(g, { x: r.x - 4, y: r.y + r.h, w: r.w + 8, h: floorH }, floorFill, 6);
  outlinedRect(g, { x: r.x, y: r.y + r.h * 0.35, w: r.w, h: r.h * 0.65 }, PALETTE.urinal, r.w * 0.3);
  if (slot.kind === 'person') {
    const fill = slot.smelly ? PALETTE.smelly : PALETTE.person;
    outlinedRect(g, { x: r.x + r.w * 0.1, y: r.y, w: r.w * 0.8, h: r.h * 0.75 }, fill, r.w * 0.2);
  }
}

/**
 * The closed door drawn at local origin (0,0) so a container placed at its
 * left edge can be scaled on X to "swing" it open.
 */
export function drawDoor(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  outlinedRect(g, { x: 0, y: 0, w, h }, PALETTE.door, 16);
  const pad = w * 0.1;
  const panelH = (h - pad * 3) / 2;
  outlinedRect(g, { x: pad, y: pad, w: w - 2 * pad, h: panelH }, PALETTE.doorPanel, 10);
  outlinedRect(g, { x: pad, y: pad * 2 + panelH, w: w - 2 * pad, h: panelH }, PALETTE.doorPanel, 10);
  // Hand (a palm + fingers) near the handle side, hinting "tap to open".
  const hx = w * 0.8;
  const hy = h * 0.5;
  g.fillStyle(PALETTE.hand, 1);
  g.lineStyle(OUTLINE_PX, PALETTE.outline, 1);
  g.fillCircle(hx, hy, 56);
  g.strokeCircle(hx, hy, 56);
  for (let i = 0; i < 4; i++) {
    const f = { x: hx - 54 + i * 28, y: hy - 130, w: 24, h: 90 };
    outlinedRect(g, f, PALETTE.hand, 12);
  }
}
