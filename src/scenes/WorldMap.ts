// src/scenes/WorldMap.ts
// Эйдо: Карта выбора миров. Миры расположены по кругу, отображаются иконки,
// количество звёзд, блокировка (замок) для премиум-миров. При клике на заблокированный мир
// открывается Paywall сценой. При клике на разблокированный — переход в LevelSelect.
// Подписывается на событие PROGRESS_UPDATED для обновления звёзд в реальном времени.

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from '../managers/ProgressManager';
import { levelManager } from '../managers/LevelManager';
import { unlockManager } from '../managers/UnlockManager';
import { settingsManager } from '../managers/SettingsManager';

interface WorldNode {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  color: number;
  x: number;
  y: number;
  angle: number;
  starsEarned: number;
  starsTotal: number;
  isLocked: boolean;
  priceSku?: string;
  levelsCount: number;
  container: Phaser.GameObjects.Container;
  starsText: Phaser.GameObjects.Text;
}

export class WorldMap extends Scene {
  private worlds: WorldNode[] = [];
  private nodesGroup: Phaser.GameObjects.Group;
  private connections: Phaser.GameObjects.Graphics;
  private selectedWorldId: string | null = null;
  private infoPanel: Phaser.GameObjects.Container;
  private playButton: Phaser.GameObjects.Text;
  private starsText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private centerX: number;
  private centerY: number;
  private radius: number = 220;
  private floatingTweens: Map<string, Phaser.Tweens.Tween> = new Map();

  constructor() {
    super('WorldMap');
  }

  init(): void {
    this.centerX = this.cameras.main.width / 2;
    this.centerY = this.cameras.main.height / 2;
    this.nodesGroup = this.add.group();
    this.connections = this.add.graphics();
  }

  create(): void {
    this.createBackground();
    this.loadWorlds();
    this.drawConnections();
    this.createWorldNodes();
    this.createInfoPanel();
    this.createBottomNav();
    this.playBackgroundMusic();
    this.setupEventListeners();
  }

