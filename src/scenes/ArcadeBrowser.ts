// src/scenes/ArcadeBrowser.ts
// Эйдо: Браузер пользовательских уровней (Arcade). Вкладки: Featured, New, Top Rated, My Levels.
// Отображение уровней в виде карточек с заголовком, автором, звёздами, лайками, сложностью.
// Поиск, фильтрация по сложности, пагинация. При выборе уровня — запуск GameScene с передачей LevelData.
// Уровни хранятся локально (localStorage) в MVP, но готово к интеграции с удалённым API.

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';
import { LevelData, TileType, Point } from '../types/index';

interface ArcadeLevelMeta {
  id: string;
  title: string;
  author: string;
  createdAt: number;
  plays: number;
  likes: number;
  stars: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  levelData: LevelData;
}

type ArcadeTab = 'featured' | 'new' | 'top' | 'my';

export class ArcadeBrowser extends Scene {
  private currentTab: ArcadeTab = 'featured';
  private levels: ArcadeLevelMeta[] = [];
  private filteredLevels: ArcadeLevelMeta[] = [];
  private currentPage: number = 0;
  private levelsPerPage: number = 6;
  private tabButtons: Map<ArcadeTab, Phaser.GameObjects.Text> = new Map();
  private contentContainer: Phaser.GameObjects.Container;
  private searchInput: HTMLInputElement;
  private searchContainer: HTMLDivElement;
  private difficultyFilter: 'all' | 'easy' | 'medium' | 'hard' = 'all';
  private difficultyButtons: Map<string, Phaser.GameObjects.Text> = new Map();
  private lang: 'ru' | 'en' = 'en';
  private keyboardHandler: (e: KeyboardEvent) => void;

  constructor() {
    super('ArcadeBrowser');
  }

