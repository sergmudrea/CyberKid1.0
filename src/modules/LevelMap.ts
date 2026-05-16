// src/modules/LevelMap.ts
// Эйдо: Рендеринг сетки тайлов, объектов, игрока и монстров.
// Использует Phaser 3 для Canvas-рендеринга. Подписывается на события EventBus
// для обновления позиции игрока, монстров и состояния мира.

import { LevelData, Point, TileType, Monster, MonsterType } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

export class LevelMap {
  private scene: Phaser.Scene;
  private level: LevelData;
  private gridSize: number;
  private container: Phaser.GameObjects.Container;
  private tileSprites: Phaser.GameObjects.Sprite[][];
  private objectSprites: Map<string, Phaser.GameObjects.Sprite>;
  private monsterSprites: Map<string, Phaser.GameObjects.Sprite>;
  private playerSprite: Phaser.GameObjects.Sprite;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private showGrid: boolean = false;
  private explorationMode: boolean = false;

  // Сохраняем обработчики для корректной отписки
  private onPlayerMovedHandler: (payload: any) => void;
  private onPlayerDiedHandler: () => void;
  private onPlayerTeleportHandler: (payload: any) => void;
  private onMonsterMovedHandler: (payload: any) => void;
  private onObjectCollectedHandler: (payload: any) => void;
  private onExplorationToggledHandler: (payload: any) => void;

  constructor(scene: Phaser.Scene, level: LevelData, gridSize: number = 48) {
    this.scene = scene;
    this.level = level;
    this.gridSize = gridSize;
    this.container = scene.add.container(0, 0);
    this.tileSprites = [];
    this.objectSprites = new Map();
    this.monsterSprites = new Map();
    this.playerSprite = scene.add.sprite(0, 0, 'player');
    this.container.add(this.playerSprite);
    this.bindEventHandlers();
    this.setupEventListeners();
    this.renderGrid();
    this.renderTiles();
    this.renderObjects();
    this.renderMonsters();
    this.updatePlayerPosition(level.startPos);
  }

  // Полный пересбор карты (при загрузке нового уровня)
  public rebuild(level: LevelData): void {
    this.level = level;
    this.clear();
    this.renderGrid();
    this.renderTiles();
    this.renderObjects();
    this.renderMonsters();
    this.updatePlayerPosition(level.startPos);
    // Восстанавливаем сетку, если была включена
    if (this.showGrid) {
      this.toggleGrid(true);
    }
  }

  // Очистка всех спрайтов
  public clear(): void {
    this.container.removeAll(true);
    this.tileSprites = [];
    this.objectSprites.clear();
    this.monsterSprites.clear();
    this.playerSprite = this.scene.add.sprite(0, 0, 'player');
    this.container.add(this.playerSprite);
    if (this.gridGraphics) {
      this.gridGraphics.destroy();
      this.gridGraphics = null;
    }
  }

  // Полное уничтожение (вызывать при выходе из сцены)
  public destroy(): void {
    this.removeEventListeners();
    this.clear();
    this.container.destroy();
  }

  // Обновление позиции игрока (с анимацией)
  public updatePlayerPosition(pos: Point): void {
    const x = pos.col * this.gridSize + this.gridSize / 2;
    const y = pos.row * this.gridSize + this.gridSize / 2;
    if (this.scene.tweens) {
      this.scene.tweens.killTweensOf(this.playerSprite);
      this.scene.tweens.add({
        targets: this.playerSprite,
        x: x,
        y: y,
        duration: 100,
        ease: 'Linear'
      });
    } else {
      this.playerSprite.setPosition(x, y);
    }
  }

  // Визуальный эффект смерти (мигание)
  public flashDeath(): void {
    if (!this.scene.tweens) return;
    this.scene.tweens.add({
      targets: this.playerSprite,
      alpha: 0,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => { this.playerSprite.alpha = 1; }
    });
  }

  // Эффект телепортации
  public teleportEffect(from: Point, to: Point): void {
    const fromX = from.col * this.gridSize + this.gridSize / 2;
    const fromY = from.row * this.gridSize + this.gridSize / 2;
    const toX = to.col * this.gridSize + this.gridSize / 2;
    const toY = to.row * this.gridSize + this.gridSize / 2;
    this.scene.tweens.add({
      targets: this.playerSprite,
      x: fromX,
      y: fromY,
      duration: 50,
      onComplete: () => {
        this.playerSprite.setVisible(false);
        this.scene.time.delayedCall(100, () => {
          this.playerSprite.setPosition(toX, toY);
          this.playerSprite.setVisible(true);
        });
      }
    });
  }

