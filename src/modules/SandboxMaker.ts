// src/modules/SandboxMaker.ts
// Эйдо: Визуальный редактор уровней (Sandbox Maker).
// Палитра тайлов и объектов, рисование кликом/перетаскиванием,
// стирание правой кнопкой, горячие клавиши S (установить старт) и C (установить цель),
// изменение размера сетки (5x5 до 20x20), сохранение в localStorage,
// публикация (метка ready для Arcade), экспорт/импорт JSON, тестирование.
// Отображение сетки, подтверждение очистки.

import { LevelData, TileType, Point, MonsterType, Command } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

export type EditorMode = 'tile' | 'object';

export interface SandboxState {
  level: LevelData;
  selectedTile: TileType;
  selectedObject: string;
  mode: EditorMode;
  gridSizePx: number;
  showGrid: boolean;
}

export class SandboxMaker {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: SandboxState;
  private isDrawing: boolean = false;
  private lastCell: Point | null = null;
  private lastCursorCell: Point | null = null;
  private levelNameInput: HTMLInputElement;
  private widthInput: HTMLInputElement;
  private heightInput: HTMLInputElement;
  private exportBtn: HTMLButtonElement;
  private importBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private publishBtn: HTMLButtonElement;
  private testBtn: HTMLButtonElement;
  private tilePalette: HTMLDivElement;
  private objectPalette: HTMLDivElement;
  private modeToggle: HTMLDivElement;
  private clearBtn: HTMLButtonElement;

  private readonly TILE_ICONS: Record<TileType, string> = {
    [TileType.PLATFORM]: '⬜',
    [TileType.SKY]: '🌫️',
    [TileType.HOLE]: '🕳️',
    [TileType.BRICK]: '🧱',
    [TileType.WALL]: '🧱🧱',
    [TileType.FAKE_WALL]: '❓',
    [TileType.LADDER]: '🪜',
    [TileType.GOAL]: '💰',
    [TileType.START]: '🚀',
    [TileType.KEY]: '🔑',
    [TileType.DOOR_LOCKED]: '🚪🔒',
    [TileType.DOOR_UNLOCKED]: '🚪🔓',
    [TileType.CORN]: '🌽',
    [TileType.CORE]: '💎',
    [TileType.TOOL_DRILL]: '🔧',
    [TileType.TOOL_HOOK]: '🪝',
    [TileType.TOOL_WING]: '🪽',
    [TileType.TOOL_BAIT]: '🐟',
    [TileType.CONVEYOR_UP]: '⬆️',
    [TileType.CONVEYOR_DOWN]: '⬇️',
    [TileType.CONVEYOR_LEFT]: '⬅️',
    [TileType.CONVEYOR_RIGHT]: '➡️',
    [TileType.SPRING]: '⬆️⬆️',
    [TileType.TELEPORT_IN]: '🌀',
    [TileType.TELEPORT_OUT]: '🌀',
    [TileType.BLACK_BOX]: '📦',
    [TileType.SENSOR]: '📡',
    [TileType.LEVER]: '🎚️',
    [TileType.BUTTON]: '🔘',
    [TileType.TIMER]: '⏲️',
    [TileType.SORTER]: '📊',
    [TileType.LAVA]: '🌋',
    [TileType.WATER]: '💧',
    [TileType.BRIDGE]: '🌉',
    [TileType.BRIDGE_ACTIVE]: '🌉✅',
    [TileType.ROCKET]: '🚀',
    [TileType.MIRROR]: '🪞',
    [TileType.CLONE_POINT]: '👥',
    [TileType.RIDE_POINT]: '🐎',
    [TileType.NEURO_STAB]: '🧠',
  };

  private readonly OBJECT_TYPES = [
    { id: 'key', label: '🔑 Key', type: 'key' },
    { id: 'drill', label: '🔧 Drill', type: 'drill' },
    { id: 'hook', label: '🪝 Hook', type: 'hook' },
    { id: 'wing', label: '🪽 Wing', type: 'wing' },
    { id: 'bait', label: '🐟 Bait', type: 'bait' },
    { id: 'corn', label: '🌽 Corn', type: 'corn' },
    { id: 'core', label: '💎 Core', type: 'core' },
    { id: 'monster_patrol', label: '👾 Patrol Monster', type: 'monster_patrol' },
    { id: 'monster_chase', label: '👾 Chase Monster', type: 'monster_chase' },
    { id: 'monster_tameable', label: '👾 Tameable Monster', type: 'monster_tameable' },
    { id: 'door_locked', label: '🚪 Locked Door', type: 'door' },
  ];

