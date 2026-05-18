// src/scenes/Preload.ts
// Эйдо: Сцена загрузки ассетов. Отвечает за:
// - загрузку спрайтов, звуков, музыки
// - генерацию плейсхолдеров для отсутствующих текстур (canvas)
// - инъекцию CSS для UI-элементов (панель команд, сэндбокс и т.д.)
// - инициализацию менеджеров (SettingsManager, ProgressManager, SaveManager, LevelManager, UnlockManager)
// - отображение прогресса загрузки с анимацией и советами
// - обработку ошибок загрузки
// - полностью офлайн-совместима (системные шрифты, плейсхолдеры)

import { Scene } from 'phaser';
import { settingsManager } from '../managers/SettingsManager';
import { progressManager } from '../managers/ProgressManager';
import { saveManager } from '../managers/SaveManager';
import { levelManager } from '../managers/LevelManager';
import { unlockManager } from '../managers/UnlockManager';

export class Preload extends Scene {
  private progressBar: Phaser.GameObjects.Graphics;
  private progressText: Phaser.GameObjects.Text;
  private loadingText: Phaser.GameObjects.Text;
  private tipText: Phaser.GameObjects.Text;
  private logo: Phaser.GameObjects.Text;
  private tips: string[] = [];
  private tipIndex: number = 0;

  constructor() {
    super('Preload');
  }

  async init(): Promise<void> {
    // Инжектируем CSS (глобальные стили для UI)
    this.injectCSS();

    // Инициализация менеджеров (асинхронная, с ожиданием)
    try {
      await this.initManagers();
    } catch (err) {
      console.warn('[Preload] Manager initialization error:', err);
    }

    // Создаём визуальные элементы загрузки
    this.createLoadingScreen();

    // Обработчик ошибок загрузки ассетов
    this.load.on('loaderror', (file: any) => {
      console.warn(`[Preload] Failed to load ${file.key} — will use placeholder`);
    });
  }

