// src/scenes/LevelSelect.ts
// Эйдо: Сцена выбора уровня в конкретном мире.
// Отображает сетку уровней (кнопки) с количеством звёзд, блокировкой непройденных уровней,
// индикатором сохранённой программы, навигацией по страницам (если уровней много).
// Передаёт выбранный уровень в GameScene.

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';
import { saveManager } from '../managers/SaveManager';
import { settingsManager } from '../managers/SettingsManager';

export class LevelSelect extends Scene {
  private worldId: string = 'meadow';
  private currentPage: number = 0;
  private levelsPerPage: number = 20;
  private levelIds: string[] = [];
  private levelButtons: Phaser.GameObjects.Container[] = [];
  private pageText: Phaser.GameObjects.Text;
  private selectedLevelId: string | null = null;
  private playButton: Phaser.GameObjects.Text;
  private infoPanel: Phaser.GameObjects.Container;
  private levelNameText: Phaser.GameObjects.Text;
  private levelStatsText: Phaser.GameObjects.Text;
  private savedIndicator: Phaser.GameObjects.Text;

  constructor() {
    super('LevelSelect');
  }

  init(data: { worldId?: string; levelNum?: number }): void {
    this.worldId = data.worldId || 'meadow';
    const startLevelNum = data.levelNum || 1;
    this.selectedLevelId = `${this.worldId}_${startLevelNum.toString().padStart(3, '0')}`;
  }

  async create(): Promise<void> {
    this.createBackground();
    this.createHeader();
    await this.loadLevels();
    this.renderLevelGrid();
    this.createInfoPanel();
    this.createBottomNav();
    this.setupEventListeners();
    if (this.selectedLevelId && this.levelIds.includes(this.selectedLevelId)) {
      this.highlightLevel(this.selectedLevelId);
      this.updateInfoPanel(this.selectedLevelId);
    }
  }

