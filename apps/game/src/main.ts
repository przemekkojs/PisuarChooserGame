import Phaser from 'phaser';
import { createGame, type Game } from '@pisuar/core';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { GameScene, type GameSceneData } from './scene/GameScene';

/**
 * Task 8: a fresh run on a fixed difficulty. Task 9 replaces this with the
 * start screen, persisted balance/records and difficulty choice.
 * Date.now() is fine here (apps/game); core stays deterministic via the seed.
 */
function newRun(balance: number): Game {
  const game = createGame({
    seed: Date.now() & 0x7fffffff,
    balance,
    records: { easy: 0, medium: 0, hard: 0 },
  });
  game.dispatch({ type: 'startGame', difficulty: 'easy' });
  return game;
}

const phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0d12',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});

const data: GameSceneData = { newRun };
phaser.scene.add('GameScene', GameScene, true, data);
