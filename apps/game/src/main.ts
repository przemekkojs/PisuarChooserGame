import Phaser from 'phaser';
import { GameScene } from './GameScene';

export const GAME_WIDTH = 1080;
export const GAME_HEIGHT = 1920;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0d12',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene],
});
