/ src/scenes/MainMenu.ts
// Главное меню игры

import { Scene } from 'phaser';
import { progressManager } from '../managers/ProgressManager';
import { settingsManager } from '../managers/SettingsManager';
import { saveManager } from '../managers/SaveManager';

export class MainMenu extends Scene {
  private versionText: Phaser.GameObjects.Text;
  private clickCount: number = 0;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Градиентный фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);

    // Звёзды
    for (let i = 0; i < 100; i++) {
      const star = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 2 + 1,
        0xffffff,
        0.3 + Math.random() * 0.5
      );
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }

    // Логотип
    const logo = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: logo,
      scale: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Кнопки
    const buttonStyle = {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    };

    const newGameBtn = this.add.text(width / 2, height / 2, 'NEW GAME', buttonStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    newGameBtn.on('pointerdown', () => this.newGame());

    const continueBtn = this.add.text(width / 2, height / 2 + 60, 'CONTINUE', buttonStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    continueBtn.on('pointerdown', () => this.continueGame());

    const statsBtn = this.add.text(width / 2, height / 2 + 120, 'STATISTICS', buttonStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    statsBtn.on('pointerdown', () => this.scene.start('Stats'));

    const settingsBtn = this.add.text(width / 2, height / 2 + 180, 'SETTINGS', buttonStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerdown', () => this.scene.start('Settings'));

    // Версия и разработчик (кликабельно для dev-режима)
    this.versionText = this.add.text(width - 20, height - 20, 'v0.6.0-alpha', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(1, 1);
    this.versionText.setInteractive({ useHandCursor: true });
    this.versionText.on('pointerdown', () => this.onVersionClick());
  }

  private newGame(): void {
    if (confirm('Начать новую игру? Весь прогресс будет сброшен.')) {
      progressManager.resetAll();
      saveManager.resetAllData();
      this.scene.start('LevelSelect', { worldId: 'meadow', levelNum: 1 });
    }
  }

  private continueGame(): void {
    const session = saveManager.loadSessionState();
    if (session && session.currentWorldId && session.currentLevelId) {
      const levelNum = parseInt(session.currentLevelId.split('_')[1], 10);
      this.scene.start('LevelSelect', { worldId: session.currentWorldId, levelNum });
    } else {
      this.scene.start('LevelSelect', { worldId: 'meadow', levelNum: 1 });
    }
  }

  private onVersionClick(): void {
    this.clickCount++;
    if (this.clickCount >= 5) {
      settingsManager.set('developerMode', true);
      this.versionText.setColor('#ffcc00');
      this.clickCount = 0;
    }
  }
}
