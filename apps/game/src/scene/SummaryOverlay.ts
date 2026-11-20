import Phaser from 'phaser';
import type { GameState } from '@pisuar/core';
import { contains, type Rect } from './layout';
import { continueInfo } from './perkInfo';
import { makeText, outlinedRect, PALETTE } from './placeholders';

/**
 * Ignore taps on the summary for this long after it opens, so the tap that
 * caused the timeout (an occupied urinal) cannot dismiss it. The "wetting"
 * animation runs in the same window.
 */
export const SUMMARY_LOCK_MS = 600;

const CONTINUE_RECT: Rect = { x: 190, y: 1300, w: 700, h: 150 };
const OK_RECT: Rect = { x: 190, y: 1500, w: 700, h: 150 };
const PANEL_RECT: Rect = { x: 140, y: 1000, w: 800, h: 720 };

export interface SummaryHandlers {
  onContinue(): void;
  onOk(): void;
}

/** Game-over overlay: "Zsikałeś się!" animation, then solved levels, record, Kontynuuj / OK. */
export class SummaryOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly pants: Phaser.GameObjects.Rectangle;
  private readonly stain: Phaser.GameObjects.Rectangle;
  private readonly solvedText: Phaser.GameObjects.Text;
  private readonly recordText: Phaser.GameObjects.Text;
  private readonly continueBg: Phaser.GameObjects.Graphics;
  private readonly continueText: Phaser.GameObjects.Text;
  private lockedUntil = 0;
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
    this.root.add(makeText(scene, width / 2, 240, 110, 'Zsikałeś się!').setColor(PALETTE.textBad));

    // Placeholder hero: head, shirt, pants; a wet stain spreads over the pants.
    const cx = width / 2;
    const outline = <T extends Phaser.GameObjects.Shape>(r: T): T =>
      r.setStrokeStyle(6, PALETTE.outline) as T;
    this.root.add(outline(add.circle(cx, 430, 80, PALETTE.hand)));
    this.root.add(outline(add.rectangle(cx, 640, 260, 280, PALETTE.hero)));
    this.pants = outline(add.rectangle(cx, 880, 260, 200, PALETTE.heroPants));
    this.root.add(this.pants);
    this.stain = add.rectangle(cx, 800, 150, 170, PALETTE.wet).setOrigin(0.5, 0);
    this.root.add(this.stain);

    this.panel = add.container(0, 0);
    const panelG = add.graphics();
    outlinedRect(panelG, PANEL_RECT, PALETTE.panel, 24);
    this.continueBg = add.graphics();
    const okG = add.graphics();
    outlinedRect(okG, OK_RECT, PALETTE.button);
    this.solvedText = makeText(scene, width / 2, 1100, 64);
    this.recordText = makeText(scene, width / 2, 1190, 56).setColor(PALETTE.textDim);
    this.continueText = makeText(scene, width / 2, CONTINUE_RECT.y + CONTINUE_RECT.h / 2, 60);
    const okText = makeText(scene, width / 2, OK_RECT.y + OK_RECT.h / 2, 64, 'OK');
    this.panel.add([panelG, this.solvedText, this.recordText, this.continueBg, this.continueText, okG, okText]);
    this.root.add(this.panel);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(s: Readonly<GameState>): void {
    this.scene.tweens.killTweensOf([this.stain, this.panel]);
    this.lockedUntil = this.scene.time.now + SUMMARY_LOCK_MS;
    this.refresh(s);
    this.root.setVisible(true);
    this.stain.setScale(1, 0).setAlpha(0.9);
    this.panel.setAlpha(0);
    this.scene.tweens.add({ targets: this.stain, scaleY: 1, duration: SUMMARY_LOCK_MS, ease: 'Sine.easeOut' });
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
    this.continueEnabled = info.enabled;
    this.solvedText.setText(`Rozwiązane poziomy: ${s.playerLevel}`);
    this.recordText.setText(`Rekord: ${s.record}`);
    this.continueText.setText(info.label);
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
    if (this.scene.time.now < this.lockedUntil) return true;
    if (contains(CONTINUE_RECT, x, y)) {
      if (this.continueEnabled) this.handlers.onContinue();
    } else if (contains(OK_RECT, x, y)) {
      this.handlers.onOk();
    }
    return true;
  }
}