  constructor() {
    this.initDOM();
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.container.appendChild(this.canvas);
    this.state = this.getDefaultState();
    this.attachEvents();
    this.render();
  }

  public show(): void {
    this.container.style.display = 'flex';
    this.render();
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  public destroy(): void {
    if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
  }

  private initDOM(): void {
    this.container = document.createElement('div');
    this.container.className = 'sandbox-maker';
    this.container.innerHTML = `
      <div class="sandbox-header">
        <input type="text" id="level-name" placeholder="Level Name" value="My Level">
        <label>Width: <input type="number" id="level-width" min="5" max="20" value="10"></label>
        <label>Height: <input type="number" id="level-height" min="5" max="20" value="10"></label>
        <button id="resize-btn">Resize</button>
        <button id="clear-level-btn" style="background:#d9534f;">Clear Level</button>
      </div>
      <div class="sandbox-mode-toggle">
        <button id="mode-tile" class="active">Tile Mode</button>
        <button id="mode-object">Object Mode</button>
      </div>
      <div class="sandbox-palettes">
        <div class="tile-palette" id="tile-palette"></div>
        <div class="object-palette" id="object-palette" style="display:none"></div>
      </div>
      <div class="sandbox-canvas-area">
        <canvas id="sandbox-canvas" width="600" height="600"></canvas>
        <div class="sandbox-hint">Left click: paint | Right click: erase | S: set start | C: set coin</div>
      </div>
      <div class="sandbox-actions">
        <button id="export-btn">Export JSON</button>
        <button id="import-btn">Import JSON</button>
        <button id="save-btn">Save to Local</button>
        <button id="publish-btn">Publish (Arcade)</button>
        <button id="test-btn">Test Level</button>
      </div>
    `;
    document.body.appendChild(this.container);

    this.levelNameInput = this.container.querySelector('#level-name')!;
    this.widthInput = this.container.querySelector('#level-width')!;
    this.heightInput = this.container.querySelector('#level-height')!;
    this.exportBtn = this.container.querySelector('#export-btn')!;
    this.importBtn = this.container.querySelector('#import-btn')!;
    this.saveBtn = this.container.querySelector('#save-btn')!;
    this.publishBtn = this.container.querySelector('#publish-btn')!;
    this.testBtn = this.container.querySelector('#test-btn')!;
    this.tilePalette = this.container.querySelector('#tile-palette')!;
    this.objectPalette = this.container.querySelector('#object-palette')!;
    this.modeToggle = this.container.querySelector('.sandbox-mode-toggle')!;
    this.clearBtn = this.container.querySelector('#clear-level-btn')!;
    this.canvas = this.container.querySelector('#sandbox-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
  }

  private getDefaultState(): SandboxState {
    const width = 10, height = 10;
    const grid = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
    const level: LevelData = {
      id: `user_${Date.now()}`,
      name: 'My Level',
      description: '',
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
      coinPos: { col: width-1, row: height-1 },
      optimalSteps: 1,
      solutions: { easy: { steps: 1, commands: [] }, mid: { steps: 1, commands: [] }, hard: { steps: 1, commands: [] }, backdoor: null },
      isTutorial: false,
      explorationPenalty: false,
    };
    return {
      level,
      selectedTile: TileType.PLATFORM,
      selectedObject: 'key',
      mode: 'tile',
      gridSizePx: 600 / Math.max(width, height),
      showGrid: true,
    };
  }

  private attachEvents(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', () => this.isDrawing = false);
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cell = this.getCellFromCoord(e.offsetX, e.offsetY);
      if (cell) {
        this.eraseCell(cell.col, cell.row);
        this.render();
      }
      return false;
    });
    this.exportBtn.addEventListener('click', () => this.exportLevel());
    this.importBtn.addEventListener('click', () => this.importLevel());
    this.saveBtn.addEventListener('click', () => this.saveToLocalStorage());
    this.publishBtn.addEventListener('click', () => this.publishLevel());
    this.testBtn.addEventListener('click', () => this.testLevel());
    this.clearBtn.addEventListener('click', () => this.confirmClearLevel());
    this.container.querySelector('#resize-btn')!.addEventListener('click', () => this.resizeGrid());
    this.container.querySelector('#mode-tile')!.addEventListener('click', () => this.setMode('tile'));
    this.container.querySelector('#mode-object')!.addEventListener('click', () => this.setMode('object'));

    // Горячие клавиши
    window.addEventListener('keydown', (e) => {
      if (!this.container.style.display || this.container.style.display === 'none') return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (this.lastCursorCell) {
          this.state.level.startPos = { ...this.lastCursorCell };
          this.render();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        if (this.lastCursorCell) {
          this.state.level.coinPos = { ...this.lastCursorCell };
          this.render();
        }
      }
    });

    this.buildPalettes();
  }