  private createBackground(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);
    for (let i = 0; i < 80; i++) {
      const star = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 2 + 1, 0xffffff, 0.3 + Math.random() * 0.5);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createHeader(): void {
    const width = this.cameras.main.width;
    const worldName = this.getWorldName();
    const title = this.add.text(width / 2, 50, worldName, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: title,
      scale: 1.02,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    this.pageText = this.add.text(width - 100, 100, '', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
  }

  private getWorldName(): string {
    const lang = settingsManager.get().language;
    const names: Record<string, string> = {
      meadow: lang === 'ru' ? 'Луг' : 'Meadow',
      ocean: lang === 'ru' ? 'Океан' : 'Ocean',
      clouds: lang === 'ru' ? 'Облака' : 'Clouds',
      fairytale: lang === 'ru' ? 'Сказка' : 'Fairytale',
      volcano: lang === 'ru' ? 'Вулкан' : 'Volcano',
      arcade: 'Arcade',
      bonus: lang === 'ru' ? 'Бонус' : 'Bonus',
    };
    return names[this.worldId] || this.worldId;
  }

  private async loadLevels(): Promise<void> {
    this.levelIds = levelManager.getLevelIdsForWorld(this.worldId);
    if (this.levelIds.length === 0) {
      await levelManager.initialize();
      this.levelIds = levelManager.getLevelIdsForWorld(this.worldId);
    }
    this.levelIds.sort((a, b) => {
      const numA = parseInt(a.split('_')[1], 10);
      const numB = parseInt(b.split('_')[1], 10);
      return numA - numB;
    });
  }

  private renderLevelGrid(): void {
    this.levelButtons.forEach(btn => btn.destroy());
    this.levelButtons = [];
    const startIdx = this.currentPage * this.levelsPerPage;
    const endIdx = Math.min(startIdx + this.levelsPerPage, this.levelIds.length);
    const pageLevels = this.levelIds.slice(startIdx, endIdx);
    const cols = 5;
    const rows = 4;
    const startX = 150;
    const startY = 160;
    const spacingX = 100;
    const spacingY = 90;
    for (let i = 0; i < pageLevels.length; i++) {
      const levelId = pageLevels[i];
      const levelNum = parseInt(levelId.split('_')[1], 10);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      const stats = progressManager.getLevelStats(levelId);
      const stars = stats?.stars || 0;
      const isLocked = this.isLevelLocked(levelId);
      const hasSaved = saveManager.hasSavedProgram(levelId);
      const button = this.createLevelButton(x, y, levelNum, stars, isLocked, hasSaved);
      button.setData('levelId', levelId);
      button.setInteractive({ useHandCursor: !isLocked });
      if (!isLocked) {
        button.on('pointerdown', () => this.selectLevel(levelId));
        button.on('pointerover', () => {
          if (!isLocked) this.updateInfoPanel(levelId);
        });
      }
      this.levelButtons.push(button);
    }
    const totalPages = Math.ceil(this.levelIds.length / this.levelsPerPage);
    this.pageText.setText(`${this.currentPage + 1} / ${totalPages}`);
  }

  private createLevelButton(x: number, y: number, levelNum: number, stars: number, isLocked: boolean, hasSaved: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 80, 70, isLocked ? 0x444444 : 0x2a2a4a, 0.9);
    bg.setStrokeStyle(2, 0x00ffcc, isLocked ? 0.3 : 0.8);
    const numberText = this.add.text(0, -15, `${levelNum}`, { fontSize: '22px', color: isLocked ? '#888' : '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5);
    const starsText = this.add.text(0, 15, '★'.repeat(stars) + '☆'.repeat(3 - stars), { fontSize: '12px', color: '#ffcc00' }).setOrigin(0.5);
    container.add([bg, numberText, starsText]);
    if (isLocked) {
      const lock = this.add.text(0, -5, '🔒', { fontSize: '16px' }).setOrigin(0.5);
      container.add(lock);
    }
    if (hasSaved && !isLocked) {
      const saveIcon = this.add.text(25, -25, '💾', { fontSize: '14px' }).setOrigin(0.5);
      container.add(saveIcon);
    }
    return container;
  }

  private isLevelLocked(levelId: string): boolean {
    // Для Arcade все уровни открыты
    if (this.worldId === 'arcade') return false;
    const levelNum = parseInt(levelId.split('_')[1], 10);
    if (levelNum === 1) return false;
    const prevLevelNum = levelNum - 1;
    const prevLevelId = `${this.worldId}_${prevLevelNum.toString().padStart(3, '0')}`;
    const prevStats = progressManager.getLevelStats(prevLevelId);
    return !prevStats?.completed;
  }

  private selectLevel(levelId: string): void {
    if (!this.levelIds.includes(levelId)) return;
    this.selectedLevelId = levelId;
    this.highlightLevel(levelId);
    this.updateInfoPanel(levelId);
  }

  private highlightLevel(levelId: string): void {
    this.levelButtons.forEach(btn => {
      const bg = btn.getAt(0) as Phaser.GameObjects.Rectangle;
      if (btn.getData('levelId') === levelId) {
        bg.setStrokeStyle(3, 0xffaa00);
      } else {
        bg.setStrokeStyle(2, 0x00ffcc);
      }
    });
  }

  private createInfoPanel(): void {
    const width = this.cameras.main.width;
    const panelBg = this.add.rectangle(width - 220, 120, 200, 160, 0x000000, 0.7);
    panelBg.setOrigin(0.5);
    panelBg.setStrokeStyle(2, 0x00ffcc);
    this.infoPanel = this.add.container(width - 220, 120);
    this.infoPanel.add(panelBg);
    this.levelNameText = this.add.text(0, -50, '', { fontSize: '16px', color: '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5);
    this.levelStatsText = this.add.text(0, -20, '', { fontSize: '12px', color: '#cccccc' }).setOrigin(0.5);
    this.savedIndicator = this.add.text(0, 10, '', { fontSize: '12px', color: '#ffaa00' }).setOrigin(0.5);
    this.playButton = this.add.text(0, 50, '▶ PLAY', { fontSize: '18px', color: '#00ffcc', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.playButton.on('pointerdown', () => {
      if (this.selectedLevelId) {
        this.startLevel(this.selectedLevelId);
      }
    });
    this.infoPanel.add([this.levelNameText, this.levelStatsText, this.savedIndicator, this.playButton]);
    this.infoPanel.setVisible(false);
  }

  private updateInfoPanel(levelId: string): void {
    const lang = settingsManager.get().language;
    const stats = progressManager.getLevelStats(levelId);
    const stars = stats?.stars || 0;
    const bestSteps = stats?.bestSteps !== undefined && stats.bestSteps !== Infinity ? stats.bestSteps : '—';
    const attempts = stats?.attempts || 0;
    const hasSaved = saveManager.hasSavedProgram(levelId);
    this.levelNameText.setText(`Level ${levelId.split('_')[1]}`);
    this.levelStatsText.setText(`${stars}★  |  Best: ${bestSteps}  |  Attempts: ${attempts}`);
    if (hasSaved) {
      this.savedIndicator.setText(lang === 'ru' ? '💾 Программа сохранена' : '💾 Program saved');
    } else {
      this.savedIndicator.setText('');
    }
    this.infoPanel.setVisible(true);
  }

  private createBottomNav(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const lang = settingsManager.get().language;
    const backBtn = this.add.text(50, height - 40, lang === 'ru' ? '← НАЗАД' : '← BACK', { fontSize: '20px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('WorldMap'));
    const prevBtn = this.add.text(width / 2 - 80, height - 40, lang === 'ru' ? '◀ НАЗАД' : '◀ PREV', { fontSize: '18px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => this.prevPage());
    const nextBtn = this.add.text(width / 2 + 40, height - 40, lang === 'ru' ? 'ВПЕРЁД ▶' : 'NEXT ▶', { fontSize: '18px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => this.nextPage());
    const resetBtn = this.add.text(width - 200, height - 40, lang === 'ru' ? '🔄 СБРОС МИРА' : '🔄 RESET WORLD', { fontSize: '14px', color: '#ff8888', backgroundColor: '#2a2a4a', padding: { x: 12, y: 4 } }).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => this.resetWorldProgress());
  }

  private prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderLevelGrid();
    }
  }

  private nextPage(): void {
    const totalPages = Math.ceil(this.levelIds.length / this.levelsPerPage);
    if (this.currentPage + 1 < totalPages) {
      this.currentPage++;
      this.renderLevelGrid();
    }
  }

  private resetWorldProgress(): void {
    const lang = settingsManager.get().language;
    const message = lang === 'ru'
      ? `Сбросить прогресс всех уровней в мире "${this.getWorldName()}"? Это действие нельзя отменить.`
      : `Reset all level progress in "${this.getWorldName()}" world? This action cannot be undone.`;
    if (confirm(message)) {
      // Используем публичный метод ProgressManager
      progressManager.resetWorldProgress(this.worldId);
      // Сбрасываем локальное состояние сцены
      this.selectedLevelId = null;
      this.currentPage = 0;
      this.renderLevelGrid();
      this.infoPanel.setVisible(false);
    }
  }

  private startLevel(levelId: string): void {
    saveManager.updateCurrentLevel(levelId, this.worldId);
    saveManager.saveSessionState(this.worldId, levelId, []);
    this.scene.start('GameScene', { levelId });
  }

  private setupEventListeners(): void {
    eventBus.on('PROGRESS_UPDATED', () => {
      this.renderLevelGrid();
      if (this.selectedLevelId && this.levelIds.includes(this.selectedLevelId)) {
        this.updateInfoPanel(this.selectedLevelId);
      } else {
        this.infoPanel.setVisible(false);
      }
    });
    eventBus.on('SETTINGS_CHANGED', () => {
      this.renderLevelGrid();
      this.createBottomNav(); // обновляем подписи кнопок
    });
  }

  private removeEventListeners(): void {
    eventBus.off('PROGRESS_UPDATED');
    eventBus.off('SETTINGS_CHANGED');
  }
}