  // Обновление состояния монстров (позиция, приручение)
  public updateMonster(monster: Monster): void {
    const sprite = this.monsterSprites.get(monster.id);
    if (sprite) {
      const x = monster.position.col * this.gridSize + this.gridSize / 2;
      const y = monster.position.row * this.gridSize + this.gridSize / 2;
      if (this.scene.tweens) {
        this.scene.tweens.killTweensOf(sprite);
        this.scene.tweens.add({
          targets: sprite,
          x: x,
          y: y,
          duration: 100,
          ease: 'Linear'
        });
      } else {
        sprite.setPosition(x, y);
      }
      if (monster.isTamed) {
        sprite.setTint(0x00ff00);
      } else {
        sprite.clearTint();
      }
    }
  }

  // Удаление объекта с карты (например, после подбора ключа)
  public removeObject(objectId: string): void {
    const sprite = this.objectSprites.get(objectId);
    if (sprite) {
      sprite.destroy();
      this.objectSprites.delete(objectId);
    }
  }

  // Подсветка клетки (для подсказок)
  public highlightCell(pos: Point, color: number = 0xffff00): void {
    const x = pos.col * this.gridSize;
    const y = pos.row * this.gridSize;
    const rect = this.scene.add.rectangle(x, y, this.gridSize, this.gridSize, color);
    rect.setAlpha(0.5);
    rect.setOrigin(0, 0);
    this.scene.time.delayedCall(500, () => rect.destroy());
  }

  // Включение/отключение сетки
  public toggleGrid(show: boolean): void {
    this.showGrid = show;
    if (show) {
      if (!this.gridGraphics) {
        this.gridGraphics = this.scene.add.graphics();
      }
      this.drawGrid();
    } else {
      if (this.gridGraphics) {
        this.gridGraphics.destroy();
        this.gridGraphics = null;
      }
    }
  }

  public setExplorationMode(enabled: boolean): void {
    this.explorationMode = enabled;
    for (const sprite of this.monsterSprites.values()) {
      sprite.setAlpha(enabled ? 0.6 : 1);
    }
  }

  // Приватные методы рендеринга
  private renderGrid(): void {
    if (this.showGrid) {
      if (!this.gridGraphics) {
        this.gridGraphics = this.scene.add.graphics();
      }
      this.drawGrid();
    }
  }

