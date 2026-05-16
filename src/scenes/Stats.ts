// src/scenes/Stats.ts
// Эйдо: Экран статистики и достижений.
// Отображает общее количество звёзд, чёрных звёзд, пройденных уровней,
// прогресс по мирам (процент завершения, звёзды), список достижений с блокировкой/разблокировкой,
// возможность поделиться статистикой (скопировать в буфер обмена / нативная поделиться).
// Поддерживает прокрутку списка достижений.

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';
import { settingsManager } from '../managers/SettingsManager';
import { Achievement } from '../types/index';

type Tab = 'overview' | 'worlds' | 'achievements';

export class Stats extends Scene {
  private currentTab: Tab = 'overview';
  private tabButtons: Map<Tab, Phaser.GameObjects.Text> = new Map();
  private contentContainer: Phaser.GameObjects.Container;
  private scrollContainer: Phaser.GameObjects.Container;
  private scrollMask: Phaser.GameObjects.Graphics;
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private lang: 'ru' | 'en' = 'en';

  constructor() {
    super('Stats');
  }

  create(): void {
    this.lang = settingsManager.get().language;
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createContentContainer();
    this.renderCurrentTab();
    this.createBottomButtons();
    this.setupEventListeners();
    this.events.once('shutdown', () => this.removeEventListeners());
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
    const title = this.add.text(width / 2, 50, this.lang === 'ru' ? 'СТАТИСТИКА' : 'STATISTICS', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 3,
    }).setOrigin(0.5);
  }

  private createTabs(): void {
    const width = this.cameras.main.width;
    const tabNames: { id: Tab; labelRu: string; labelEn: string }[] = [
      { id: 'overview', labelRu: 'ОБЗОР', labelEn: 'OVERVIEW' },
      { id: 'worlds', labelRu: 'МИРЫ', labelEn: 'WORLDS' },
      { id: 'achievements', labelRu: 'ДОСТИЖЕНИЯ', labelEn: 'ACHIEVEMENTS' },
    ];
    const startX = width / 2 - 200;
    const spacing = 200;
    tabNames.forEach((tab, idx) => {
      const x = startX + idx * spacing;
      const btn = this.add.text(x, 110, this.lang === 'ru' ? tab.labelRu : tab.labelEn, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#aaaaaa',
        backgroundColor: '#2a2a4a',
        padding: { x: 16, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.switchTab(tab.id));
      this.tabButtons.set(tab.id, btn);
    });
    this.highlightTab();
  }

  private highlightTab(): void {
    for (const [id, btn] of this.tabButtons) {
      if (id === this.currentTab) {
        btn.setColor('#00ffcc');
        btn.setBackgroundColor('#3a3a6a');
      } else {
        btn.setColor('#aaaaaa');
        btn.setBackgroundColor('#2a2a4a');
      }
    }
  }

  private switchTab(tab: Tab): void {
    this.currentTab = tab;
    this.highlightTab();
    this.renderCurrentTab();
  }

  private createContentContainer(): void {
    this.contentContainer = this.add.container(0, 0);
    // Контейнер для прокрутки (используется только во вкладке achievements)
    this.scrollContainer = this.add.container(0, 0);
    this.contentContainer.add(this.scrollContainer);
  }

  private renderCurrentTab(): void {
    this.contentContainer.removeAll(true);
    this.scrollContainer.removeAll(true);
    // Пересоздаём контейнеры
    this.scrollContainer = this.add.container(0, 0);
    this.contentContainer.add(this.scrollContainer);
    switch (this.currentTab) {
      case 'overview': this.renderOverviewTab(); break;
      case 'worlds': this.renderWorldsTab(); break;
      case 'achievements': this.renderAchievementsTab(); break;
    }
  }

  private renderOverviewTab(): void {
    const progress = progressManager.get();
    const width = this.cameras.main.width;
    const startY = 160;
    const lineHeight = 45;

    const stats = [
      { label: this.lang === 'ru' ? 'Всего звёзд' : 'Total stars', value: progress.totalStars },
      { label: this.lang === 'ru' ? 'Чёрных звёзд' : 'Black stars', value: progress.totalBlackStars },
      { label: this.lang === 'ru' ? 'Пройдено уровней' : 'Levels completed', value: progress.levelsCompleted.length },
      { label: this.lang === 'ru' ? 'Идеальных уровней (3★)' : 'Perfect levels (3★)', value: progress.perfectLevels.length },
      { label: this.lang === 'ru' ? 'Попыток' : 'Total attempts', value: progress.totalAttempts },
      { label: this.lang === 'ru' ? 'Смертей' : 'Deaths', value: progress.totalDeaths },
      { label: this.lang === 'ru' ? 'Использований Exploration' : 'Exploration uses', value: progress.explorationUsedCount },
      { label: this.lang === 'ru' ? 'Найдено бэкдоров' : 'Backdoors found', value: progress.backdoorsFound },
      { label: this.lang === 'ru' ? 'Время игры (сек)' : 'Play time (sec)', value: progress.totalPlayTimeSec },
    ];

    let y = startY;
    stats.forEach(stat => {
      const label = this.add.text(width / 2 - 250, y, stat.label, { fontSize: '18px', color: '#ffffff' }).setOrigin(0, 0);
      const value = this.add.text(width / 2 + 50, y, stat.value.toString(), { fontSize: '18px', color: '#00ffcc' }).setOrigin(0, 0);
      this.contentContainer.add([label, value]);
      y += lineHeight;
    });

    const shareBtn = this.add.text(width / 2, y + 20, this.lang === 'ru' ? '📤 ПОДЕЛИТЬСЯ' : '📤 SHARE', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    shareBtn.on('pointerdown', () => this.shareStats());
    this.contentContainer.add(shareBtn);
  }

  private renderWorldsTab(): void {
    const width = this.cameras.main.width;
    const startY = 160;
    const lineHeight = 70;
    const worldIds = ['meadow', 'ocean', 'clouds', 'fairytale', 'volcano', 'bonus']; // arcade исключён
    let y = startY;

    for (const worldId of worldIds) {
      const levelIds = levelManager.getLevelIdsForWorld(worldId);
      let totalStars = 0;
      let maxStars = levelIds.length * 3;
      let completedCount = 0;
      for (const levelId of levelIds) {
        const stats = progressManager.getLevelStats(levelId);
        if (stats) {
          totalStars += stats.stars;
          if (stats.completed) completedCount++;
        }
      }
      const percent = maxStars > 0 ? Math.floor((totalStars / maxStars) * 100) : 0;
      const worldName = this.getWorldName(worldId);
      const worldLabel = this.add.text(width / 2 - 300, y, worldName, { fontSize: '20px', color: '#ffffff' }).setOrigin(0, 0);
      const starsText = this.add.text(width / 2 - 100, y, `${totalStars} / ${maxStars} ★`, { fontSize: '16px', color: '#ffcc00' }).setOrigin(0, 0);
      const progressBar = this.add.graphics();
      progressBar.fillStyle(0x444444, 1);
      progressBar.fillRect(width / 2 + 50, y + 5, 200, 20);
      progressBar.fillStyle(0x00ffcc, 1);
      progressBar.fillRect(width / 2 + 50, y + 5, 200 * (percent / 100), 20);
      const percentText = this.add.text(width / 2 + 270, y + 5, `${percent}%`, { fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0);
      const completedText = this.add.text(width / 2 + 350, y + 5, `${completedCount}/${levelIds.length}`, { fontSize: '14px', color: '#aaaaaa' }).setOrigin(0, 0);
      this.contentContainer.add([worldLabel, starsText, progressBar, percentText, completedText]);
      y += lineHeight;
    }
  }

  private renderAchievementsTab(): void {
    const achievements = progressManager.get().achievements;
    const width = this.cameras.main.width;
    const scrollAreaHeight = 400;
    const startX = width / 2 - 300;
    const startY = 160;
    const spacing = 50;

    // Очищаем скролл-контейнер
    this.scrollContainer.removeAll(true);
    this.scrollContainer.y = startY;
    this.scrollY = 0;
    this.maxScrollY = Math.max(0, achievements.length * spacing - scrollAreaHeight);

    let y = 0;
    achievements.forEach((ach: Achievement) => {
      const unlocked = ach.unlocked;
      const name = ach.name || (this.lang === 'ru' ? 'Достижение' : 'Achievement');
      const description = ach.description || '';
      const progressStr = ach.progress !== undefined ? ` (${ach.progress}/100)` : '';
      const color = unlocked ? '#00ffcc' : '#888888';
      const nameText = this.add.text(startX, y, `${unlocked ? '✅' : '🔒'} ${name}${progressStr}`, { fontSize: '16px', color: color }).setOrigin(0, 0);
      const descText = this.add.text(startX, y + 20, description, { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0, 0);
      this.scrollContainer.add([nameText, descText]);
      y += spacing;
    });

    // Маска для прокрутки
    const maskGraphics = this.add.graphics();
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.fillRect(startX - 10, startY, width - 2 * (startX - 10), scrollAreaHeight);
    this.scrollContainer.setMask(maskGraphics.createGeometryMask());

    // Обработчики прокрутки
    const hitArea = new Phaser.Geom.Rectangle(startX - 10, startY, width - 2 * (startX - 10), scrollAreaHeight);
    const dragZone = this.add.zone(startX - 10, startY, width - 2 * (startX - 10), scrollAreaHeight).setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    dragZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.currentTab !== 'achievements') return;
      const delta = pointer.y - this.dragStartY;
      this.dragStartY = pointer.y;
      this.scrollY = Math.min(this.maxScrollY, Math.max(0, this.scrollY - delta));
      this.scrollContainer.y = startY - this.scrollY;
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  private getWorldName(worldId: string): string {
    const lang = this.lang;
    const names: Record<string, string> = {
      meadow: lang === 'ru' ? 'Луг' : 'Meadow',
      ocean: lang === 'ru' ? 'Океан' : 'Ocean',
      clouds: lang === 'ru' ? 'Облака' : 'Clouds',
      fairytale: lang === 'ru' ? 'Сказка' : 'Fairytale',
      volcano: lang === 'ru' ? 'Вулкан' : 'Volcano',
      bonus: lang === 'ru' ? 'Бонус' : 'Bonus',
    };
    return names[worldId] || worldId;
  }

  private shareStats(): void {
    const progress = progressManager.get();
    const lang = this.lang;
    const text = lang === 'ru'
      ? `CyberKid — Моя статистика:\nЗвёзд: ${progress.totalStars}\nЧёрных звёзд: ${progress.totalBlackStars}\nУровней пройдено: ${progress.levelsCompleted.length}\nВремя игры: ${Math.floor(progress.totalPlayTimeSec / 60)} мин.\n#CyberKid #GameDev`
      : `CyberKid — My stats:\nStars: ${progress.totalStars}\nBlack stars: ${progress.totalBlackStars}\nLevels completed: ${progress.levelsCompleted.length}\nPlay time: ${Math.floor(progress.totalPlayTimeSec / 60)} min.\n#CyberKid #GameDev`;
    if (navigator.share) {
      navigator.share({
        title: 'CyberKid Stats',
        text: text,
      }).catch((err) => {
        console.warn('Share failed', err);
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(this.lang === 'ru' ? 'Статистика скопирована в буфер обмена' : 'Stats copied to clipboard');
    }).catch(() => {
      alert(this.lang === 'ru' ? 'Не удалось скопировать' : 'Failed to copy');
    });
  }

  private createBottomButtons(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const backBtn = this.add.text(50, height - 40, this.lang === 'ru' ? '← НАЗАД' : '← BACK', {
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
    eventBus.on('PROGRESS_UPDATED', () => {
      this.renderCurrentTab();
    });
    eventBus.on('SETTINGS_CHANGED', () => {
      this.lang = settingsManager.get().language;
      this.renderCurrentTab();
      const tabNames: Record<Tab, { ru: string; en: string }> = {
        overview: { ru: 'ОБЗОР', en: 'OVERVIEW' },
        worlds: { ru: 'МИРЫ', en: 'WORLDS' },
        achievements: { ru: 'ДОСТИЖЕНИЯ', en: 'ACHIEVEMENTS' },
      };
      for (const [id, btn] of this.tabButtons) {
        btn.setText(this.lang === 'ru' ? tabNames[id].ru : tabNames[id].en);
      }
      this.highlightTab();
    });
  }

  private removeEventListeners(): void {
    eventBus.off('PROGRESS_UPDATED');
    eventBus.off('SETTINGS_CHANGED');
    this.input.off('pointermove');
    this.input.off('pointerup');
  }
}
