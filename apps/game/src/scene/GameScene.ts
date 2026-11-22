import Phaser from 'phaser';
import type { Board, Command, DynamicKind, Game, GameEvent, GameState, Slot } from '@pisuar/core';
import type { Session } from '../session';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { contains, hitIndex, urinalRects, type Rect } from './layout';
import { actualLoss, formatTime, levelLabel } from './format';
import { skipInfo } from './perkInfo';
import { playSound } from '../audio';
import { backAction } from '../backAction';
import { onAppHidden, onBackButton } from '../lifecycle';
import {
  containImage,
  drawDoor,
  drawForbidden,
  drawSlot,
  hasTexture,
  makeText,
  occupantLabel,
  occupantTextureKey,
  outlinedRect,
  PALETTE,
  stretchImage,
} from './placeholders';
import { shadowFor } from './eventView';
import { PauseOverlay } from './PauseOverlay';
import { SummaryOverlay } from './SummaryOverlay';
import { IMAGE_SIZES } from '../assets';
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

const FLOOR_H = IMAGE_SIZES.bg_floor!.h;
/** Pause button in the top-left corner of the HUD. */
const PAUSE_RECT: Rect = { x: 32, y: 32, w: 120, h: 120 };
/** Bottom-right corner, clear of the centred HUD/timer and the urinal row. */
const SKIP_RECT: Rect = { x: GAME_WIDTH - 32 - 460, y: GAME_HEIGHT - 32 - 110, w: 460, h: 110 };
/** Centred door, same 700:1100 proportion as the `door` art. */
const DOOR_RECT: Rect = { x: (GAME_WIDTH - 560) / 2, y: 150, w: 560, h: 880 };

export class GameScene extends Phaser.Scene {
  private run!: Game;
  private session!: Session;
  private rects: Rect[] = [];

  private board!: Phaser.GameObjects.Container;
  /** Telegraph markers by scheduled-event id; hidden together with the board. */
  private markerLayer!: Phaser.GameObjects.Container;
  private markers = new Map<number, Phaser.GameObjects.Container>();
  private highlights!: Phaser.GameObjects.Graphics;
  private door!: Phaser.GameObjects.Container;
  private skipBg!: Phaser.GameObjects.Graphics;
  private skipText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private summary!: SummaryOverlay;
  private pause!: PauseOverlay;
  private pauseBg!: Phaser.GameObjects.Graphics;
  private pauseText!: Phaser.GameObjects.Text;

  /** Ignore taps until this scene time (door animation in progress). */
  private inputLockedUntil = 0;
  private lastSkipEnabled: boolean | null = null;

  constructor() {
    super('GameScene');
  }

  /** Phaser reuses the scene instance across starts: reset per-run fields here. */
  init(data: GameSceneData): void {
    this.session = data.session;
    this.run = data.game;
    this.rects = [];
    this.markers = new Map();
    this.inputLockedUntil = 0;
    this.lastSkipEnabled = null;
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, PALETTE.background);
    if (hasTexture(this, 'bg_wall')) stretchImage(this, 'bg_wall', { x: 0, y: 0, w: width, h: height });
    else this.add.rectangle(width / 2, height * 0.5, width, height * 0.7, PALETTE.wall);
    if (hasTexture(this, 'bg_floor')) stretchImage(this, 'bg_floor', { x: 0, y: height - FLOOR_H, w: width, h: FLOOR_H });

    this.board = this.add.container(0, 0);
    this.markerLayer = this.add.container(0, 0);
    this.highlights = this.add.graphics();
    this.door = this.add.container(DOOR_RECT.x, DOOR_RECT.y);
    if (hasTexture(this, 'door')) {
      this.door.add(stretchImage(this, 'door', { x: 0, y: 0, w: DOOR_RECT.w, h: DOOR_RECT.h }));
      if (hasTexture(this, 'hand')) {
        this.door.add(
          this.add.image(DOOR_RECT.w * 0.8, DOOR_RECT.h * 0.5, 'hand').setDisplaySize(200, 200),
        );
      }
    } else {
      const doorG = this.add.graphics();
      drawDoor(doorG, DOOR_RECT.w, DOOR_RECT.h);
      this.door.add(doorG);
    }