  create(): void {
    this.lang = settingsManager.get().language;
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createSearchAndFilter();
    this.createDifficultyFilterUI();
    this.createContentContainer();
    this.loadLevels();
    this.renderLevels();
    this.createBottomButtons();
    this.setupEventListeners();
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
    const title = this.add.text(width / 2, 40, this.lang === 'ru' ? 'АРКАДА (UGC)' : 'ARCADE (UGC)', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#00ffcc',
      stroke: '#0066ff',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }

  private createTabs(): void {
    const width = this.cameras.main.width;
    const tabs: { id: ArcadeTab; labelRu: string; labelEn: string }[] = [
      { id: 'featured', labelRu: 'ПОПУЛЯРНОЕ', labelEn: 'FEATURED' },
      { id: 'new', labelRu: 'НОВЫЕ', labelEn: 'NEW' },
      { id: 'top', labelRu: 'ТОП', labelEn: 'TOP RATED' },
      { id: 'my', labelRu: 'МОИ', labelEn: 'MY LEVELS' },
    ];
    const startX = width / 2 - 250;
    const spacing = 160;
    tabs.forEach((tab, idx) => {
      const x = startX + idx * spacing;
      const btn = this.add.text(x, 90, this.lang === 'ru' ? tab.labelRu : tab.labelEn, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#aaaaaa',
        backgroundColor: '#2a2a4a',
        padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.switchTab(tab.id));
      this.tabButtons.set(tab.id, btn);
    });
    this.highlightTab();
  }

  private createSearchAndFilter(): void {
    this.searchContainer = document.createElement('div');
    this.searchContainer.style.position = 'absolute';
    this.searchContainer.style.top = '140px';
    this.searchContainer.style.left = '20px';
    this.searchContainer.style.right = '20px';
    this.searchContainer.style.display = 'flex';
    this.searchContainer.style.gap = '10px';
    this.searchContainer.style.zIndex = '1000';
    this.searchInput = document.createElement('input');
    this.searchInput.placeholder = this.lang === 'ru' ? 'Поиск по названию...' : 'Search by title...';
    this.searchInput.style.flex = '1';
    this.searchInput.style.padding = '8px';
    this.searchInput.style.fontSize = '14px';
    this.searchInput.style.background = '#2a2a4a';
    this.searchInput.style.color = '#fff';
    this.searchInput.style.border = '1px solid #00ffcc';
    this.searchInput.style.borderRadius = '4px';
    this.searchInput.addEventListener('input', () => this.filterLevels());
    this.searchContainer.appendChild(this.searchInput);
    document.body.appendChild(this.searchContainer);
    this.keyboardHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.searchInput.value = '';
        this.filterLevels();
      }
    };
    window.addEventListener('keydown', this.keyboardHandler);
  }

  private createDifficultyFilterUI(): void {
    const width = this.cameras.main.width;
    const startX = width - 300;
    const y = 140;
    const filters = [
      { id: 'all', label: this.lang === 'ru' ? 'Все' : 'All', color: '#ffffff' },
      { id: 'easy', label: this.lang === 'ru' ? 'Лёгкие' : 'Easy', color: '#00ff00' },
      { id: 'medium', label: this.lang === 'ru' ? 'Средние' : 'Medium', color: '#ffaa00' },
      { id: 'hard', label: this.lang === 'ru' ? 'Сложные' : 'Hard', color: '#ff4444' },
    ];
    filters.forEach((filter, idx) => {
      const x = startX + idx * 70;
      const btn = this.add.text(x, y, filter.label, {
        fontSize: '14px',
        color: filter.color,
        backgroundColor: '#2a2a4a',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        this.difficultyFilter = filter.id as any;
        this.filterLevels();
        this.highlightDifficultyFilter();
      });
      this.difficultyButtons.set(filter.id, btn);
    });
    this.highlightDifficultyFilter();
  }

  private highlightDifficultyFilter(): void {
    for (const [id, btn] of this.difficultyButtons) {
      if (id === this.difficultyFilter) {
        btn.setBackgroundColor('#3a3a6a');
        btn.setColor('#00ffcc');
      } else {
        btn.setBackgroundColor('#2a2a4a');
        btn.setColor(id === 'all' ? '#ffffff' : (id === 'easy' ? '#00ff00' : (id === 'medium' ? '#ffaa00' : '#ff4444')));
      }
    }
  }

  private createContentContainer(): void {
    this.contentContainer = this.add.container(0, 0);
  }

  private loadLevels(): void {
    this.levels = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arcade_')) {
        try {
          const levelData = JSON.parse(localStorage.getItem(key)!) as LevelData;
          const meta: ArcadeLevelMeta = {
            id: levelData.id,
            title: levelData.name,
            author: 'User',
            createdAt: parseInt(levelData.id.split('_')[2] || Date.now().toString()),
            plays: Math.floor(Math.random() * 100),
            likes: Math.floor(Math.random() * 50),
            stars: Math.floor(Math.random() * 4),
            difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] as any,
            tags: [],
            levelData: levelData,
          };
          this.levels.push(meta);
        } catch (e) {}
      }
    }
    if (this.levels.length === 0) {
      this.levels.push(this.createDemoLevel());
    }
    this.applyTabFilter();
  }

  private createDemoLevel(): ArcadeLevelMeta {
    // Создаём полноценный демо-уровень
    const width = 5, height = 5;
    const grid = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
    grid[0][0] = TileType.START;
    grid[4][4] = TileType.GOAL;
    const demoLevel: LevelData = {
      id: 'demo_001',
      name: 'Demo Level',
      description: 'A simple demo level',
      worldId: 'arcade',
      levelNumber: 1,
      width,
      height,
      map: grid,
      objects: {
        holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
        springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
        corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
        clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
      },
      startPos: { col: 0, row: 0 },
      coinPos: { col: 4, row: 4 },
      optimalSteps: 8,
      solutions: { easy: { steps: 10, commands: [] }, mid: { steps: 8, commands: [] }, hard: { steps: 8, commands: [] }, backdoor: null },
      isTutorial: false,
      explorationPenalty: false,
    };
    return {
      id: 'demo_001',
      title: 'Demo Level',
      author: 'CyberKid',
      createdAt: Date.now(),
      plays: 42,
      likes: 7,
      stars: 3,
      difficulty: 'easy',
      tags: ['tutorial'],
      levelData: demoLevel,
    };
  }

  private applyTabFilter(): void {
    let filtered = [...this.levels];
    switch (this.currentTab) {
      case 'featured':
        filtered = filtered.sort((a, b) => b.likes - a.likes).slice(0, 20);
        break;
      case 'new':
        filtered = filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'top':
        filtered = filtered.sort((a, b) => b.stars - a.stars);
        break;
      case 'my':
        filtered = filtered.filter(l => l.author === 'User');
        break;
    }
    this.filteredLevels = filtered;
    this.currentPage = 0;
    this.filterLevels();
  }

  private filterLevels(): void {
    const searchTerm = this.searchInput.value.toLowerCase();
    let filtered = [...this.filteredLevels];
    if (searchTerm) {
      filtered = filtered.filter(l => l.title.toLowerCase().includes(searchTerm));
    }
    if (this.difficultyFilter !== 'all') {
      filtered = filtered.filter(l => l.difficulty === this.difficultyFilter);
    }
    this.filteredLevels = filtered;
    this.currentPage = 0;
    this.renderLevels();
  }

  private renderLevels(): void {
    this.contentContainer.removeAll(true);
    const start = this.currentPage * this.levelsPerPage;
    const end = start + this.levelsPerPage;
    const pageLevels = this.filteredLevels.slice(start, end);
    const cols = 2;
    const startX = 100;
    const startY = 200;
    const cardW = 280;
    const cardH = 160;
    const spacingX = 40;
    const spacingY = 30;
    for (let i = 0; i < pageLevels.length; i++) {
      const level = pageLevels[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + spacingX);
      const y = startY + row * (cardH + spacingY);
      this.createLevelCard(x, y, level);
    }
    const totalPages = Math.ceil(this.filteredLevels.length / this.levelsPerPage);
    if (totalPages > 1) {
      const prevBtn = this.add.text(100, 550, this.lang === 'ru' ? '◀ НАЗАД' : '◀ PREV', { fontSize: '16px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 12, y: 6 } }).setInteractive({ useHandCursor: true });
      prevBtn.on('pointerdown', () => { if (this.currentPage > 0) { this.currentPage--; this.renderLevels(); } });
      const nextBtn = this.add.text(250, 550, this.lang === 'ru' ? 'ВПЕРЁД ▶' : 'NEXT ▶', { fontSize: '16px', color: '#ffffff', backgroundColor: '#2a2a4a', padding: { x: 12, y: 6 } }).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => { if (this.currentPage + 1 < totalPages) { this.currentPage++; this.renderLevels(); } });
      const pageText = this.add.text(180, 550, `${this.currentPage + 1}/${totalPages}`, { fontSize: '14px', color: '#cccccc' });
      this.contentContainer.add([prevBtn, nextBtn, pageText]);
    }
  }

  private createLevelCard(x: number, y: number, level: ArcadeLevelMeta): void {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 280, 160, 0x2a2a4a, 0.9);
    bg.setStrokeStyle(2, 0x00ffcc);
    const title = this.add.text(10, 10, level.title, { fontSize: '18px', color: '#ffffff', fontFamily: 'monospace' });
    const author = this.add.text(10, 40, `${this.lang === 'ru' ? 'Автор:' : 'By:'} ${level.author}`, { fontSize: '12px', color: '#aaaaaa' });
    const stars = this.add.text(10, 65, '★'.repeat(level.stars) + '☆'.repeat(3 - level.stars), { fontSize: '14px', color: '#ffcc00' });
    const plays = this.add.text(10, 90, `👤 ${level.plays}`, { fontSize: '12px', color: '#cccccc' });
    const likes = this.add.text(100, 90, `❤️ ${level.likes}`, { fontSize: '12px', color: '#ff8888' });
    const difficultyText = this.lang === 'ru'
      ? (level.difficulty === 'easy' ? 'Лёгкая' : level.difficulty === 'medium' ? 'Средняя' : 'Сложная')
      : level.difficulty;
    const difficultyColor = level.difficulty === 'easy' ? '#00ff00' : level.difficulty === 'medium' ? '#ffaa00' : '#ff4444';
    const difficulty = this.add.text(10, 115, `${this.lang === 'ru' ? 'Сложность:' : 'Difficulty:'} ${difficultyText}`, { fontSize: '12px', color: difficultyColor });
    const playBtn = this.add.text(220, 130, '▶ PLAY', { fontSize: '14px', color: '#00ffcc', backgroundColor: '#1a1a3a', padding: { x: 8, y: 4 } }).setInteractive({ useHandCursor: true });
    playBtn.on('pointerdown', () => this.playLevel(level));
    container.add([bg, title, author, stars, plays, likes, difficulty, playBtn]);
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, 280, 160), Phaser.Geom.Rectangle.Contains);
    this.contentContainer.add(container);
  }

  private playLevel(level: ArcadeLevelMeta): void {
    // Передаём полный LevelData в GameScene
    this.scene.start('GameScene', { levelData: level.levelData });
  }

  private switchTab(tab: ArcadeTab): void {
    this.currentTab = tab;
    this.highlightTab();
    this.applyTabFilter();
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

  private createBottomButtons(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const backBtn = this.add.text(50, height - 40, this.lang === 'ru' ? '← НАЗАД' : '← BACK', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('WorldMap'));
    backBtn.on('pointerover', () => backBtn.setColor('#00ffcc'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
  }

  private setupEventListeners(): void {
    eventBus.on('ARCADE_LEVEL_PUBLISH', () => {
      this.loadLevels();
      this.switchTab('my');
    });
  }

  private cleanup(): void {
    eventBus.off('ARCADE_LEVEL_PUBLISH');
    if (this.searchContainer && this.searchContainer.parentNode) {
      this.searchContainer.parentNode.removeChild(this.searchContainer);
    }
    if (this.keyboardHandler) {
      window.removeEventListener('keydown', this.keyboardHandler);
    }
  }
}
