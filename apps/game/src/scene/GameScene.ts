import Phaser from 'phaser';
import { perkPrice, type Board, type Game, type GameEvent, type GameState } from '@pisuar/core';
import { contains, hitIndex, urinalRects, type Rect } from './layout';
import { formatTime, levelLabel } from './format';
import { drawDoor, drawSlot, outlinedRect, PALETTE } from './placeholders';

export interface GameSceneData {
  /** Creates a fresh run already in DOOR_CLOSED (Task 9 replaces the caller). */
  newRun(balance: number): Game;
}

/**
 * Kept ≤ 300 ms on purpose: the core starts the level clock at `openDoor`, so
 * the opening animation eats a little of the player's time. We accept that
 * rather than delaying `openDoor` (which would let taps land on a closed door).
 */
const DOOR_OPEN_MS = 250;
/** How long correct urinals stay highlighted before `nextLevel`. */
const RESULT_SHOW_MS = 1000;
/** Largest frame delta passed to `tick` (a long stall must not eat the timer). */
const MAX_TICK_MS = 100;
/** Extra vertical tap area above/below the urinal row. */
const HIT_PAD_Y = 220;

const FONT = 'sans-serif';
const SKIP_RECT: Rect = { x: 32, y: 40, w: 440, h: 110 };
const DOOR_RECT: Rect = { x: 140, y: 360, w: 800, h: 1240 };

/** "Pomiń poziom (cena)" label + whether the player can afford it. */
function skipInfo(s: Readonly<GameState>): { label: string; enabled: boolean } {
  const price = perkPrice('skip', s.perkUses.skip);
  const usable = s.phase === 'DOOR_CLOSED' || s.phase === 'PLAYING';
  return { label: `Pomiń poziom (${price})`, enabled: usable && s.balance >= price };
}

export class GameScene extends Phaser.Scene {
  private run!: Game;
  private newRun!: GameSceneData['newRun'];
  private rects: Rect[] = [];

  private board!: Phaser.GameObjects.Container;
  private highlights!: Phaser.GameObjects.Graphics;
  private door!: Phaser.GameObjects.Container;
  private skipBg!: Phaser.GameObjects.Graphics;
  private skipText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private summary!: Phaser.GameObjects.Container;