    this.skipBg = this.add.graphics();
    this.skipText = makeText(this, SKIP_RECT.x + SKIP_RECT.w / 2, SKIP_RECT.y + SKIP_RECT.h / 2, 40);
    this.hudText = makeText(this, width - 40, 60, 52).setOrigin(1, 0.5);
    this.timerText = makeText(this, width / 2, 90, 100);
    this.message = makeText(this, width / 2, height - 90, 84).setAlpha(0);

    this.pauseBg = this.add.graphics();
    outlinedRect(this.pauseBg, PAUSE_RECT, PALETTE.button);
    this.pauseText = makeText(this, PAUSE_RECT.x + PAUSE_RECT.w / 2, PAUSE_RECT.y + PAUSE_RECT.h / 2, 64, 'II');
    this.pause = new PauseOverlay(this, {
      onResume: () => this.dispatch({ type: 'resume' }),
      onEndRun: () => this.dispatch({ type: 'endRun' }),
    });

    this.summary = new SummaryOverlay(this, {
      onContinue: () => this.dispatch({ type: 'buyPerk', perk: 'continue' }),
      onOk: () => {
        this.dispatch({ type: 'acknowledgeSummary' });
        this.toStart();
      },
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p.x, p.y));
    // Backgrounding the app discards the run (spec 5.4: "wyjście z poziomu =
    // świeża gra", no pause): page hidden in the browser, or Capacitor's
    // appStateChange on Android. Balance and records live in the session,
    // which already persisted them as the events happened.
    const offHidden = onAppHidden(() => this.toStart());
    const offBack = onBackButton(() => this.onBack());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offHidden();
      offBack();
    });

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
    if (this.pause.tap(x, y)) return;
    if (this.time.now < this.inputLockedUntil) return;
    const s = this.run.state;
    if (this.canPause(s) && contains(PAUSE_RECT, x, y)) {
      this.dispatch({ type: 'pause' });
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

  private canPause(s: Readonly<GameState>): boolean {
    return !s.paused && (s.phase === 'PLAYING' || s.phase === 'DOOR_CLOSED');
  }

  /** System "Wstecz": pause / resume / summary OK (exit lives on the start screen). */
  private onBack(): void {
    const s = this.run.state;
    const screen = s.phase === 'SUMMARY' ? 'summary' : 'play';
    // Same gate as the HUD pause button: no pause during the level result / door opening.
    if (screen === 'play' && !s.paused && !this.canPause(s)) return;
    switch (backAction(screen, s.paused)) {
      case 'pause':
        this.dispatch({ type: 'pause' });
        break;
      case 'resume':
        this.dispatch({ type: 'resume' });
        break;
      case 'summaryOk':
        if (this.summary.visible && this.time.now >= this.summary.lockedUntil) {
          this.dispatch({ type: 'acknowledgeSummary' });
          this.toStart();
        }
        break;
      default:
        break;
    }
  }

  /** Balance before the command being dispatched (for the real loss shown). */
  private balanceBefore = 0;

  private dispatch(cmd: Command): void {
    this.balanceBefore = this.run.state.balance;
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
          {
            const lost = actualLoss(this.balanceBefore, s.balance);
            this.say(lost > 0 ? `Źle! −${lost}` : 'Źle!', PALETTE.textBad);
          }
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
        case 'Telegraphed':
          this.addMarker(ev.id, ev.kind, ev.index);
          break;
        case 'Applied':
          this.removeMarker(ev.id);
          this.buildBoard(ev.board);
          this.flashApplied(ev.kind, ev.index);
          break;
        case 'Cancelled':
          this.removeMarker(ev.id);
          break;
        case 'Paused':
          this.setBoardVisible(false);
          this.pause.show(s);
          break;
        case 'Resumed':
          this.pause.hide();
          this.setBoardVisible(s.phase !== 'DOOR_CLOSED');
          break;
        case 'RunEnded':
          this.pause.hide();
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
    this.setBoardVisible(!closed && !s.paused);
    this.clearMarkers();
    for (const ev of s.pending) if (ev.telegraphed) this.addMarker(ev.id, ev.kind, ev.index);
    this.door.setScale(1, 1).setVisible(closed);
    if (s.phase === 'SUMMARY') this.summary.show(s);
    else this.summary.hide();
    if (s.paused) this.pause.show(s);
    else this.pause.hide();
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
    const floorKey = slot.floor !== 'clean' ? `floor_${slot.floor}` : '';
    const kind = slot.occupant?.kind;
    const personKey = kind ? occupantTextureKey(kind) : '';
    const oos = kind === 'outOfOrder';
    const baseKey = oos ? 'urinal_oos' : 'urinal';
    const art =
      hasTexture(this, baseKey) &&
      (floorKey === '' || hasTexture(this, floorKey)) &&
      (personKey === '' || hasTexture(this, personKey));
    if (!art) {
      drawSlot(g, r, slot);
      // `gap` already has its forbidden glyph drawn by `drawSlot` ('⊘' may be tofu).
      if (kind && kind !== 'gap') {
        const marker = makeText(this, r.x + r.w / 2, r.y + r.h * 0.35, Math.max(28, r.w * 0.6));
        marker.setText(occupantLabel(kind));
        this.board.add(marker);
      }
      return;
    }
    const floorH = Math.max(24, r.h * 0.12);
    const strip = { x: r.x - 4, y: r.y + r.h, w: r.w + 8, h: floorH };
    if (floorKey) this.board.add(stretchImage(this, floorKey, strip));
    else outlinedRect(g, strip, PALETTE.floor.clean, 6);
    this.board.add(containImage(this, baseKey, { x: r.x, y: r.y + r.h * 0.35, w: r.w, h: r.h * 0.65 }));
    if (kind === 'gap') {
      // A free-looking urinal with a trap-coloured 'forbidden' glyph (no SVG).
      const glyph = this.add.graphics();
      this.board.add(glyph);
      drawForbidden(glyph, r.x + r.w / 2, r.y + r.h * 0.6, r.w * 0.3);
    } else if (personKey && !oos) {
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
    const showPause = this.canPause(s);
    this.pauseBg.setVisible(showPause);
    this.pauseText.setVisible(showPause);
    if (this.summary.visible) this.summary.refresh(s);
  }

  // ---- animations ---------------------------------------------------------

  private openDoorAnim(): void {
    this.inputLockedUntil = this.time.now + DOOR_OPEN_MS;
    this.setBoardVisible(true);
    this.tweens.add({
      targets: this.door,
      scaleX: 0,
      duration: DOOR_OPEN_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.door.setVisible(false),
    });
  }

  private setBoardVisible(v: boolean): void {
    this.board.setVisible(v);
    this.markerLayer.setVisible(v);
  }

  /** Pulsing shadow + glyph over the slot the next change will touch. */
  private addMarker(id: number, kind: DynamicKind, index: number): void {
    const r = this.rects[index];
    if (!r || this.markers.has(id)) return;
    const { glyph, tint } = shadowFor(kind);
    const m = this.add.container(0, 0);
    if (hasTexture(this, 'shadow')) m.add(stretchImage(this, 'shadow', { x: r.x, y: r.y + r.h * 0.35, w: r.w, h: r.h * 0.65 }));
    else {
      const g = this.add.graphics();
      outlinedRect(g, { x: r.x, y: r.y + r.h * 0.35, w: r.w, h: r.h * 0.65 }, PALETTE.outline, r.w * 0.3);
      m.add(g);
    }
    m.add(makeText(this, r.x + r.w / 2, r.y + r.h * 0.12, Math.max(40, r.w * 1.1), glyph).setColor(`#${tint.toString(16).padStart(6, '0')}`));
    this.markerLayer.add(m);
    this.markers.set(id, m);
    this.tweens.add({ targets: m, alpha: 0.45, duration: 350, yoyo: true, repeat: -1 });
  }

  private removeMarker(id: number): void {
    const m = this.markers.get(id);
    if (!m) return;
    this.tweens.killTweensOf(m);
    m.destroy();
    this.markers.delete(id);
  }

  private clearMarkers(): void {
    for (const id of [...this.markers.keys()]) this.removeMarker(id);
  }

  /** Short flash on the changed slot (the cleaner for a mop, a white flash otherwise). */
  private flashApplied(kind: DynamicKind, index: number): void {
    const r = this.rects[index];
    if (!r) return;
    const key = kind === 'mop' ? 'cleaner' : kind === 'arrive' ? 'person_late' : '';
    const fx: Phaser.GameObjects.GameObject =
      key && hasTexture(this, key)
        ? containImage(this, key, { x: r.x + r.w * 0.1, y: r.y, w: r.w * 0.8, h: r.h * 0.75 })
        : this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0xffffff, 0.7);
    this.tweens.add({ targets: fx, alpha: 0, duration: 450, onComplete: () => fx.destroy() });
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