  private buildPalettes(): void {
    this.tilePalette.innerHTML = '';
    for (const [tile, icon] of Object.entries(this.TILE_ICONS)) {
      const tileNum = parseInt(tile);
      if (isNaN(tileNum)) continue;
      const btn = document.createElement('button');
      btn.innerHTML = icon;
      btn.title = TileType[tileNum];
      btn.addEventListener('click', () => {
        this.state.selectedTile = tileNum;
        document.querySelectorAll('.tile-palette button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      this.tilePalette.appendChild(btn);
    }
    this.objectPalette.innerHTML = '';
    for (const obj of this.OBJECT_TYPES) {
      const btn = document.createElement('button');
      btn.innerHTML = obj.label;
      btn.addEventListener('click', () => {
        this.state.selectedObject = obj.id;
        document.querySelectorAll('.object-palette button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      this.objectPalette.appendChild(btn);
    }
    (this.tilePalette.children[0] as HTMLElement)?.classList.add('selected');
    (this.objectPalette.children[0] as HTMLElement)?.classList.add('selected');
  }

  private setMode(mode: EditorMode): void {
    this.state.mode = mode;
    this.tilePalette.style.display = mode === 'tile' ? 'flex' : 'none';
    this.objectPalette.style.display = mode === 'object' ? 'flex' : 'none';
    const tileBtn = this.container.querySelector('#mode-tile')!;
    const objBtn = this.container.querySelector('#mode-object')!;
    if (mode === 'tile') {
      tileBtn.classList.add('active');
      objBtn.classList.remove('active');
    } else {
      objBtn.classList.add('active');
      tileBtn.classList.remove('active');
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.isDrawing = true;
    const cell = this.getCellFromCoord(e.offsetX, e.offsetY);
    if (cell) {
      if (e.button === 0) { // левая кнопка
        this.paintCell(cell.col, cell.row);
      } else if (e.button === 2) { // правая кнопка уже обработана в contextmenu, но дублируем
        this.eraseCell(cell.col, cell.row);
      }
      this.lastCell = cell;
      this.render();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const cell = this.getCellFromCoord(e.offsetX, e.offsetY);
    if (cell) this.lastCursorCell = cell;
    if (!this.isDrawing) return;
    if (cell && (!this.lastCell || (this.lastCell.col !== cell.col || this.lastCell.row !== cell.row))) {
      if (this.state.mode === 'tile') {
        this.paintCell(cell.col, cell.row);
      } else {
        this.addObject(cell.col, cell.row);
      }
      this.lastCell = cell;
      this.render();
    }
  }

  private getCellFromCoord(x: number, y: number): Point | null {
    const size = this.state.gridSizePx;
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    if (col >= 0 && col < this.state.level.width && row >= 0 && row < this.state.level.height) {
      return { col, row };
    }
    return null;
  }

  private paintCell(col: number, row: number): void {
    if (this.state.mode === 'tile') {
      this.state.level.map[row][col] = this.state.selectedTile;
    } else {
      this.addObject(col, row);
    }
    this.render();
  }

  private eraseCell(col: number, row: number): void {
    // Удалить тайл (установить PLATFORM или SKY? Выберем PLATFORM)
    this.state.level.map[row][col] = TileType.PLATFORM;
    // Удалить все объекты в этой клетке
    this.removeObjectAt(col, row);
  }

  private addObject(col: number, row: number): void {
    const obj = this.state.selectedObject;
    const pos = { col, row };
    this.removeObjectAt(col, row); // удаляем старый объект в этой клетке
    switch (obj) {
      case 'key': this.state.level.objects.keys.push(pos); break;
      case 'drill': this.state.level.objects.drills.push(pos); break;
      case 'hook': this.state.level.objects.hooks.push(pos); break;
      case 'wing': this.state.level.objects.wings.push(pos); break;
      case 'bait': this.state.level.objects.baits.push(pos); break;
      case 'corn': this.state.level.objects.corn.push(pos); break;
      case 'core': this.state.level.objects.cores.push(pos); break;
      case 'door_locked':
        this.state.level.objects.doors.push({ id: `door_${col}_${row}`, position: pos, isLocked: true, keyId: `key_${col}_${row}` });
        this.state.level.map[row][col] = TileType.DOOR_LOCKED;
        break;
      case 'monster_patrol':
        this.state.level.objects.monsters.push({ id: `m_${col}_${row}`, type: MonsterType.PATROL, position: pos, direction: 'right', isTamed: false, isRidden: false });
        break;
      case 'monster_chase':
        this.state.level.objects.monsters.push({ id: `m_${col}_${row}`, type: MonsterType.CHASE, position: pos, direction: 'right', isTamed: false, isRidden: false });
        break;
      case 'monster_tameable':
        this.state.level.objects.monsters.push({ id: `m_${col}_${row}`, type: MonsterType.TAMEABLE, position: pos, direction: 'right', isTamed: false, isRidden: false });
        break;
    }
  }

  private removeObjectAt(col: number, row: number): void {
    this.state.level.objects.keys = this.state.level.objects.keys.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.drills = this.state.level.objects.drills.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.hooks = this.state.level.objects.hooks.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.wings = this.state.level.objects.wings.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.baits = this.state.level.objects.baits.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.corn = this.state.level.objects.corn.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.cores = this.state.level.objects.cores.filter(p => !(p.col === col && p.row === row));
    this.state.level.objects.doors = this.state.level.objects.doors.filter(d => !(d.position.col === col && d.position.row === row));
    this.state.level.objects.monsters = this.state.level.objects.monsters.filter(m => !(m.position.col === col && m.position.row === row));
    if (this.state.level.map[row][col] === TileType.DOOR_LOCKED) {
      this.state.level.map[row][col] = TileType.PLATFORM;
    }
  }

  private confirmClearLevel(): void {
    if (confirm('Are you sure you want to clear the entire level?')) {
      this.clearLevel();
    }
  }

  private clearLevel(): void {
    const width = this.state.level.width;
    const height = this.state.level.height;
    this.state.level.map = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
    this.state.level.objects = {
      holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
      springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
      corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
      clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
    };
    this.state.level.startPos = { col: 0, row: 0 };
    this.state.level.coinPos = { col: width-1, row: height-1 };
    this.render();
  }

  private resizeGrid(): void {
    let newWidth = parseInt(this.widthInput.value, 10);
    let newHeight = parseInt(this.heightInput.value, 10);
    newWidth = Math.min(20, Math.max(5, newWidth));
    newHeight = Math.min(20, Math.max(5, newHeight));
    const oldGrid = this.state.level.map;
    const newGrid = Array(newHeight).fill(null).map(() => Array(newWidth).fill(TileType.PLATFORM));
    for (let r = 0; r < Math.min(oldGrid.length, newHeight); r++) {
      for (let c = 0; c < Math.min(oldGrid[0].length, newWidth); c++) {
        newGrid[r][c] = oldGrid[r][c];
      }
    }
    this.state.level.map = newGrid;
    this.state.level.width = newWidth;
    this.state.level.height = newHeight;
    // Корректировка startPos и coinPos
    if (this.state.level.startPos.col >= newWidth) this.state.level.startPos.col = newWidth - 1;
    if (this.state.level.startPos.row >= newHeight) this.state.level.startPos.row = newHeight - 1;
    if (this.state.level.coinPos.col >= newWidth) this.state.level.coinPos.col = newWidth - 1;
    if (this.state.level.coinPos.row >= newHeight) this.state.level.coinPos.row = newHeight - 1;
    this.state.gridSizePx = 600 / Math.max(newWidth, newHeight);
    this.render();
  }

  private render(): void {
    const { level, gridSizePx, showGrid } = this.state;
    this.canvas.width = level.width * gridSizePx;
    this.canvas.height = level.height * gridSizePx;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Тайлы
    for (let row = 0; row < level.height; row++) {
      for (let col = 0; col < level.width; col++) {
        const tile = level.map[row][col];
        const x = col * gridSizePx;
        const y = row * gridSizePx;
        this.ctx.fillStyle = this.getTileColor(tile);
        this.ctx.fillRect(x, y, gridSizePx, gridSizePx);
        if (showGrid) {
          this.ctx.strokeStyle = '#aaa';
          this.ctx.strokeRect(x, y, gridSizePx, gridSizePx);
        }
        const icon = this.TILE_ICONS[tile];
        if (icon) {
          this.ctx.fillStyle = '#000';
          this.ctx.font = `${Math.floor(gridSizePx * 0.6)}px Arial`;
          this.ctx.fillText(icon, x + 4, y + gridSizePx - 4);
        }
      }
    }
    // Объекты
    const drawObject = (pos: Point, icon: string) => {
      const x = pos.col * gridSizePx;
      const y = pos.row * gridSizePx;
      this.ctx.fillStyle = 'gold';
      this.ctx.font = `${Math.floor(gridSizePx * 0.6)}px Arial`;
      this.ctx.fillText(icon, x + 4, y + gridSizePx - 4);
    };
    level.objects.keys.forEach(k => drawObject(k, '🔑'));
    level.objects.drills.forEach(d => drawObject(d, '🔧'));
    level.objects.hooks.forEach(h => drawObject(h, '🪝'));
    level.objects.wings.forEach(w => drawObject(w, '🪽'));
    level.objects.baits.forEach(b => drawObject(b, '🐟'));
    level.objects.corn.forEach(c => drawObject(c, '🌽'));
    level.objects.cores.forEach(c => drawObject(c, '💎'));
    level.objects.doors.forEach(d => drawObject(d.position, '🚪'));
    level.objects.monsters.forEach(m => drawObject(m.position, '👾'));
    drawObject(level.startPos, '🚀');
    drawObject(level.coinPos, '💰');
  }

  private getTileColor(tile: TileType): string {
    switch (tile) {
      case TileType.PLATFORM: return '#8B5A2B';
      case TileType.SKY: return '#87CEEB';
      case TileType.HOLE: return '#000';
      case TileType.BRICK: return '#A52A2A';
      case TileType.WALL: return '#555';
      case TileType.FAKE_WALL: return '#888';
      case TileType.GOAL: return '#FFD700';
      case TileType.START: return '#00FF00';
      default: return '#CCC';
    }
  }

  private exportLevel(): void {
    const dataStr = JSON.stringify(this.state.level, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.state.level.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private importLevel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const level = JSON.parse(ev.target?.result as string) as LevelData;
          this.state.level = level;
          this.widthInput.value = level.width.toString();
          this.heightInput.value = level.height.toString();
          this.state.gridSizePx = 600 / Math.max(level.width, level.height);
          this.render();
        } catch (err) {
          alert('Invalid JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  private saveToLocalStorage(): void {
    const key = `sandbox_${this.state.level.id}`;
    localStorage.setItem(key, JSON.stringify(this.state.level));
    alert('Level saved to local storage');
  }

  private publishLevel(): void {
    const levelCopy = { ...this.state.level, id: `pub_${Date.now()}`, worldId: 'arcade' };
    localStorage.setItem(`arcade_${levelCopy.id}`, JSON.stringify(levelCopy));
    alert('Level published to Arcade (local)');
    eventBus.emit('ARCADE_LEVEL_PUBLISH', { levelData: levelCopy });
  }

  private testLevel(): void {
    sessionStorage.setItem('test_level', JSON.stringify(this.state.level));
    eventBus.emit('SANDBOX_LEVEL_SAVED', { levelData: this.state.level });
  }
}
