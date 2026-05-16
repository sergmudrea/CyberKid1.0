// src/scenes/VictoryScreen.ts
// Эйдо: Экран победы после завершения уровня.
// Отображает анимацию звёзд, чёрную звезду за бэкдор, сообщение о новых достижениях,
// статистику (шаги, оптимальные шаги, эффективность).
// Кнопки: следующий уровень (если доступен), реплай, главное меню.
// Автоматически разблокирует следующий мир, если завершены все уровни текущего.

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';
import { settingsManager } from '../managers/SettingsManager';
import { unlockManager } from '../managers/UnlockManager';

export class VictoryScreen extends Scene {
  private levelId: string = '';
  private stars: number = 0;
  private blackStar: boolean = false;
  private stepsUsed: number = 0;
  private optimalSteps: number = 0;
  private explorationUsed: boolean = false;
  private newAchievements: string[] = [];
  private worldUnlocked: string | null = null;

  constructor() {
    super('VictoryScreen');
  }

  init(data: {
    levelId: string;
    stars: number;
    blackStar: boolean;
    stepsUsed: number;
    optimalSteps: number;
    explorationUsed: boolean;
  }): void {
    this.levelId = data.levelId;
    this.stars = data.stars;
    this.blackStar = data.blackStar;
    this.stepsUsed = data.stepsUsed;
    this.optimalSteps = data.optimalSteps;
    this.explorationUsed = data.explorationUsed;
    this.newAchievements = [];
    this.worldUnlocked = null;
  }

  create(): void {
    this.createBackground();
    this.createHeader();
    this.createStarsAnimation();
    this.createStats();
    this.checkNewAchievements();
    this.checkWorldUnlock();
    this.createButtons();
    this.playVictoryMusic();
    this.setupEventListeners();
    // Отписка при уничтожении сцены
    this.events.once('shutdown', () => this.removeEventListeners());
  }

