import Phaser from 'phaser';
import type { Board, Command, Game, GameEvent, GameState, Slot } from '@pisuar/core';
import type { Session } from '../session';
import { contains, hitIndex, urinalRects, type Rect } from './layout';
import { formatTime, levelLabel } from './format';
import { skipInfo } from './perkInfo';
import { playSound } from '../audio';
import {
  containImage,
  drawDoor,
  drawSlot,
  hasTexture,
  makeText,
  outlinedRect,
  PALETTE,
  stretchImage,
} from './placeholders';
import { SummaryOverlay } from './SummaryOverlay';
import type { StartSceneData } from './StartScene';

export interface GameSceneData {
  session: Session;
  /** A fresh run already in DOOR_CLOSED (from `session.newGame`). */
  game: Game;
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

const SKIP_RECT: Rect = { x: 32, y: 40, w: 440, h: 110 };
const DOOR_RECT: Rect = { x: 140, y: 360, w: 800, h: 1240 };

export class GameScene extends Phaser.Scene {
  private run!: Game;
  private session!: Session;
  private rects: Rect[] = [];

  private board!: Phaser.GameObjects.Container;
  private highlights!: Phaser.GameObjects.Graphics;
  private door!: Phaser.GameObjects.Container;
  private skipBg!: Phaser.GameObjects.Graphics;
  private skipText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private summary!: SummaryOverlay;

  /** Ignore taps until this scene time (door animation in progress). */
  private inputLockedUntil = 0;
  private lastSkipEnabled: boolean | null = null;
  private onVisibility = (): void => {
    // Backgrounding the app discards the run (spec 5.4: "wyjście z poziomu =
    // świeża gra", no pause). Balance and records live in the session, which
    // already persisted them as the events happened.
    if (document.visibilityState === 'hidden') this.toStart();
  };

  constructor() {
    super('GameScene');
  }

  /** Phaser reuses the scene instance across starts: reset per-run fields here. */
  init(data: GameSceneData): void {
    this.session = data.session;
    this.run = data.game;
    this.rects = [];
    this.inputLockedUntil = 0;
    this.lastSkipEnabled = null;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.background);
    if (hasTexture(this, 'bg_wall')) stretchImage(this, 'bg_wall', { x: 0, y: 0, w: width, h: height });
    else this.add.rectangle(width / 2, height * 0.5, width, height * 0.7, PALETTE.wall);
    if (hasTexture(this, 'bg_floor')) stretchImage(this, 'bg_floor', { x: 0, y: height - 640, w: width, h: 640 });

    this.board = this.add.container(0, 0);
    this.highlights = this.add.graphics();
    this.door = this.add.container(DOOR_RECT.x, DOOR_RECT.y);
    if (hasTexture(this, 'door')) {
      this.door.add(stretchImage(this, 'door', { x: 0, y: 0, w: DOOR_RECT.w, h: DOOR_RECT.h }));
      if (hasTexture(this, 'hand')) {
        this.door.add(
          this.add.image(DOOR_RECT.w * 0.8, DOOR_RECT.h * 0.5, 'hand').setDisplaySize(260, 260),
        );
      }
    } else {
      const doorG = this.add.graphics();
      drawDoor(doorG, DOOR_RECT.w, DOOR_RECT.h);
      this.door.add(doorG);
    }

    this.skipBg = this.add.graphics();
    this.skipText = makeText(this, SKIP_RECT.x + SKIP_RECT.w / 2, SKIP_RECT.y + SKIP_RECT.h / 2, 40);
    this.hudText = makeText(this, width - 40, 95, 52).setOrigin(1, 0.5);
    this.timerText = makeText(this, width / 2, 250, 120);
    this.message = makeText(this, width / 2, 1720, 84).setAlpha(0);

    this.summary = new SummaryOverlay(this, {
      onContinue: () => this.dispatch({ type: 'buyPerk', perk: 'continue' }),
      onOk: () => {
        this.dispatch({ type: 'acknowledgeSummary' });
        this.toStart();
      },
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y));
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      document.removeEventListener('visibilitychange', this.onVisibility),
    );