  preload(): void {
    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });
    this.load.on('complete', () => {
      this.loadComplete();
    });

    // ---- ЗАГРУЗКА СПРАЙТОВ (пути могут отсутствовать, но плейсхолдеры сгенерируются) ----
    this.load.image('tile_platform', 'assets/tiles/platform.png');
    this.load.image('tile_sky', 'assets/tiles/sky.png');
    this.load.image('tile_hole', 'assets/tiles/hole.png');
    this.load.image('tile_brick', 'assets/tiles/brick.png');
    this.load.image('tile_wall', 'assets/tiles/wall.png');
    this.load.image('tile_fake_wall', 'assets/tiles/fake_wall.png');
    this.load.image('tile_goal', 'assets/tiles/goal.png');
    this.load.image('tile_key', 'assets/tiles/key.png');
    this.load.image('tile_door_locked', 'assets/tiles/door_locked.png');
    this.load.image('tile_door_unlocked', 'assets/tiles/door_unlocked.png');
    this.load.image('tile_conveyor_up', 'assets/tiles/conveyor_up.png');
    this.load.image('tile_conveyor_down', 'assets/tiles/conveyor_down.png');
    this.load.image('tile_conveyor_left', 'assets/tiles/conveyor_left.png');
    this.load.image('tile_conveyor_right', 'assets/tiles/conveyor_right.png');
    this.load.image('tile_spring', 'assets/tiles/spring.png');
    this.load.image('tile_teleport_in', 'assets/tiles/teleport_in.png');
    this.load.image('tile_teleport_out', 'assets/tiles/teleport_out.png');
    this.load.image('tile_lava', 'assets/tiles/lava.png');
    this.load.image('tile_water', 'assets/tiles/water.png');

    // Монстры
    this.load.image('monster_patrol', 'assets/monsters/patrol.png');
    this.load.image('monster_chase', 'assets/monsters/chase.png');
    this.load.image('monster_tameable', 'assets/monsters/tameable.png');
    this.load.image('monster_phased', 'assets/monsters/phased.png');
    this.load.image('monster_zombie', 'assets/monsters/zombie.png');
    this.load.image('monster_boss', 'assets/monsters/boss.png');

    // Игрок (спрайт-лист)
    this.load.spritesheet('player', 'assets/player/robot.png', { frameWidth: 32, frameHeight: 32 });

    // UI элементы
    this.load.image('ui_button_run', 'assets/ui/run.png');
    this.load.image('ui_button_clear', 'assets/ui/clear.png');
    this.load.image('ui_button_save', 'assets/ui/save.png');
    this.load.image('ui_button_load', 'assets/ui/load.png');

    // Звуки
    this.load.audio('move', 'assets/sounds/move.mp3');
    this.load.audio('coin', 'assets/sounds/coin.mp3');
    this.load.audio('victory', 'assets/sounds/victory.mp3');
    this.load.audio('death', 'assets/sounds/death.mp3');
    this.load.audio('click', 'assets/sounds/click.mp3');
    this.load.audio('music_menu', 'assets/music/menu.mp3');
    this.load.audio('music_meadow', 'assets/music/meadow.mp3');
    this.load.audio('music_ocean', 'assets/music/ocean.mp3');
    this.load.audio('music_clouds', 'assets/music/clouds.mp3');
    this.load.audio('music_fairytale', 'assets/music/fairytale.mp3');
    this.load.audio('music_volcano', 'assets/music/volcano.mp3');
  }

  private createLoadingScreen(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Фон
    const bg = this.add.rectangle(0, 0, width, height, 0x1a1a2e);
    bg.setOrigin(0, 0);

    this.logo = this.add.text(width / 2, height / 3, 'CYBERKID', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: this.logo,
      scale: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Прогресс-бар
    this.progressBar = this.add.graphics();
    this.progressText = this.add.text(width / 2, height / 2 + 50, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.loadingText = this.add.text(width / 2, height / 2 + 20, 'Loading...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.loadTips();
    this.tipText = this.add.text(width / 2, height - 80, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: width - 100 },
    }).setOrigin(0.5);
    this.updateTip();
  }

  private loadTips(): void {
    const lang = settingsManager.get().language;
    if (lang === 'ru') {
      this.tips = [
        'Нажми P, чтобы войти в режим исследования — можно безопасно осмотреть уровень.',
        'Используй циклы, чтобы не повторять одни и те же команды.',
        'Накорми монстра кукурузой, чтобы приручить его.',
        'Ключи открывают двери — не забывай их подбирать!',
        'В режиме Developer ты увидишь настоящий код Python и JavaScript.',
        'Звёзды даются за минимальное количество шагов.',
        'Чёрные звёзды — за находчивость и бэкдоры.',
        'Создавай свои уровни в Sandbox Maker и делись с друзьями!',
      ];
    } else {
      this.tips = [
        'Press P to enter Exploration Mode — explore levels safely.',
        'Use loops to avoid repeating commands.',
        'Feed corn to tame monsters.',
        'Keys open doors — don\'t forget to pick them up!',
        'In Developer Mode you\'ll see real Python and JavaScript code.',
        'Stars are awarded for minimal steps.',
        'Black stars are for creativity and backdoors.',
        'Create your own levels in Sandbox Maker and share with friends!',
      ];
    }
    // Перемешиваем
    for (let i = this.tips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tips[i], this.tips[j]] = [this.tips[j], this.tips[i]];
    }
  }

  private updateTip(): void {
    if (this.tips.length === 0) return;
    this.tipText.setText(`💡 ${this.tips[this.tipIndex % this.tips.length]}`);
    this.tipIndex++;
    this.time.delayedCall(5000, () => this.updateTip(), [], this);
  }

  private updateProgress(value: number): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const percent = Math.floor(value * 100);

    if (!this.progressBar) return;
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ffcc, 1);
    this.progressBar.fillRect(width / 2 - 200, height / 2, 400 * value, 20);
    if (this.progressText) this.progressText.setText(`${percent}%`);
  }

  private async initManagers(): Promise<void> {
    await levelManager.initialize();
    await unlockManager.initialize();
  }

  private loadComplete(): void {
    this.generatePlaceholders();
    this.initPlayerAnimations();
    this.scene.start('MainMenu');
  }

  private generatePlaceholders(): void {
    const textureManager = this.textures;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const ensureTexture = (key: string, drawFunc: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, width = 32, height = 32) => {
      if (textureManager.exists(key)) return;
      canvas.width = width;
      canvas.height = height;
      drawFunc(ctx, width, height);
      textureManager.addImage(key, canvas);
    };

    ensureTexture('tile_platform', (ctx, w, h) => {
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#5A3A1A';
      ctx.strokeRect(0, 0, w, h);
    });
    ensureTexture('tile_wall', (ctx, w, h) => {
      ctx.fillStyle = '#555';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#333';
      for (let i = 0; i < 3; i++) ctx.fillRect(i * 8, 0, 4, h);
    });
    ensureTexture('tile_goal', (ctx, w, h) => {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFA500';
      ctx.fillRect(w/4, h/4, w/2, h/2);
    });
    ensureTexture('tile_key', (ctx, w, h) => {
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(w/3, h/3, w/3, h/3);
      ctx.fillStyle = '#B8860B';
      ctx.fillRect(w/2, h/4, w/8, h/2);
    });
    ensureTexture('monster_patrol', (ctx, w, h) => {
      ctx.fillStyle = '#8B008B';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FF69B4';
      ctx.fillRect(w/4, h/4, w/2, h/2);
    });
    ensureTexture('monster_chase', (ctx, w, h) => {
      ctx.fillStyle = '#DC143C';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FF4500';
      ctx.fillRect(w/4, h/4, w/2, h/2);
    });
    ensureTexture('monster_tameable', (ctx, w, h) => {
      ctx.fillStyle = '#228B22';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#98FB98';
      ctx.fillRect(w/4, h/4, w/2, h/2);
    });

    if (!textureManager.exists('player')) {
      const frameCount = 12;
      const frameW = 32, frameH = 32;
      canvas.width = frameW * frameCount;
      canvas.height = frameH;
      for (let i = 0; i < frameCount; i++) {
        ctx.fillStyle = i < 4 ? '#00BFFF' : (i < 8 ? '#1E90FF' : '#FF4500');
        ctx.fillRect(i * frameW, 0, frameW, frameH);
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(i * frameW + frameW/4, frameH/4, frameW/2, frameH/2);
      }
      textureManager.addSpriteSheet('player', canvas, { frameWidth: frameW, frameHeight: frameH });
    }

    ensureTexture('ui_button_run', (ctx, w, h) => {
      ctx.fillStyle = '#00AA00';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(w/3, h/3, w/3, h/3);
    });
    ensureTexture('ui_button_clear', (ctx, w, h) => {
      ctx.fillStyle = '#AA0000';
      ctx.fillRect(0, 0, w, h);
    });

    const soundKeys = ['move', 'coin', 'victory', 'death', 'click', 'music_menu', 'music_meadow', 'music_ocean', 'music_clouds', 'music_fairytale', 'music_volcano'];
    for (const key of soundKeys) {
      if (!this.cache.audio.exists(key)) {
        this.sound.add(key, { volume: 0 });
      }
    }
  }

  private initPlayerAnimations(): void {
    const anims = this.anims;
    if (!this.textures.exists('player')) return;
    const frameTotal = this.textures.get('player').frameTotal;
    if (frameTotal < 4) return;

    if (!anims.exists('player_idle')) {
      anims.create({
        key: 'player_idle',
        frames: anims.generateFrameNumbers('player', { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1,
      });
    }
    if (!anims.exists('player_walk')) {
      anims.create({
        key: 'player_walk',
        frames: anims.generateFrameNumbers('player', { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!anims.exists('player_death')) {
      anims.create({
        key: 'player_death',
        frames: anims.generateFrameNumbers('player', { start: 8, end: 11 }),
        frameRate: 6,
        repeat: 0,
      });
    }
  }

  private injectCSS(): void {
    if (document.getElementById('cyberkid-styles')) return;
    const style = document.createElement('style');
    style.id = 'cyberkid-styles';
    style.textContent = `
      .command-panel {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        height: 200px;
        background: rgba(0,0,0,0.85);
        border-radius: 12px;
        display: flex;
        gap: 10px;
        padding: 10px;
        z-index: 1000;
        backdrop-filter: blur(8px);
        font-family: Arial, sans-serif;
      }
      .panel-left, .panel-right {
        background: #2d2d2d;
        border-radius: 8px;
        padding: 8px;
        overflow-y: auto;
      }
      .panel-left { flex: 1; }
      .panel-right { flex: 2; }
      .commands-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .command-btn {
        background: #3a3a3a;
        border: none;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: 0.1s;
      }
      .command-btn:active { transform: scale(0.95); }
      .script-item {
        background: #1e1e1e;
        margin: 4px 0;
        padding: 6px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: move;
      }
      .script-delete {
        background: #d9534f;
        border: none;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        margin-left: auto;
      }
      .sandbox-maker {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #1a1a1a;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow: auto;
      }
      .sandbox-canvas-area canvas {
        border: 2px solid #555;
        cursor: crosshair;
      }
      .sandbox-hint {
        color: #aaa;
        font-size: 12px;
        margin-top: 8px;
      }
      .toast {
        position: fixed;
        bottom: 230px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: #ffcc00;
        padding: 8px 16px;
        border-radius: 20px;
        font-family: Arial, sans-serif;
        z-index: 1100;
        pointer-events: none;
        animation: fadeOut 3s forwards;
      }
      @keyframes fadeOut {
        0% { opacity: 1; }
        70% { opacity: 1; }
        100% { opacity: 0; visibility: hidden; }
      }
    `;
    document.head.appendChild(style);
  }
}
