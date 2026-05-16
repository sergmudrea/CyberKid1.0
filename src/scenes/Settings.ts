// src/scenes/Settings.ts
// Эйдо: Экран настроек игры. Вкладки: Game, Audio, Data, Developer.
// Управление: режим обучения, язык, звук, музыка, вибрация, авто-подсказки,
// экспорт/импорт прогресса, сброс всех данных, режим разработчика, очистка кэша.
// Все изменения применяются через SettingsManager и сохраняются.

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';
import { progressManager } from '../managers/ProgressManager';
import { saveManager } from '../managers/SaveManager';
import { levelManager } from '../managers/LevelManager';
import { LearningMode } from '../types/index';

type Tab = 'game' | 'audio' | 'data' | 'dev';

export class Settings extends Scene {
  private currentTab: Tab = 'game';
  private container: Phaser.GameObjects.Container;
  private tabButtons: Map<Tab, Phaser.GameObjects.Text> = new Map();
  private contentContainer: Phaser.GameObjects.Container;
  private backButton: Phaser.GameObjects.Text;
  private lang: 'ru' | 'en' = 'en';

  constructor() {
    super('Settings');
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
    const title = this.add.text(width / 2, 50, this.lang === 'ru' ? 'НАСТРОЙКИ' : 'SETTINGS', {
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
      { id: 'game', labelRu: 'ИГРА', labelEn: 'GAME' },
      { id: 'audio', labelRu: 'ЗВУК', labelEn: 'AUDIO' },
      { id: 'data', labelRu: 'ДАННЫЕ', labelEn: 'DATA' },
      { id: 'dev', labelRu: 'DEV', labelEn: 'DEV' },
    ];
    const startX = width / 2 - 200;
    const spacing = 130;
    tabNames.forEach((tab, idx) => {
      const x = startX + idx * spacing;
      const btn = this.add.text(x, 110, this.lang === 'ru' ? tab.labelRu : tab.labelEn, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#aaaaaa',
        backgroundColor: '#2a2a4a',
        padding: { x: 12, y: 6 },
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
  }

  private renderCurrentTab(): void {
    this.contentContainer.removeAll(true);
    switch (this.currentTab) {
      case 'game': this.renderGameTab(); break;
      case 'audio': this.renderAudioTab(); break;
      case 'data': this.renderDataTab(); break;
      case 'dev': this.renderDevTab(); break;
    }
  }

  private renderGameTab(): void {
    const width = this.cameras.main.width;
    const startY = 160;
    const settings = settingsManager.get();
    const items = [
      { type: 'select', key: 'learningMode', label: this.lang === 'ru' ? 'Режим обучения' : 'Learning mode',
        options: [
          { value: LearningMode.KIDDO, label: this.lang === 'ru' ? 'Kiddo (3-5)' : 'Kiddo (3-5)' },
          { value: LearningMode.SCHOLAR, label: this.lang === 'ru' ? 'Scholar (6-9)' : 'Scholar (6-9)' },
          { value: LearningMode.DEV_STUDENT, label: this.lang === 'ru' ? 'Dev Student (10-14)' : 'Dev Student (10-14)' },
          { value: LearningMode.DEVELOPER, label: this.lang === 'ru' ? 'Developer (15+)' : 'Developer (15+)' },
        ] },
      { type: 'select', key: 'language', label: this.lang === 'ru' ? 'Язык' : 'Language',
        options: [{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }] },
      { type: 'toggle', key: 'showTutorials', label: this.lang === 'ru' ? 'Показывать обучение' : 'Show tutorials' },
      { type: 'toggle', key: 'autoHints', label: this.lang === 'ru' ? 'Авто-подсказки' : 'Auto hints' },
      { type: 'toggle', key: 'vibrationEnabled', label: this.lang === 'ru' ? 'Вибрация' : 'Vibration' },
    ];
    let y = startY;
    items.forEach(item => {
      const label = this.add.text(width / 2 - 250, y, item.label, { fontSize: '18px', color: '#ffffff' }).setOrigin(0, 0);
      this.contentContainer.add(label);
      if (item.type === 'toggle') {
        const value = settings[item.key as keyof typeof settings] as boolean;
        const toggle = this.add.text(width / 2 + 50, y, value ? '✅ ON' : '❌ OFF', {
          fontSize: '18px',
          color: value ? '#00ffcc' : '#ff8888',
          backgroundColor: '#2a2a4a',
          padding: { x: 12, y: 4 },
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        toggle.on('pointerdown', () => {
          const newVal = !value;
          settingsManager.set(item.key as any, newVal);
          this.renderCurrentTab();
        });
        this.contentContainer.add(toggle);
      } else if (item.type === 'select') {
        const options = item.options;
        const currentVal = settings[item.key as keyof typeof settings];
        let optIndex = options.findIndex(opt => opt.value === currentVal);
        if (optIndex === -1) optIndex = 0;
        const selectBtn = this.add.text(width / 2 + 50, y, options[optIndex]?.label || '', {
          fontSize: '18px',
          color: '#00ffcc',
          backgroundColor: '#2a2a4a',
          padding: { x: 12, y: 4 },
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        selectBtn.on('pointerdown', () => {
          optIndex = (optIndex + 1) % options.length;
          const newVal = options[optIndex].value;
          settingsManager.set(item.key as any, newVal);
          this.renderCurrentTab();
        });
        this.contentContainer.add(selectBtn);
      }
      y += 45;
    });
  }

  private renderAudioTab(): void {
    const width = this.cameras.main.width;
    const startY = 160;
    const settings = settingsManager.get();
    const items = [
      { type: 'toggle', key: 'soundEnabled', label: this.lang === 'ru' ? 'Звуковые эффекты' : 'Sound effects' },
      { type: 'slider', key: 'soundVolume', label: this.lang === 'ru' ? 'Громкость звуков' : 'Sound volume', min: 0, max: 1, step: 0.1 },
      { type: 'toggle', key: 'musicEnabled', label: this.lang === 'ru' ? 'Музыка' : 'Music' },
      { type: 'slider', key: 'musicVolume', label: this.lang === 'ru' ? 'Громкость музыки' : 'Music volume', min: 0, max: 1, step: 0.1 },
    ];
    let y = startY;
    items.forEach(item => {
      const label = this.add.text(width / 2 - 250, y, item.label, { fontSize: '18px', color: '#ffffff' }).setOrigin(0, 0);
      this.contentContainer.add(label);
      if (item.type === 'toggle') {
        const value = settings[item.key as keyof typeof settings] as boolean;
        const toggle = this.add.text(width / 2 + 50, y, value ? '✅ ON' : '❌ OFF', {
          fontSize: '18px',
          color: value ? '#00ffcc' : '#ff8888',
          backgroundColor: '#2a2a4a',
          padding: { x: 12, y: 4 },
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        toggle.on('pointerdown', () => {
          const newVal = !value;
          settingsManager.set(item.key as any, newVal);
          this.renderCurrentTab();
        });
        this.contentContainer.add(toggle);
      } else if (item.type === 'slider') {
        const value = settings[item.key as keyof typeof settings] as number;
        const percent = Math.floor(value * 100);
        const sliderContainer = this.add.container(width / 2 + 50, y);
        const minusBtn = this.add.text(0, 0, '−', {
          fontSize: '24px',
          color: '#ffffff',
          backgroundColor: '#2a2a4a',
          padding: { x: 10, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const valueText = this.add.text(40, 0, `${percent}%`, {
          fontSize: '18px',
          color: '#00ffcc',
          backgroundColor: '#2a2a4a',
          padding: { x: 12, y: 4 },
        }).setOrigin(0.5);
        const plusBtn = this.add.text(100, 0, '+', {
          fontSize: '24px',
          color: '#ffffff',
          backgroundColor: '#2a2a4a',
          padding: { x: 10, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        minusBtn.on('pointerdown', () => {
          let newVal = value - item.step;
          if (newVal < item.min) newVal = item.min;
          settingsManager.set(item.key as any, Math.round(newVal * 10) / 10);
          this.renderCurrentTab();
        });
        plusBtn.on('pointerdown', () => {
          let newVal = value + item.step;
          if (newVal > item.max) newVal = item.max;
          settingsManager.set(item.key as any, Math.round(newVal * 10) / 10);
          this.renderCurrentTab();
        });
        sliderContainer.add([minusBtn, valueText, plusBtn]);
        this.contentContainer.add(sliderContainer);
      }
      y += 45;
    });
  }

  private renderDataTab(): void {
    const width = this.cameras.main.width;
    const startY = 160;
    const exportBtn = this.add.text(width / 2 - 200, startY, this.lang === 'ru' ? '📤 ЭКСПОРТ ПРОГРЕССА' : '📤 EXPORT PROGRESS', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    exportBtn.on('pointerdown', () => this.exportProgress());
    this.contentContainer.add(exportBtn);

    const importBtn = this.add.text(width / 2 - 200, startY + 50, this.lang === 'ru' ? '📥 ИМПОРТ ПРОГРЕССА' : '📥 IMPORT PROGRESS', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    importBtn.on('pointerdown', () => this.importProgress());
    this.contentContainer.add(importBtn);

    const resetBtn = this.add.text(width / 2 - 200, startY + 100, this.lang === 'ru' ? '⚠️ СБРОСИТЬ ВСЕ ДАННЫЕ' : '⚠️ RESET ALL DATA', {
      fontSize: '18px',
      color: '#ff8888',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => this.resetAllData());
    this.contentContainer.add(resetBtn);
  }

  private renderDevTab(): void {
    const width = this.cameras.main.width;
    const startY = 160;
    const settings = settingsManager.get();
    const devModeToggle = this.add.text(width / 2 - 200, startY, this.lang === 'ru' ? '👨‍💻 РЕЖИМ РАЗРАБОТЧИКА' : '👨‍💻 DEVELOPER MODE', {
      fontSize: '18px',
      color: settings.developerMode ? '#00ffcc' : '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    devModeToggle.on('pointerdown', () => {
      settingsManager.set('developerMode', !settings.developerMode);
      this.renderCurrentTab();
    });
    this.contentContainer.add(devModeToggle);
    const devStatus = this.add.text(width / 2 - 200, startY + 50, settings.developerMode ? (this.lang === 'ru' ? '✅ АКТИВЕН' : '✅ ACTIVE') : (this.lang === 'ru' ? '❌ НЕАКТИВЕН' : '❌ INACTIVE'), {
      fontSize: '14px',
      color: '#cccccc',
    }).setOrigin(0, 0);
    this.contentContainer.add(devStatus);

    const clearCacheBtn = this.add.text(width / 2 - 200, startY + 100, this.lang === 'ru' ? '🗑️ ОЧИСТИТЬ КЭШ УРОВНЕЙ' : '🗑️ CLEAR LEVEL CACHE', {
      fontSize: '16px',
      color: '#ffaa00',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    clearCacheBtn.on('pointerdown', () => this.clearLevelCache());
    this.contentContainer.add(clearCacheBtn);

    const eventLogBtn = this.add.text(width / 2 - 200, startY + 150, this.lang === 'ru' ? '📡 ПОКАЗАТЬ СОБЫТИЯ' : '📡 SHOW EVENTS', {
      fontSize: '16px',
      color: '#00ffcc',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 8 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    eventLogBtn.on('pointerdown', () => this.enableEventDebug());
    this.contentContainer.add(eventLogBtn);
  }

  private createBottomButtons(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.backButton = this.add.text(50, height - 40, this.lang === 'ru' ? '← НАЗАД' : '← BACK', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 6 },
    }).setInteractive({ useHandCursor: true });
    this.backButton.on('pointerdown', () => this.scene.start('MainMenu'));
    this.backButton.on('pointerover', () => this.backButton.setColor('#00ffcc'));
    this.backButton.on('pointerout', () => this.backButton.setColor('#ffffff'));
  }

  private exportProgress(): void {
    const data = progressManager.exportProgress();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberkid_progress_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private importProgress(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = ev.target?.result as string;
          const success = progressManager.importProgress(json);
          if (success) {
            alert(this.lang === 'ru' ? 'Прогресс импортирован' : 'Progress imported');
            this.scene.start('MainMenu');
          } else {
            alert(this.lang === 'ru' ? 'Ошибка импорта' : 'Import failed');
          }
        } catch (err) {
          alert(this.lang === 'ru' ? 'Неверный формат' : 'Invalid format');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  private resetAllData(): void {
    const confirmMsg = this.lang === 'ru'
      ? 'ВНИМАНИЕ! Все данные (прогресс, настройки, сохранённые программы) будут удалены без возможности восстановления. Продолжить?'
      : 'WARNING! All data (progress, settings, saved programs) will be permanently deleted. Continue?';
    if (confirm(confirmMsg)) {
      progressManager.resetAll();
      saveManager.resetAllData();
      settingsManager.reset();
      levelManager.clearCache(); // дополнительная очистка кэша уровней
      alert(this.lang === 'ru' ? 'Все данные сброшены' : 'All data reset');
      this.scene.start('MainMenu');
    }
  }

  private clearLevelCache(): void {
    levelManager.clearCache();
    alert(this.lang === 'ru' ? 'Кэш уровней очищен' : 'Level cache cleared');
  }

  private enableEventDebug(): void {
    if (settingsManager.get().developerMode) {
      eventBus.setDebug(true);
      alert(this.lang === 'ru' ? 'Отладка событий включена' : 'Event debug enabled');
    } else {
      alert(this.lang === 'ru' ? 'Сначала включите режим разработчика' : 'Enable developer mode first');
    }
  }

  private updateBackButtonText(): void {
    if (this.backButton) {
      this.backButton.setText(this.lang === 'ru' ? '← НАЗАД' : '← BACK');
    }
  }

  private setupEventListeners(): void {
    eventBus.on('SETTINGS_CHANGED', () => {
      this.lang = settingsManager.get().language;
      this.updateBackButtonText();
      // Перерисовываем текущую вкладку, чтобы обновить тексты на текущем языке
      this.renderCurrentTab();
      // Также обновляем заголовки вкладок
      for (const [id, btn] of this.tabButtons) {
        const tabNames: Record<Tab, { ru: string; en: string }> = {
          game: { ru: 'ИГРА', en: 'GAME' },
          audio: { ru: 'ЗВУК', en: 'AUDIO' },
          data: { ru: 'ДАННЫЕ', en: 'DATA' },
          dev: { ru: 'DEV', en: 'DEV' },
        };
        btn.setText(this.lang === 'ru' ? tabNames[id].ru : tabNames[id].en);
      }
      this.highlightTab();
    });
  }

  private removeEventListeners(): void {
    eventBus.off('SETTINGS_CHANGED');
  }
}