  /** Ignore taps until this scene time (door animation in progress). */
  private inputLockedUntil = 0;
  private lastSkipEnabled: boolean | null = null;
  private onVisibility = (): void => {
    // Backgrounding the app discards the run (spec 5.4: "wyjście z poziomu =
    // świeża gra", no pause). The balance survives; the run (level, perk
    // prices) does not. Task 9 also persists balance/records on this path.
    if (document.visibilityState === 'hidden') this.resetRun();
  };

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.newRun = data.newRun;
    this.run = data.newRun(0);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.background);
    this.add.rectangle(width / 2, height * 0.5, width, height * 0.7, PALETTE.wall);

    this.board = this.add.container(0, 0);
    this.highlights = this.add.graphics();
    this.door = this.add.container(DOOR_RECT.x, DOOR_RECT.y);
    const doorG = this.add.graphics();
    drawDoor(doorG, DOOR_RECT.w, DOOR_RECT.h);
    this.door.add(doorG);

    this.skipBg = this.add.graphics();
    this.skipText = this.text(SKIP_RECT.x + SKIP_RECT.w / 2, SKIP_RECT.y + SKIP_RECT.h / 2, 40);
    this.hudText = this.text(width - 40, 95, 52).setOrigin(1, 0.5);
    this.timerText = this.text(width / 2, 250, 120);
    this.message = this.text(width / 2, 1720, 84);

    this.summary = this.add.container(0, 0).setVisible(false);
    this.summary.add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7));
    this.summary.add(this.text(width / 2, height / 2, 96).setText('Koniec — tap'));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y));
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      document.removeEventListener('visibilitychange', this.onVisibility),
    );

    this.syncFromState();
  }

  update(_time: number, delta: number): void {
    if (this.run.state.phase !== 'PLAYING') return;
    this.handle(this.run.dispatch({ type: 'tick', dtMs: Math.min(delta, MAX_TICK_MS) }));
    this.refreshHud();
  }

  // ---- input -------------------------------------------------------------

  private onTap(x: number, y: number): void {
    if (this.time.now < this.inputLockedUntil) return;
    const s = this.run.state;
    if (s.phase === 'SUMMARY') {
      // Placeholder until Task 9's summary overlay (Kontynuuj / OK).
      this.dispatch({ type: 'acknowledgeSummary' });
      this.dispatch({ type: 'startGame', difficulty: 'easy' });
      return;
    }
    if ((s.phase === 'DOOR_CLOSED' || s.phase === 'PLAYING') && contains(SKIP_RECT, x, y)) {
      if (skipInfo(s).enabled) this.dispatch({ type: 'skipLevel' });
      return;
    }
    if (s.phase === 'DOOR_CLOSED') {
      this.dispatch({ type: 'openDoor' });
      return;
    }
    if (s.phase === 'PLAYING') {
      const i = hitIndex(this.rects, x, y, HIT_PAD_Y);
      if (i >= 0) this.dispatch({ type: 'pickUrinal', index: i });
    }
  }

  private dispatch(cmd: Parameters<Game['dispatch']>[0]): void {
    this.handle(this.run.dispatch(cmd));
    this.refreshHud();
  }

  // ---- events → view -----------------------------------------------------

  private handle(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'LevelStarted':
          this.syncFromState();
          break;
        case 'DoorOpening':
          this.openDoorAnim();
          break;
        case 'PickedBest':
          this.cameras.main.flash(200, 46, 204, 113);
          this.say('Dobrze!', PALETTE.textGood);
          this.showResult(ev.best);
          break;
        case 'PickedWorse':
          this.say(`Źle! −${ev.lost}`, PALETTE.textBad);
          this.showResult(ev.best);
          break;
        case 'PickedOccupied':
          this.cameras.main.shake(200, 0.012);
          this.floatText(this.rects[ev.index], `−${formatTime(ev.penaltyMs)} s`);
          this.flashTimer();
          break;
        case 'TimedOut':
          this.say('Czas minął!', PALETTE.textBad);
          this.summary.setVisible(true);
          break;
        case 'PerkBought':
          this.say(`−${ev.price}`, PALETTE.textDim);
          break;
        default:
          // NewRecord / PerkRejected: UI for these comes with Task 9.
          break;
      }
    }
  }

  /** Full rebuild of the view from a state snapshot (new level / new run). */
  private syncFromState(): void {
    const s = this.run.state;
    const closed = s.phase === 'DOOR_CLOSED';
    this.tweens.killTweensOf([this.door, this.timerText]);
    this.inputLockedUntil = 0;
    this.buildBoard(s.board);
    this.highlights.clear();
    // The board stays hidden behind the closed door: the clock is stopped
    // then, so peeking would let the player think for free.
    this.board.setVisible(!closed);
    this.door.setScale(1, 1).setVisible(closed);
    this.summary.setVisible(s.phase === 'SUMMARY');
    this.timerText.setColor(PALETTE.text).setScale(1);
    this.refreshHud();
  }

  private buildBoard(board: Board): void {
    const { width, height } = this.scale;
    this.board.removeAll(true);
    this.rects = urinalRects(board.length, width, height);
    const g = this.add.graphics();
    this.board.add(g);
    board.forEach((slot, i) => {
      const r = this.rects[i]!;
      drawSlot(g, r, slot);
      if (slot.kind === 'person') {
        const marker = this.text(r.x + r.w / 2, r.y + r.h * 0.35, Math.max(28, r.w * 0.6));
        marker.setText(slot.smelly ? 'X~' : 'X');
        this.board.add(marker);
      }
    });
  }

  private refreshHud(): void {
    const s = this.run.state;
    this.hudText.setText(`${levelLabel(s.playerLevel)} | ${s.balance}`);
    this.timerText.setText(formatTime(s.timeLeftMs));
    const skip = skipInfo(s);
    this.skipText.setText(skip.label).setColor(skip.enabled ? PALETTE.text : PALETTE.textDim);
    if (skip.enabled !== this.lastSkipEnabled) {
      this.lastSkipEnabled = skip.enabled;
      this.skipBg.clear();
      outlinedRect(this.skipBg, SKIP_RECT, skip.enabled ? PALETTE.button : PALETTE.buttonDisabled);
    }
  }

  // ---- animations ---------------------------------------------------------

  private openDoorAnim(): void {
    this.inputLockedUntil = this.time.now + DOOR_OPEN_MS;
    this.board.setVisible(true);
    this.tweens.add({
      targets: this.door,
      scaleX: 0,
      duration: DOOR_OPEN_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.door.setVisible(false),
    });
  }

  /** Highlight the best urinals for a moment, then go to the next level. */
  private showResult(best: number[]): void {
    this.highlights.clear();
    this.highlights.lineStyle(14, PALETTE.best, 1);
    for (const i of best) {
      const r = this.rects[i];
      if (r) this.highlights.strokeRoundedRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24, 16);
    }
    this.time.delayedCall(RESULT_SHOW_MS, () => this.dispatch({ type: 'nextLevel' }));
  }

  private say(msg: string, color: string): void {
    this.message.setText(msg).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.message, alpha: 0, delay: 700, duration: 400 });
  }

  private floatText(r: Rect | undefined, msg: string): void {
    const x = r ? r.x + r.w / 2 : this.scale.width / 2;
    const y = r ? r.y - 40 : this.scale.height / 2;
    const t = this.text(x, y, 64).setText(msg).setColor(PALETTE.textBad);
    this.tweens.add({
      targets: t,
      y: y - 140,
      alpha: 0,
      duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  private flashTimer(): void {
    this.timerText.setColor(PALETTE.textBad);
    this.tweens.add({ targets: this.timerText, scale: 1.25, duration: 120, yoyo: true });
    this.time.delayedCall(400, () => this.timerText.setColor(PALETTE.text));
  }

  // ---- misc -----------------------------------------------------------------

  private resetRun(): void {
    this.time.removeAllEvents(); // drop a pending nextLevel of the old run
    this.run = this.newRun(this.run.state.balance);
    this.message.setAlpha(0);
    this.syncFromState();
  }

  private text(x: number, y: number, size: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, '', { fontFamily: FONT, fontSize: `${Math.round(size)}px`, color: PALETTE.text })
      .setOrigin(0.5)
      .setStroke('#0b0d12', Math.max(4, Math.round(size / 10)));
  }
}