  private createBackground(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);
    for (let i = 0; i < 150; i++) {
      const star = this.add.circle(Math.random() * width, Math.random() * height, Math.random() * 2 + 1, 0xffffff, 0.4 + Math.random() * 0.6);
      this.tweens.add({
        targets: star,
        alpha: 0.2,
        duration: 1000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private loadWorlds(): void {
    const lang = settingsManager.get().language;
    const worldDefinitions = [
      { id: 'meadow', name: lang === 'ru' ? 'Луг' : 'Meadow', nameEn: 'Meadow', icon: '🌾', color: 0x6aab5a, levelsCount: 500, isLocked: false },
      { id: 'ocean', name: lang === 'ru' ? 'Океан' : 'Ocean', nameEn: 'Ocean', icon: '🌊', color: 0x3a6ea5, levelsCount: 500, isLocked: true, priceSku: 'world_ocean' },
      { id: 'clouds', name: lang === 'ru' ? 'Облака' : 'Clouds', nameEn: 'Clouds', icon: '☁️', color: 0x8ca0d0, levelsCount: 500, isLocked: true, priceSku: 'world_clouds' },
      { id: 'fairytale', name: lang === 'ru' ? 'Сказка' : 'Fairytale', nameEn: 'Fairytale', icon: '🏰', color: 0xc96f3e, levelsCount: 500, isLocked: true, priceSku: 'world_fairytale' },
      { id: 'volcano', name: lang === 'ru' ? 'Вулкан' : 'Volcano', nameEn: 'Volcano', icon: '🌋', color: 0xcc5533, levelsCount: 500, isLocked: true, priceSku: 'world_volcano' },
      { id: 'arcade', name: lang === 'ru' ? 'Аркада' : 'Arcade', nameEn: 'Arcade', icon: '🎮', color: 0xaa66cc, levelsCount: Infinity, isLocked: false },
      { id: 'bonus', name: lang === 'ru' ? 'Бонус' : 'Bonus', nameEn: 'Bonus', icon: '⭐', color: 0xffaa44, levelsCount: 3000, isLocked: true, priceSku: 'world_bonus' },
    ];

    const angles = [0, 51.4, 102.8, 154.2, 205.6, 257, 308.4].map(deg => deg * Math.PI / 180);
    this.worlds = worldDefinitions.map((def, idx) => {
      const angle = angles[idx % angles.length];
      const x = this.centerX + this.radius * Math.cos(angle);
      const y = this.centerY + this.radius * Math.sin(angle);
      const starsTotal = def.levelsCount === Infinity ? 0 : def.levelsCount * 3;
      const starsEarned = this.computeStarsForWorld(def.id);
      const isLocked = def.isLocked && !progressManager.isWorldUnlocked(def.id) && !unlockManager.isWorldUnlocked(def.id);
      return {
        id: def.id,
        name: def.name,
        nameEn: def.nameEn,
        icon: def.icon,
        color: def.color,
        x, y,
        angle,
        starsEarned,
        starsTotal,
        isLocked,
        priceSku: def.priceSku,
        levelsCount: def.levelsCount,
        container: null as any,
        starsText: null as any,
      };
    });
  }

  private computeStarsForWorld(worldId: string): number {
    const levelIds = levelManager.getLevelIdsForWorld(worldId);
    const levelStats = progressManager.get().levelStats;
    let totalStars = 0;
    for (const levelId of levelIds) {
      const stats = levelStats[levelId];
      if (stats) totalStars += stats.stars;
    }
    return totalStars;
  }

  private updateWorldStars(): void {
    for (const world of this.worlds) {
      const newStars = this.computeStarsForWorld(world.id);
      if (newStars !== world.starsEarned) {
        world.starsEarned = newStars;
        if (world.starsText) {
          const starPercent = world.starsTotal > 0 ? (world.starsEarned / world.starsTotal) : 0;
          const starCount = Math.floor(starPercent * 3);
          world.starsText.setText('★'.repeat(starCount) + '☆'.repeat(3 - starCount));
        }
      }
    }
    if (this.selectedWorldId) {
      const selected = this.worlds.find(w => w.id === this.selectedWorldId);
      if (selected) this.showWorldInfo(selected);
    }
  }

  private drawConnections(): void {
    this.connections.clear();
    this.connections.lineStyle(3, 0x88aaff, 0.4);
    for (let i = 0; i < this.worlds.length; i++) {
      const next = (i + 1) % this.worlds.length;
      const from = this.worlds[i];
      const to = this.worlds[next];
      this.connections.beginPath();
      this.connections.moveTo(from.x, from.y);
      this.connections.lineTo(to.x, to.y);
      this.connections.strokePath();
    }
  }

  private createWorldNodes(): void {
    this.worlds.forEach(world => {
      const container = this.add.container(world.x, world.y);
      const circle = this.add.circle(0, 0, 45, world.color, 0.9);
      circle.setStrokeStyle(3, 0xffffff, 0.8);
      const iconText = this.add.text(0, -10, world.icon, { fontSize: '32px' }).setOrigin(0.5);
      const nameText = this.add.text(0, 25, world.name, { fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(0.5);
      let lockIcon: Phaser.GameObjects.Text | null = null;
      if (world.isLocked) {
        lockIcon = this.add.text(0, -15, '🔒', { fontSize: '24px' }).setOrigin(0.5);
      }
      const starPercent = world.starsTotal > 0 ? (world.starsEarned / world.starsTotal) : 0;
      const starCount = Math.floor(starPercent * 3);
      const starsText = this.add.text(0, 50, '★'.repeat(starCount) + '☆'.repeat(3 - starCount), { fontSize: '12px', color: '#ffcc00' }).setOrigin(0.5);
      container.add([circle, iconText, nameText, starsText]);
      if (lockIcon) container.add(lockIcon);
      const tween = this.tweens.add({
        targets: container,
        y: container.y - 8,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.floatingTweens.set(world.id, tween);
      circle.setInteractive({ useHandCursor: true });
      circle.on('pointerover', () => {
        circle.setScale(1.05);
        this.showWorldInfo(world);
      });
      circle.on('pointerout', () => {
        circle.setScale(1);
      });
      circle.on('pointerdown', () => {
        this.selectWorld(world);
      });
      this.nodesGroup.add(container);
      world.container = container;
      world.starsText = starsText;
    });
  }

  private createInfoPanel(): void {
    const width = this.cameras.main.width;
    const panelBg = this.add.rectangle(width - 220, 120, 200, 180, 0x000000, 0.7);
    panelBg.setOrigin(0.5);
    panelBg.setStrokeStyle(2, 0x00ffcc);
    this.infoPanel = this.add.container(width - 220, 120);
    this.infoPanel.add(panelBg);
    this.descriptionText = this.add.text(0, -60, '', { fontSize: '16px', color: '#ffffff', fontFamily: 'monospace', align: 'center', wordWrap: { width: 180 } }).setOrigin(0.5);
    this.starsText = this.add.text(0, -10, '', { fontSize: '14px', color: '#ffcc00' }).setOrigin(0.5);
    this.playButton = this.add.text(0, 50, '▶ PLAY', { fontSize: '18px', color: '#00ffcc', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.playButton.on('pointerdown', () => {
      if (this.selectedWorldId) {
        this.startWorld(this.selectedWorldId);
      }
    });
    this.infoPanel.add([this.descriptionText, this.starsText, this.playButton]);
    this.infoPanel.setVisible(false);
  }

  private createBottomNav(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const backBtn = this.add.text(50, height - 40, '← BACK', { fontSize: '20px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MainMenu'));
    const settingsBtn = this.add.text(width - 150, height - 40, '⚙️ SETTINGS', { fontSize: '20px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerdown', () => this.scene.start('Settings'));
    const statsBtn = this.add.text(width - 300, height - 40, '📊 STATS', { fontSize: '20px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 16, y: 6 } }).setInteractive({ useHandCursor: true });
    statsBtn.on('pointerdown', () => this.scene.start('Stats'));
  }

  private showWorldInfo(world: WorldNode): void {
    const lang = settingsManager.get().language;
    const description = lang === 'ru' ? this.getWorldDescriptionRu(world.id) : this.getWorldDescriptionEn(world.id);
    this.descriptionText.setText(description);
    if (world.starsTotal > 0) {
      this.starsText.setText(`${world.starsEarned} / ${world.starsTotal} ★`);
    } else {
      this.starsText.setText('∞');
    }
    this.playButton.setVisible(!world.isLocked);
    this.infoPanel.setVisible(true);
    // Не меняем selectedWorldId при наведении, только при клике
  }

  private getWorldDescriptionRu(id: string): string {
    const map: Record<string, string> = {
      meadow: 'Начальный мир. Учись двигаться и собирать монеты.',
      ocean: 'Стены, конвейеры, пружины. Освой условия.',
      clouds: 'Крылья, телепорты, функции. Поднимись в небо.',
      fairytale: 'Ключи, двери, сортировщики. Логика и ресурсы.',
      volcano: 'Монстры, клонирование, ООП. Брось вызов!',
      arcade: 'Пользовательские уровни. Бесконечное творчество.',
      bonus: 'Секретные уровни для настоящих мастеров.',
    };
    return map[id] || 'Новый мир';
  }

  private getWorldDescriptionEn(id: string): string {
    const map: Record<string, string> = {
      meadow: 'Start here. Learn to move and collect coins.',
      ocean: 'Walls, conveyors, springs. Master conditions.',
      clouds: 'Wings, teleports, functions. Reach the sky.',
      fairytale: 'Keys, doors, sorters. Logic and resources.',
      volcano: 'Monsters, cloning, OOP. Ultimate challenge!',
      arcade: 'User-generated levels. Infinite creativity.',
      bonus: 'Secret levels for true masters.',
    };
    return map[id] || 'New world';
  }

  private selectWorld(world: WorldNode): void {
    this.selectedWorldId = world.id;
    if (world.isLocked) {
      this.scene.start('Paywall', { worldId: world.id, sku: world.priceSku });
    } else {
      this.showWorldInfo(world);
    }
  }

  private startWorld(worldId: string): void {
    this.scene.start('LevelSelect', { worldId, levelNum: 1 });
  }

  private playBackgroundMusic(): void {
    if (settingsManager.get().musicEnabled) {
      const music = this.sound.get('music_menu');
      if (music) {
        music.play({ volume: settingsManager.get().musicVolume, loop: true });
      }
    }
  }

  private setupEventListeners(): void {
    eventBus.on('PROGRESS_UPDATED', () => {
      this.updateWorldStars();
    });
  }

  private removeEventListeners(): void {
    eventBus.off('PROGRESS_UPDATED');
  }
}
