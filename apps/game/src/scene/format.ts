/** Pure text formatting helpers for the HUD. */

/** Milliseconds → seconds with one decimal ("12.3"); negatives clamp to "0.0". */
export function formatTime(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100));
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** The level the player is attempting: solved levels + 1. */
export function levelLabel(playerLevel: number): string {
  return String(playerLevel + 1);
}

/** Balance actually lost between two readings (never negative). */
export function actualLoss(before: number, after: number): number {
  return Math.max(0, before - after);
}
