import Phaser from 'phaser';
import type { Difficulty } from '@pisuar/core';
import type { Session } from '../session';
import { contains, type Rect } from './layout';
import { makeText, outlinedRect, PALETTE } from './placeholders';
import type { GameSceneData } from './GameScene';
import { App } from '@capacitor/app';
import { backAction } from '../backAction';
import { onBackButton } from '../lifecycle';

export interface StartSceneData {
  session: Session;
}

const BUTTONS: { d: Difficulty; label: string; rect: Rect }[] = [
  { d: 'easy', label: 'Łatwy', rect: { x: 100, y: 620, w: 520, h: 260 } },
  { d: 'medium', label: 'Średni', rect: { x: 700, y: 620, w: 520, h: 260 } },
  { d: 'hard', label: 'Trudny', rect: { x: 1300, y: 620, w: 520, h: 260 } },
];

/** Ignore taps briefly so the tap that left the previous screen cannot start a run. */
const START_LOCK_MS = 300;

/**
 * Start screen: difficulty choice with each difficulty's record and the
 * balance. Always shown on launch and after a run (spec 5.4: no mid-run save).
 */
export class StartScene extends Phaser.Scene {
  private session!: Session;
  private lockedUntil = 0;

  constructor() {
    super('StartScene');
  }

  init(data: StartSceneData): void {
    this.session = data.session;
  }

  create(): void {
    const { width, height } = this.scale;
    // Read fresh from the session on every visit (records/balance may have changed).
    const records = this.session.getRecords();
    this.lockedUntil = this.time.now + START_LOCK_MS;

    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.background);
    makeText(this, width / 2, 200, 120, 'Pisuar Chooser');
    makeText(this, width / 2, 360, 56, `Punkty: ${this.session.getBalance()}`).setColor(PALETTE.textDim);
    makeText(this, width / 2, 500, 64, 'Wybierz trudność');

    const g = this.add.graphics();
    for (const b of BUTTONS) {
      outlinedRect(g, b.rect, PALETTE.button, 20);
      const cx = b.rect.x + b.rect.w / 2;
      makeText(this, cx, b.rect.y + 95, 80, b.label);
      makeText(this, cx, b.rect.y + 195, 48, `Rekord: ${records[b.d]}`).setColor(PALETTE.textDim);
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y));
    const offBack = onBackButton(() => {
      if (backAction('start', false) === 'exit') void App.exitApp();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offBack);
  }

  private onTap(x: number, y: number): void {
    if (this.time.now < this.lockedUntil) return;
    const b = BUTTONS.find((btn) => contains(btn.rect, x, y));
    if (!b) return;
    const data: GameSceneData = { session: this.session, game: this.session.newGame(b.d) };
    this.scene.start('GameScene', data);
  }
}