    this.syncFromState();
  }

  update(_time: number, delta: number): void {
    // `tick` is a no-op outside PLAYING; the state is read once per frame.
    const events = this.run.dispatch({ type: 'tick', dtMs: Math.min(delta, MAX_TICK_MS) });
    const s = this.run.state;
    if (events.length > 0) this.afterEvents(s, events);
    else if (s.phase === 'PLAYING') this.refreshHud(s);
  }

  // ---- input -------------------------------------------------------------

  private onTap(x: number, y: number): void {
    if (this.summary.tap(x, y)) return;
    if (this.time.now < this.inputLockedUntil) return;
    const s = this.run.state;
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

  private dispatch(cmd: Command): void {
    const events = this.run.dispatch(cmd);
    this.afterEvents(this.run.state, events);
  }

  /** Persist (async, never throws), update the view, refresh the HUD. */
  private afterEvents(s: Readonly<GameState>, events: GameEvent[]): void {
    if (events.length > 0) void this.session.onEvents(s.difficulty, s, events);
    this.handle(s, events);
    this.refreshHud(s);
  }

  // ---- events → view -----------------------------------------------------

  private handle(s: Readonly<GameState>, events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'LevelStarted':
          this.syncFromState(s);
          break;
        case 'DoorOpening':
          playSound(this, 'door_open');
          this.openDoorAnim();
          break;
        case 'PickedBest':
          playSound(this, 'pick_good');
          this.cameras.main.flash(200, 46, 204, 113);
          this.say('Dobrze!', PALETTE.textGood);
          this.showResult(ev.best);
          break;
        case 'PickedWorse':
          playSound(this, 'pick_bad');
          this.say(`Źle! −${ev.lost}`, PALETTE.textBad);
          this.showResult(ev.best);
          break;
        case 'PickedOccupied':
          playSound(this, 'pick_occupied');
          this.cameras.main.shake(200, 0.012);
          this.floatText(this.rects[ev.index], `−${formatTime(ev.penaltyMs)} s`);
          this.flashTimer();
          break;
        case 'TimedOut':
          playSound(this, 'timeout');
          this.message.setAlpha(0);
          this.summary.show(s);
          break;
        case 'PerkBought':
          playSound(this, 'perk');
          this.say(`−${ev.price}`, PALETTE.textDim);
          break;
        case 'NewRecord':
          // Shown in the summary ("Rekord: N"); a mid-run banner can come later.
          break;
        default:
          // PerkRejected: buttons are greyed out when unaffordable.
          break;
      }
    }
  }

  /** Full rebuild of the view from a state snapshot (new level / new run). */
  private syncFromState(s: Readonly<GameState> = this.run.state): void {
    const closed = s.phase === 'DOOR_CLOSED';
    this.tweens.killTweensOf([this.door, this.timerText]);
    this.inputLockedUntil = 0;
    this.buildBoard(s.board);
    this.highlights.clear();
    // The board stays hidden behind the closed door: the clock is stopped
    // then, so peeking would let the player think for free.
    this.board.setVisible(!closed);
    this.door.setScale(1, 1).setVisible(closed);
    if (s.phase === 'SUMMARY') this.summary.show(s);
    else this.summary.hide();
    this.timerText.setColor(PALETTE.text).setScale(1);
    this.refreshHud(s);
  }

  private buildBoard(board: Board): void {
    const { width, height } = this.scale;
    this.board.removeAll(true);
    this.rects = urinalRects(board.length, width, height);
    const g = this.add.graphics();
    this.board.add(g);
    board.forEach((slot, i) => this.drawSlotView(g, this.rects[i]!, slot));
  }

  /** One slot from textures where they exist, else the placeholder shapes. */
  private drawSlotView(g: Phaser.GameObjects.Graphics, r: Rect, slot: Slot): void {
    const floorKey = slot.kind === 'free' && slot.floor !== 'clean' ? `floor_${slot.floor}` : '';
    const personKey = slot.kind === 'person' ? (slot.smelly ? 'person_smelly' : 'person') : '';
    const art =
      hasTexture(this, 'urinal') &&
      (floorKey === '' || hasTexture(this, floorKey)) &&
      (personKey === '' || hasTexture(this, personKey));
    if (!art) {
      drawSlot(g, r, slot);
      if (slot.kind === 'person') {
        const marker = makeText(this, r.x + r.w / 2, r.y + r.h * 0.35, Math.max(28, r.w * 0.6));
        marker.setText(slot.smelly ? 'X~' : 'X');
        this.board.add(marker);
      }
      return;
    }
    const floorH = Math.max(24, r.h * 0.12);
    const strip = { x: r.x - 4, y: r.y + r.h, w: r.w + 8, h: floorH };
    if (floorKey) this.board.add(stretchImage(this, floorKey, strip));
    else outlinedRect(g, strip, PALETTE.floor.clean, 6);
    this.board.add(containImage(this, 'urinal', { x: r.x, y: r.y + r.h * 0.35, w: r.w, h: r.h * 0.65 }));
    if (personKey) {
      this.board.add(containImage(this, personKey, { x: r.x + r.w * 0.1, y: r.y, w: r.w * 0.8, h: r.h * 0.75 }));
    }
  }

  private refreshHud(s: Readonly<GameState>): void {
    // Text.setText is a no-op for an unchanged string; colours/graphics are cached.
    this.hudText.setText(`${levelLabel(s.playerLevel)} | ${s.balance}`);
    this.timerText.setText(formatTime(s.timeLeftMs));
    const skip = skipInfo(s);
    this.skipText.setText(skip.label);
    if (skip.enabled !== this.lastSkipEnabled) {
      this.lastSkipEnabled = skip.enabled;
      this.skipText.setColor(skip.enabled ? PALETTE.text : PALETTE.textDim);
      this.skipBg.clear();
      outlinedRect(this.skipBg, SKIP_RECT, skip.enabled ? PALETTE.button : PALETTE.buttonDisabled);
    }
    if (this.summary.visible) this.summary.refresh(s);
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
    this.tweens.killTweensOf(this.message);
    this.message.setText(msg).setColor(color).setAlpha(1);
    this.tweens.add({ targets: this.message, alpha: 0, delay: 700, duration: 400 });
  }

  private floatText(r: Rect | undefined, msg: string): void {
    const x = r ? r.x + r.w / 2 : this.scale.width / 2;
    const y = r ? r.y - 40 : this.scale.height / 2;
    const t = makeText(this, x, y, 64, msg).setColor(PALETTE.textBad);
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

  /** Leave the run for the start screen (fresh game next time). */
  private toStart(): void {
    const data: StartSceneData = { session: this.session };
    this.scene.start('StartScene', data);
  }
}
