import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x1b2030);
    this.add
      .text(width / 2, height / 2, 'Pisuar Chooser', {
        fontFamily: 'sans-serif',
        fontSize: '96px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }
}
