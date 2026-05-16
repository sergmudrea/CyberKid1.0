// src/scenes/SandboxScene.ts
// Эйдо: Сцена-хост для редактора уровней SandboxMaker.
// Отображает редактор, позволяет тестировать уровень (запуск GameScene с тестовым уровнем),
// сохранять уровень в localStorage, публиковать в Arcade (локально), возвращаться в главное меню.

import { Scene } from 'phaser';
import { SandboxMaker } from '../modules/SandboxMaker';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';

export class SandboxScene extends Scene {
  private sandboxMaker: SandboxMaker | null = null;
  private isTestMode: boolean = false;
  private lang: 'ru' | 'en' = 'en';

  constructor() {
    super('SandboxScene');
  }

  create(): void {
    this.lang = settingsManager.get().language;
    this.createBackground();
    this.createHeader();
    // Уничтожаем старый экземпляр, если он существует (на случай повторного входа без полного сброса)
    if (this.sandboxMaker) {
      this.sandboxMaker.destroy();
      this.sandboxMaker = null;
    }
    this.sandboxMaker = new SandboxMaker();
    this.sandboxMaker.show();
    this.setupEventListeners();
    this.createBackButton();
    this.events.once('shutdown', () => this.cleanup());
  }

  private createBackground(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);
  }

  private createHeader(): void {
    const width = this.cameras.main.width;
    const title = this.add.text(width / 2, 40, '🏗️ SANDBOX MAKER', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }

  private createBackButton(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const backText = this.lang === 'ru' ? '← НАЗАД' : '← BACK';
    const backBtn = this.add.text(50, height - 40, backText, {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MainMenu'));
    backBtn.on('pointerover', () => backBtn.setColor('#00ffcc'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
  }

  private setupEventListeners(): void {
    eventBus.on('SANDBOX_LEVEL_SAVED', this.onLevelSaved.bind(this));
  }

  private onLevelSaved(payload: any): void {
    if (payload && payload.levelData) {
      this.isTestMode = true;
      sessionStorage.setItem('test_level', JSON.stringify(payload.levelData));
      this.scene.start('GameScene', { levelId: 'test_level' });
    }
  }

  private cleanup(): void {
    if (this.sandboxMaker) {
      this.sandboxMaker.destroy();
      this.sandboxMaker = null;
    }
    eventBus.off('SANDBOX_LEVEL_SAVED', this.onLevelSaved.bind(this));
  }
}
