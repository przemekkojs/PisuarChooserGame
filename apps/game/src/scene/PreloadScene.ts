import Phaser from 'phaser';
import { ASSET_MANIFEST, IMAGE_SIZES } from '../assets';
import { makeText } from './placeholders';
import type { StartSceneData } from './StartScene';

/**
 * Loads every asset from the manifest, then shows the start screen. Load
 * errors are non-fatal: scenes fall back to placeholder shapes / silence.
 */
export class PreloadScene extends Phaser.Scene {
  private data0!: StartSceneData;

  constructor() {
    super('PreloadScene');
  }

  init(data: StartSceneData): void {
    this.data0 = data;
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = makeText(this, width / 2, height / 2, 56, 'Ładowanie…');
    this.load.on('progress', (p: number) => label.setText(`Ładowanie… ${Math.round(p * 100)}%`));
    this.load.on('loaderror', (f: { key: string }) => console.warn(`asset failed to load: ${f.key}`));
    for (const [key, path] of Object.entries(ASSET_MANIFEST.images)) {
      const size = IMAGE_SIZES[key];
      if (size) this.load.svg(key, path, { width: size.w, height: size.h });
      else this.load.svg(key, path);
    }
    for (const [key, path] of Object.entries(ASSET_MANIFEST.sounds)) this.load.audio(key, path);
  }

  create(): void {
    this.scene.start('StartScene', this.data0);
  }
}