  private drawGrid(): void {
    if (!this.gridGraphics) return;
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x888888, 0.5);
    for (let i = 0; i <= this.level.width; i++) {
      this.gridGraphics.moveTo(i * this.gridSize, 0);
      this.gridGraphics.lineTo(i * this.gridSize, this.level.height * this.gridSize);
    }
    for (let i = 0; i <= this.level.height; i++) {
      this.gridGraphics.moveTo(0, i * this.gridSize);
      this.gridGraphics.lineTo(this.level.width * this.gridSize, i * this.gridSize);
    }
    this.gridGraphics.strokePath();
  }

  private renderTiles(): void {
    for (let row = 0; row < this.level.height; row++) {
      this.tileSprites[row] = [];
      for (let col = 0; col < this.level.width; col++) {
        const tileType = this.level.map[row][col];
        const textureKey = this.getTileTexture(tileType);
        const x = col * this.gridSize;
        const y = row * this.gridSize;
        const sprite = this.scene.add.sprite(x, y, textureKey);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(this.gridSize, this.gridSize);
        this.container.add(sprite);
        this.tileSprites[row][col] = sprite;
      }
    }
  }

  private renderObjects(): void {
    for (const pos of this.level.objects.keys) {
      this.createObjectSprite(`key_${pos.col}_${pos.row}`, pos, 'key');
    }
    for (const pos of this.level.objects.drills) {
      this.createObjectSprite(`drill_${pos.col}_${pos.row}`, pos, 'drill');
    }
    for (const pos of this.level.objects.hooks) {
      this.createObjectSprite(`hook_${pos.col}_${pos.row}`, pos, 'hook');
    }
    for (const pos of this.level.objects.wings) {
      this.createObjectSprite(`wing_${pos.col}_${pos.row}`, pos, 'wing');
    }
    for (const pos of this.level.objects.baits) {
      this.createObjectSprite(`bait_${pos.col}_${pos.row}`, pos, 'bait');
    }
    for (const pos of this.level.objects.corn) {
      this.createObjectSprite(`corn_${pos.col}_${pos.row}`, pos, 'corn');
    }
    for (const pos of this.level.objects.cores) {
      this.createObjectSprite(`core_${pos.col}_${pos.row}`, pos, 'core');
    }
  }

  private renderMonsters(): void {
    for (const monster of this.level.objects.monsters) {
      const textureKey = this.getMonsterTexture(monster.type);
      const x = monster.position.col * this.gridSize;
      const y = monster.position.row * this.gridSize;
      const sprite = this.scene.add.sprite(x, y, textureKey);
      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(this.gridSize, this.gridSize);
      if (monster.isTamed) sprite.setTint(0x00ff00);
      this.container.add(sprite);
      this.monsterSprites.set(monster.id, sprite);
    }
  }

  private createObjectSprite(id: string, pos: Point, textureKey: string): void {
    const x = pos.col * this.gridSize;
    const y = pos.row * this.gridSize;
    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setOrigin(0, 0);
    sprite.setDisplaySize(this.gridSize, this.gridSize);
    this.container.add(sprite);
    this.objectSprites.set(id, sprite);
  }

  private getTileTexture(tile: number): string {
    switch (tile) {
      case TileType.PLATFORM: return 'tile_platform';
      case TileType.SKY: return 'tile_sky';
      case TileType.HOLE: return 'tile_hole';
      case TileType.BRICK: return 'tile_brick';
      case TileType.WALL: return 'tile_wall';
      case TileType.GOAL: return 'tile_goal';
      case TileType.KEY: return 'tile_key';
      case TileType.DOOR_LOCKED: return 'tile_door_locked';
      case TileType.DOOR_UNLOCKED: return 'tile_door_unlocked';
      case TileType.CONVEYOR_UP: return 'tile_conveyor_up';
      case TileType.CONVEYOR_DOWN: return 'tile_conveyor_down';
      case TileType.CONVEYOR_LEFT: return 'tile_conveyor_left';
      case TileType.CONVEYOR_RIGHT: return 'tile_conveyor_right';
      case TileType.SPRING: return 'tile_spring';
      case TileType.TELEPORT_IN: return 'tile_teleport_in';
      case TileType.TELEPORT_OUT: return 'tile_teleport_out';
      case TileType.LAVA: return 'tile_lava';
      case TileType.WATER: return 'tile_water';
      default: return 'tile_platform';
    }
  }

  private getMonsterTexture(type: MonsterType): string {
    switch (type) {
      case MonsterType.PATROL: return 'monster_patrol';
      case MonsterType.CHASE: return 'monster_chase';
      case MonsterType.TAMEABLE: return 'monster_tameable';
      case MonsterType.PHASED: return 'monster_phased';
      case MonsterType.ZOMBIE: return 'monster_zombie';
      case MonsterType.BOSS: return 'monster_boss';
      default: return 'monster_patrol';
    }
  }

  private bindEventHandlers(): void {
    this.onPlayerMovedHandler = (payload) => {
      if (payload && payload.to) this.updatePlayerPosition(payload.to);
    };
    this.onPlayerDiedHandler = () => this.flashDeath();
    this.onPlayerTeleportHandler = (payload) => {
      if (payload && payload.from && payload.to) this.teleportEffect(payload.from, payload.to);
    };
    this.onMonsterMovedHandler = (payload) => {
      if (payload && payload.monster) this.updateMonster(payload.monster);
    };
    this.onObjectCollectedHandler = (payload) => {
      if (payload && payload.objectId) this.removeObject(payload.objectId);
    };
    this.onExplorationToggledHandler = (payload) => {
      if (payload && payload.enabled !== undefined) this.setExplorationMode(payload.enabled);
    };
  }

  private setupEventListeners(): void {
    eventBus.on('PLAYER_MOVED', this.onPlayerMovedHandler);
    eventBus.on('PLAYER_DIED', this.onPlayerDiedHandler);
    eventBus.on('PLAYER_TELEPORT', this.onPlayerTeleportHandler);
    eventBus.on('MONSTER_MOVED', this.onMonsterMovedHandler);
    eventBus.on('OBJECT_COLLECTED', this.onObjectCollectedHandler);
    eventBus.on('EXPLORATION_TOGGLED', this.onExplorationToggledHandler);
  }

  private removeEventListeners(): void {
    eventBus.off('PLAYER_MOVED', this.onPlayerMovedHandler);
    eventBus.off('PLAYER_DIED', this.onPlayerDiedHandler);
    eventBus.off('PLAYER_TELEPORT', this.onPlayerTeleportHandler);
    eventBus.off('MONSTER_MOVED', this.onMonsterMovedHandler);
    eventBus.off('OBJECT_COLLECTED', this.onObjectCollectedHandler);
    eventBus.off('EXPLORATION_TOGGLED', this.onExplorationToggledHandler);
  }
}