  private createBackground(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);
    // Конфетти-эффект
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const color = [0xff0000, 0x00ff00, 0x0000ff, 0xffcc00, 0xff00cc][Math.floor(Math.random() * 5)];
      const particle = this.add.rectangle(x, y, 4, 4, color);
      this.tweens.add({
        targets: particle,
        y: y + 200,
        alpha: 0,
        duration: 1000 + Math.random() * 1000,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private createHeader(): void {
    const width = this.cameras.main.width;
    const lang = settingsManager.get().language;
    const title = this.add.text(width / 2, 80, lang === 'ru' ? 'ПОБЕДА!' : 'VICTORY!', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#ffcc00',
      stroke: '#ff6600',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: title,
      scale: 1.1,
      duration: 500,
      yoyo: true,
      repeat: 1,
    });
  }

  private createStarsAnimation(): void {
    const width = this.cameras.main.width;
    const startX = width / 2 - 120;
    const starSize = 60;
    const spacing = 70;
    const starPositions = [
      { x: startX, y: 200 },
      { x: startX + spacing, y: 200 },
      { x: startX + spacing * 2, y: 200 },
    ];
    for (let i = 0; i < 3; i++) {
      const isEarned = i < this.stars;
      const star = this.add.text(starPositions[i].x, starPositions[i].y, '★', {
        fontFamily: 'monospace',
        fontSize: `${starSize}px`,
        color: isEarned ? '#ffcc00' : '#444444',
      }).setOrigin(0.5);
      if (isEarned) {
        this.tweens.add({
          targets: star,
          scale: 1.3,
          duration: 300,
          yoyo: true,
          repeat: 2,
          ease: 'Back.easeOut',
        });
      }
    }
    if (this.blackStar) {
      const blackStar = this.add.text(width / 2 + 150, 200, '★', {
        fontFamily: 'monospace',
        fontSize: `${starSize}px`,
        color: '#000000',
        stroke: '#ffcc00',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.tweens.add({
        targets: blackStar,
        scale: 1.3,
        duration: 300,
        yoyo: true,
        repeat: 2,
      });
      const label = this.add.text(width / 2 + 150, 260, 'BLACK STAR', {
        fontSize: '12px',
        color: '#ffcc00',
      }).setOrigin(0.5);
    }
  }

  private createStats(): void {
    const width = this.cameras.main.width;
    const lang = settingsManager.get().language;
    const efficiency = Math.floor((this.optimalSteps / this.stepsUsed) * 100);
    const statsText = [
      lang === 'ru' ? `Шаги: ${this.stepsUsed} / ${this.optimalSteps}` : `Steps: ${this.stepsUsed} / ${this.optimalSteps}`,
      lang === 'ru' ? `Эффективность: ${efficiency}%` : `Efficiency: ${efficiency}%`,
      this.explorationUsed ? (lang === 'ru' ? '⚠️ Использован режим исследования (-★)' : '⚠️ Exploration mode used (-★)') : '',
    ].filter(Boolean).join('\n');
    const stats = this.add.text(width / 2, 300, statsText, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cccccc',
      align: 'center',
    }).setOrigin(0.5);
  }

  private checkNewAchievements(): void {
    const progress = progressManager.get();
    const allAchievements = progress.achievements;
    const now = Date.now();
    // Учитываем только достижения, разблокированные за последние 2 секунды
    const newOnes = allAchievements.filter(ach => ach.unlocked && ach.unlockedAt && now - ach.unlockedAt < 2000);
    if (newOnes.length > 0) {
      this.newAchievements = newOnes.map(ach => ach.name);
      this.showAchievementToast();
    }
  }

  private showAchievementToast(): void {
    const lang = settingsManager.get().language;
    const title = lang === 'ru' ? 'НОВОЕ ДОСТИЖЕНИЕ!' : 'NEW ACHIEVEMENT!';
    const text = this.newAchievements.join(', ');
    const toast = this.add.text(this.cameras.main.width / 2, 150, `${title}\n${text}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffaa00',
      backgroundColor: '#000000aa',
      padding: { x: 16, y: 8 },
      align: 'center',
    }).setOrigin(0.5);
    this.time.delayedCall(3000, () => toast.destroy());
  }

  private checkWorldUnlock(): void {
    const currentWorldId = this.levelId.split('_')[0];
    const levelIds = levelManager.getLevelIdsForWorld(currentWorldId);
    const allCompleted = levelIds.every(id => progressManager.isLevelCompleted(id));
    if (allCompleted) {
      const worlds = ['meadow', 'ocean', 'clouds', 'fairytale', 'volcano', 'bonus'];
      const currentIndex = worlds.indexOf(currentWorldId);
      if (currentIndex !== -1 && currentIndex + 1 < worlds.length) {
        const nextWorldId = worlds[currentIndex + 1];
        if (!progressManager.isWorldUnlocked(nextWorldId) && !unlockManager.isWorldUnlocked(nextWorldId)) {
          progressManager.unlockWorld(nextWorldId);
          this.worldUnlocked = nextWorldId;
          this.showWorldUnlockToast(nextWorldId);
        }
      }
    }
  }

  private showWorldUnlockToast(worldId: string): void {
    const lang = settingsManager.get().language;
    const worldNames: Record<string, string> = {
      ocean: lang === 'ru' ? 'Океан' : 'Ocean',
      clouds: lang === 'ru' ? 'Облака' : 'Clouds',
      fairytale: lang === 'ru' ? 'Сказка' : 'Fairytale',
      volcano: lang === 'ru' ? 'Вулкан' : 'Volcano',
      bonus: lang === 'ru' ? 'Бонус' : 'Bonus',
    };
    const displayName = worldNames[worldId] || worldId;
    const msg = lang === 'ru'
      ? `🎉 Новый мир разблокирован: ${displayName}! 🎉`
      : `🎉 New world unlocked: ${displayName}! 🎉`;
    const toast = this.add.text(this.cameras.main.width / 2, 200, msg, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00ffcc',
      backgroundColor: '#000000aa',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    this.time.delayedCall(4000, () => toast.destroy());
  }

  private createButtons(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const lang = settingsManager.get().language;
    const nextLevelId = levelManager.getNextLevelId(this.levelId);
    const hasNext = nextLevelId !== null; // следующий уровень существует, блокировка не проверяется
    const buttonY = height - 100;
    const spacing = 200;
    const startX = width / 2 - spacing;
    const nextBtn = this.add.text(startX, buttonY, lang === 'ru' ? '▶ СЛЕДУЮЩИЙ' : '▶ NEXT', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: hasNext ? '#00ffcc' : '#888888',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
    if (hasNext) {
      nextBtn.setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => this.goToNextLevel(nextLevelId!));
      nextBtn.on('pointerover', () => nextBtn.setColor('#ffffff'));
      nextBtn.on('pointerout', () => nextBtn.setColor('#00ffcc'));
    }
    const replayBtn = this.add.text(startX + spacing, buttonY, lang === 'ru' ? '🔄 ЗАНОВО' : '🔄 REPLAY', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    replayBtn.on('pointerdown', () => this.replayLevel());
    replayBtn.on('pointerover', () => replayBtn.setColor('#00ffcc'));
    replayBtn.on('pointerout', () => replayBtn.setColor('#ffffff'));
    const menuBtn = this.add.text(startX + spacing * 2, buttonY, lang === 'ru' ? '🏠 МЕНЮ' : '🏠 MENU', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => this.goToMainMenu());
    menuBtn.on('pointerover', () => menuBtn.setColor('#00ffcc'));
    menuBtn.on('pointerout', () => menuBtn.setColor('#ffffff'));
  }

  private goToNextLevel(levelId: string): void {
    this.scene.start('GameScene', { levelId });
  }

  private replayLevel(): void {
    this.scene.start('GameScene', { levelId: this.levelId });
  }

  private goToMainMenu(): void {
    this.scene.start('MainMenu');
  }

  private playVictoryMusic(): void {
    if (settingsManager.get().musicEnabled) {
      const music = this.sound.get('victory');
      if (music) {
        music.play({ volume: settingsManager.get().musicVolume });
      }
    }
  }

  private setupEventListeners(): void {
    eventBus.on('ACHIEVEMENT_UNLOCKED', this.onAchievementUnlocked.bind(this));
  }

  private onAchievementUnlocked(payload: any): void {
    if (payload && payload.achievementId) {
      // Можно обновить список достижений, но в текущей реализации не обязательно
    }
  }

  private removeEventListeners(): void {
    eventBus.off('ACHIEVEMENT_UNLOCKED', this.onAchievementUnlocked.bind(this));
  }
}
