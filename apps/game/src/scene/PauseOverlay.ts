import Phaser from 'phaser';
import type { GameState } from '@pisuar/core';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { contains, type Rect } from './layout';
import { pauseLines } from './pauseInfo';
import { makeText, outlinedRect, PALETTE } from './placeholders';

/** Ignore taps this long after opening (the tap on the pause button must not hit a button). */
export const PAUSE_LOCK_MS = 300;

const BTN_W = 520;
const BTN_H = 130;
const BTN_Y = GAME_HEIGHT - 130 - BTN_H;
const RESUME_RECT: Rect = { x: GAME_WIDTH / 2 - BTN_W - 30, y: BTN_Y, w: BTN_W, h: BTN_H };
const END_RECT: Rect = { x: GAME_WIDTH / 2 + 30, y: BTN_Y, w: BTN_W, h: BTN_H };

export interface PauseHandlers {
  onResume(): void;
  onEndRun(): void;
}

/**
 * Pause menu. The background is fully opaque on purpose: the board must not
 * be studied while the clock is stopped.
 */
export class PauseOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly info: Phaser.GameObjects.Text;
  private lockedUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {
    const { width, height } = scene.scale;
    const add = scene.add;
    this.root = add.container(0, 0).setDepth(90).setVisible(false);
    this.root.add(add.rectangle(width / 2, height / 2, width, height, PALETTE.background, 1));
    this.root.add(makeText(scene, width / 2, 120, 110, 'Pauza'));
    this.info = makeText(scene, width / 2, 490, 50).setLineSpacing(12);
    this.root.add(this.info);
    const g = add.graphics();
    outlinedRect(g, RESUME_RECT, PALETTE.button);
    outlinedRect(g, END_RECT, PALETTE.button);
    this.root.add(g);
    this.root.add(makeText(scene, RESUME_RECT.x + BTN_W / 2, RESUME_RECT.y + BTN_H / 2, 56, 'Wznów'));
    this.root.add(makeText(scene, END_RECT.x + BTN_W / 2, END_RECT.y + BTN_H / 2, 56, 'Zakończ turę'));
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(s: Readonly<GameState>): void {
    this.lockedUntil = this.scene.time.now + PAUSE_LOCK_MS;
    this.info.setText(pauseLines(s).join('\n'));
    this.root.setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }

  /** Handles a tap while visible; returns true when the overlay consumed it. */
  tap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (this.scene.time.now < this.lockedUntil) return true;
    if (contains(RESUME_RECT, x, y)) this.handlers.onResume();
    else if (contains(END_RECT, x, y)) this.handlers.onEndRun();
    return true;
  }
}
