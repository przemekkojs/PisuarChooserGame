import { LEVELS } from './config';
import type { DynamicKind, LevelParams } from './difficulty';
import { isValidBoard } from './generator';
import type { Rng } from './rng';
import type { Board } from './types';

/** A planned board change, timed from the door opening (elapsed = levelTimeMs - timeLeftMs). */
export interface ScheduledEvent {
  id: number;
  kind: DynamicKind;
  /** Target slot. */
  index: number;
  telegraphAtMs: number;
  applyAtMs: number;
  /** True once the Telegraphed event has been emitted. */
  telegraphed: boolean;
}

/** How long the telegraph precedes the change. */
export const TELEGRAPH_MS = 1500;

const STEP_MS = 100;
const EPSILON = 1e-9;

export const copyBoard = (b: Board): Board => b.map((s) => ({ ...s, occupant: s.occupant && { ...s.occupant } }));

/** Slots the kind may target on this board (empty = cannot be planned). */
function targets(board: Board, kind: DynamicKind): number[] {
  switch (kind) {
    case 'mop':
      return board.flatMap((s, i) => (!s.occupant && s.floor === 'clean' ? [i] : []));
    case 'arrive':
    case 'leave':
      return []; // Task 10.
  }
}

/**
 * A 100 ms multiple inside the kind's window, >= TELEGRAPH_MS and >= minApplyMs.
 * A first event on a very short level is clamped up to TELEGRAPH_MS; a later
 * one that cannot fit its window is dropped (null).
 */
function drawApplyAtMs(kind: DynamicKind, levelTimeMs: number, minApplyMs: number, rng: Rng): number | null {
  const [lo, hi] = LEVELS.dynamic.windows[kind];
  const loStep = Math.ceil(Math.max(lo * levelTimeMs, TELEGRAPH_MS, minApplyMs) / STEP_MS - EPSILON);
  const hiStep = Math.floor((hi * levelTimeMs) / STEP_MS + EPSILON);
  if (hiStep < loStep) return minApplyMs > 0 ? null : loStep * STEP_MS;
  return rng.int(loStep, hiStep) * STEP_MS;
}

/**
 * Plans the level's dynamic events (sorted by applyAtMs). Each of up to
 * `params.dynamicMax` events occurs with LEVELS.dynamic.chance and uses a kind
 * not used yet; a second one is telegraphed >= TELEGRAPH_MS after the first.
 * Consumes no randomness when no kind is unlocked.
 */
export function planEvents(
  board: Board,
  params: LevelParams,
  levelTimeMs: number,
  rng: Rng,
  nextId: () => number,
): ScheduledEvent[] {
  if (params.dynamic.length === 0) return [];
  const events: ScheduledEvent[] = [];
  for (let n = 0; n < params.dynamicMax; n++) {
    if (rng.next() >= LEVELS.dynamic.chance) continue;
    const kinds = params.dynamic.filter((k) => !events.some((e) => e.kind === k));
    if (kinds.length === 0) break;
    const kind = kinds[rng.int(0, kinds.length - 1)]!;
    const pool = targets(board, kind).filter((i) => !events.some((e) => e.index === i));
    if (pool.length === 0) continue;
    const prev = events[events.length - 1];
    const applyAtMs = drawApplyAtMs(kind, levelTimeMs, prev ? prev.applyAtMs + TELEGRAPH_MS : 0, rng);
    if (applyAtMs === null) continue;
    const index = pool[rng.int(0, pool.length - 1)]!;
    events.push({ id: nextId(), kind, index, telegraphAtMs: applyAtMs - TELEGRAPH_MS, applyAtMs, telegraphed: false });
  }
  return events;
}

/** Returns a new board, or null when the change is impossible or would invalidate the board (-> Cancelled). */
export function applyEvent(board: Board, ev: ScheduledEvent, rng: Rng): Board | null {
  const slot = board[ev.index];
  if (!slot) return null;
  const next = copyBoard(board);
  switch (ev.kind) {
    case 'mop':
      if (slot.occupant || slot.floor !== 'clean') return null;
      next[ev.index]!.floor = 'wet';
      break;
    case 'arrive':
    case 'leave':
      return null; // Task 10 (arrive draws smelly vs plain from rng).
  }
  return isValidBoard(next) ? next : null;
}
