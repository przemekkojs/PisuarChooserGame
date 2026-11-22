import Phaser from 'phaser';
import type { GameState } from '@pisuar/core';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { contains, type Rect } from './layout';
import { continueInfo } from './perkInfo';
import { summaryInfo } from './summaryInfo';
import { hasTexture, makeText, outlinedRect, PALETTE } from './placeholders';

/**
 * Ignore taps on the summary for this long after it opens, so the tap that
 * caused the timeout (an occupied urinal) cannot dismiss it. The "wetting"
 * animation runs in the same window.
 */
export const SUMMARY_LOCK_MS = 600;

const PANEL_W = 1100;
const PANEL_H = 540;
const PANEL_RECT: Rect = { x: (GAME_WIDTH - PANEL_W) / 2, y: GAME_HEIGHT - PANEL_H - 40, w: PANEL_W, h: PANEL_H };
const BTN_W = 460;
const BTN_H = 130;
const BTN_Y = PANEL_RECT.y + PANEL_H - BTN_H - 40;
const CONTINUE_RECT: Rect = { x: GAME_WIDTH / 2 - BTN_W - 20, y: BTN_Y, w: BTN_W, h: BTN_H };
const OK_RECT: Rect = { x: GAME_WIDTH / 2 + 20, y: BTN_Y, w: BTN_W, h: BTN_H };

export interface SummaryHandlers {
  onContinue(): void;
  onOk(): void;
}

/** Game-over overlay: "Zsikałeś się!" animation, then solved levels, record, Kontynuuj / OK. */
export class SummaryOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  /** Spreads over the pants: a stain rectangle (fallback) or the wet hero sprite. */
  private readonly stain: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  private readonly spreadsInY: boolean;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly solvedText: Phaser.GameObjects.Text;
  private readonly recordText: Phaser.GameObjects.Text;
  private readonly continueBg: Phaser.GameObjects.Graphics;
  private readonly continueText: Phaser.GameObjects.Text;
  private lockedAt = 0;
  /** Scene time until which taps are ignored. */
  get lockedUntil(): number {
    return this.lockedAt;
  }
  private continueEnabled = false;
  private lastContinueEnabled: boolean | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: SummaryHandlers,
  ) {
    const { width, height } = scene.scale;
    const add = scene.add;
    this.root = add.container(0, 0).setDepth(100).setVisible(false);
    this.root.add(add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75));
    this.titleText = makeText(scene, width / 2, 110, 100, 'Zsikałeś się!').setColor(PALETTE.textBad);
    this.root.add(this.titleText);

    const cx = width / 2;
    if (hasTexture(scene, 'hero') && hasTexture(scene, 'hero_wet')) {
      // Dry hero, then the wet one fades in over it while the lock runs.
      const k = 0.8;
      this.root.add(add.image(cx, 500, 'hero').setOrigin(0.5, 1).setScale(k));
      this.stain = add.image(cx, 500, 'hero_wet').setOrigin(0.5, 1).setScale(k);
      this.spreadsInY = false;
    } else {
      // Placeholder hero: head, shirt, pants; a wet stain spreads over the pants.
      const outline = <T extends Phaser.GameObjects.Shape>(r: T): T =>
        r.setStrokeStyle(6, PALETTE.outline) as T;
      this.root.add(outline(add.circle(cx, 230, 60, PALETTE.hand)));
      this.root.add(outline(add.rectangle(cx, 380, 200, 200, PALETTE.hero)));
      this.root.add(outline(add.rectangle(cx, 560, 200, 150, PALETTE.heroPants)));
      this.stain = add.rectangle(cx, 500, 110, 120, PALETTE.wet).setOrigin(0.5, 0);
      this.spreadsInY = true;
    }
    this.root.add(this.stain);

    this.panel = add.container(0, 0);
    const panelG = add.graphics();
    outlinedRect(panelG, PANEL_RECT, PALETTE.panel, 24);
    this.continueBg = add.graphics();
    const okG = add.graphics();
    outlinedRect(okG, OK_RECT, PALETTE.button);
    this.solvedText = makeText(scene, width / 2, PANEL_RECT.y + 90, 64);
    this.recordText = makeText(scene, width / 2, PANEL_RECT.y + 190, 56).setColor(PALETTE.textDim);
    this.continueText = makeText(scene, CONTINUE_RECT.x + BTN_W / 2, CONTINUE_RECT.y + BTN_H / 2, 44);
    const okText = makeText(scene, OK_RECT.x + BTN_W / 2, OK_RECT.y + BTN_H / 2, 64, 'OK');
    this.panel.add([panelG, this.solvedText, this.recordText, this.continueBg, this.continueText, okG, okText]);
    this.root.add(this.panel);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(s: Readonly<GameState>): void {
    this.scene.tweens.killTweensOf([this.stain, this.panel]);
    this.lockedAt = this.scene.time.now + SUMMARY_LOCK_MS;
    this.refresh(s);
    this.root.setVisible(true);
    this.panel.setAlpha(0);
    if (!summaryInfo(s).wet) {
      // Voluntary end of turn: no accident, so no stain / wet hero.
      this.stain.setAlpha(0);
    } else if (this.spreadsInY) {
      this.stain.setScale(1, 0).setAlpha(0.9);
      this.scene.tweens.add({ targets: this.stain, scaleY: 1, duration: SUMMARY_LOCK_MS, ease: 'Sine.easeOut' });
    } else {
      this.stain.setAlpha(0);
      this.scene.tweens.add({ targets: this.stain, alpha: 1, duration: SUMMARY_LOCK_MS, ease: 'Sine.easeOut' });
    }
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 1,
      delay: SUMMARY_LOCK_MS * 0.6,
      duration: SUMMARY_LOCK_MS * 0.4,
    });
  }

  hide(): void {
    this.scene.tweens.killTweensOf([this.stain, this.panel]);
    this.root.setVisible(false);
  }

  /** Texts and the Kontynuuj state from a state snapshot. */
  refresh(s: Readonly<GameState>): void {
    const info = continueInfo(s);
    const sum = summaryInfo(s);
    this.titleText.setText(sum.title).setColor(sum.wet ? PALETTE.textBad : PALETTE.text);
    this.continueEnabled = info.enabled;
    this.solvedText.setText(`Rozwiązane poziomy: ${s.playerLevel}`);
    this.recordText.setText(`Rekord: ${s.record}`);
    this.continueText.setText(info.label);
    // After a voluntary "Zakończ turę" there is no Kontynuuj at all.
    this.continueBg.setVisible(!s.endedByPlayer);
    this.continueText.setVisible(!s.endedByPlayer);
    if (info.enabled !== this.lastContinueEnabled) {
      this.lastContinueEnabled = info.enabled;
      this.continueText.setColor(info.enabled ? PALETTE.text : PALETTE.textDim);
      this.continueBg.clear();
      outlinedRect(this.continueBg, CONTINUE_RECT, info.enabled ? PALETTE.button : PALETTE.buttonDisabled);
    }
  }

  /** Handles a tap while visible; returns true when the overlay consumed it. */
  tap(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    if (this.scene.time.now < this.lockedAt) return true;
    if (contains(CONTINUE_RECT, x, y)) {
      if (this.continueEnabled) this.handlers.onContinue();
    } else if (contains(OK_RECT, x, y)) {
      this.handlers.onOk();
    }
    return true;
  }
}
