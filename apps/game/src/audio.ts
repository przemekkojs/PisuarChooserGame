import type Phaser from 'phaser';

/** Global mute flag (no settings UI yet; default: sound on). */
let muted = false;
export function setMuted(value: boolean): void {
  muted = value;
}
export function isMuted(): boolean {
  return muted;
}

/** Plays a preloaded sound; never throws (missing/undecodable audio is silent). */
export function playSound(scene: Phaser.Scene, key: string): void {
  if (muted) return;
  try {
    if (!scene.cache.audio.exists(key)) return;
    scene.sound.play(key);
  } catch {
    // Audio is optional polish; ignore any failure (locked context, no device).
  }
}
