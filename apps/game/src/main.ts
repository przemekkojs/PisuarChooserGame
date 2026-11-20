import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { noopPlatform } from './ports';
import { createSession } from './session';
import { createStorage, localStorageBackend } from './storage';
import { GameScene } from './scene/GameScene';
import { StartScene, type StartSceneData } from './scene/StartScene';

/**
 * Boot: load the saved balance/records, then always show the start screen
 * (spec 5.4: a run is never saved). Date.now() is fine here (apps/game); core
 * stays deterministic via the seed.
 */
async function boot(): Promise<void> {
  const session = createSession({
    storage: createStorage(localStorageBackend()),
    platform: noopPlatform,
    seed: () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) & 0x7fffffff,
  });
  await session.init();

  const phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0b0d12',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });

  const data: StartSceneData = { session };
  phaser.scene.add('GameScene', GameScene, false);
  phaser.scene.add('StartScene', StartScene, true, data);}

void boot();
