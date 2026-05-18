// src/modules/Player.ts
// ПРОМЕТЕЙ: Полностью переработанный класс Player с поддержкой объектов (ООП) и вызовов методов.
// Добавлено хранение созданных объектов, методы для вызова методов объектов, интеграция с ObjectInstance.
// Сохранена полная совместимость с существующими механиками (инвентарь, клоны, верховая езда).

import { Point, Inventory, Monster, Command } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

// Интерфейс для объекта, созданного через NEW (поддержка ООП)
export interface ObjectInstance {
  id: string;
  className: string;
  properties: Map<string, any>;
  methods?: Map<string, Function>; // ссылки на методы класса (в runtime)
}

export interface CloneInfo {
  id: string;
  position: Point;
  inventory: Inventory;
  commands: Command[];
  currentCommandIndex: number;
}

export class Player {
  private position: Point;
  private direction: 'up' | 'down' | 'left' | 'right';
  private inventory: Inventory;
  private isAlive: boolean = true;
  private isGhostMode: boolean = false;
  private clones: CloneInfo[] = [];
  private riddenMonster: Monster | null = null;
  private levelBounds: { width: number; height: number };
  private tileMap: (col: number, row: number) => number;
  private wingActive: boolean = false; // временный эффект крыльев

  // Поддержка ООП: созданные объекты (экземпляры классов)
  private objects: Map<string, ObjectInstance> = new Map();
  private nextObjectId: number = 1;

  constructor(
    startPos: Point,
    startDir: 'up' | 'down' | 'left' | 'right',
    levelWidth: number,
    levelHeight: number,
    tileGetter: (col: number, row: number) => number
  ) {
    this.position = { ...startPos };
    this.direction = startDir;
    this.levelBounds = { width: levelWidth, height: levelHeight };
    this.tileMap = tileGetter;
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
  }

  // ---------- Геттеры ----------
  public getPosition(): Point { return { ...this.position }; }
  public getDirection(): 'up' | 'down' | 'left' | 'right' { return this.direction; }
  public getInventory(): Inventory { return { ...this.inventory }; }
  public isPlayerAlive(): boolean { return this.isAlive; }
  public isGhost(): boolean { return this.isGhostMode; }
  public getClones(): CloneInfo[] { return [...this.clones]; }
  public getRiddenMonster(): Monster | null { return this.riddenMonster ? { ...this.riddenMonster } : null; }
  public getObjects(): Map<string, ObjectInstance> { return new Map(this.objects); }

  // ---------- Управление режимами ----------
  public setGhostMode(enabled: boolean): void {
    this.isGhostMode = enabled;
    eventBus.emit('EXPLORATION_TOGGLED', { enabled, penaltyWarningShown: enabled });
  }

  // ---------- Движение и коллизии ----------
  public move(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.isAlive) return false;
    const delta = this.directionToDelta(direction);
    const newPos = { col: this.position.col + delta.col, row: this.position.row + delta.row };
    if (!this.isWithinBounds(newPos)) return false;
    const tile = this.tileMap(newPos.col, newPos.row);
    if (!this.canEnterTile(tile)) return false;

    const oldPos = { ...this.position };
    this.position = newPos;
    this.direction = direction;
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  public teleport(point: Point): void {
    const oldPos = { ...this.position };
    this.position = { ...point };
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
  }

  public applyConveyor(conveyorDir: 'up' | 'down' | 'left' | 'right'): boolean {
    if (!this.isAlive) return false;
    const delta = this.directionToDelta(conveyorDir);
    const newPos = { col: this.position.col + delta.col, row: this.position.row + delta.row };
    if (!this.isWithinBounds(newPos)) return false;
    const tile = this.tileMap(newPos.col, newPos.row);
    if (!this.canEnterTile(tile)) return false;
    const oldPos = { ...this.position };
    this.position = newPos;
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  public applySpring(launchDir: 'up' | 'down' | 'left' | 'right', force: number = 3): boolean {
    if (!this.isAlive) return false;
    let currentPos = { ...this.position };
    for (let i = 0; i < force; i++) {
      const delta = this.directionToDelta(launchDir);
      const nextPos = { col: currentPos.col + delta.col, row: currentPos.row + delta.row };
      if (!this.isWithinBounds(nextPos)) return false;
      const tile = this.tileMap(nextPos.col, nextPos.row);
      if (!this.canEnterTile(tile)) return false;
      currentPos = nextPos;
    }
    const oldPos = { ...this.position };
    this.position = currentPos;
    eventBus.emit('PLAYER_MOVED', { from: oldPos, to: this.position });
    return true;
  }

  // ---------- Инвентарь ----------
  public addKey(keyId: string): void {
    if (!this.inventory.keys.includes(keyId)) {
      this.inventory.keys.push(keyId);
      this.emitInventoryChanged();
    }
  }
  public useKey(keyId: string): boolean {
    const index = this.inventory.keys.indexOf(keyId);
    if (index !== -1) {
      this.inventory.keys.splice(index, 1);
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }
  public addCorn(amount: number = 1): void { this.inventory.corn += amount; this.emitInventoryChanged(); }
  public useCorn(): boolean {
    if (this.inventory.corn > 0) {
      this.inventory.corn--;
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }
  public addCore(amount: number = 1): void { this.inventory.cores += amount; this.emitInventoryChanged(); }
  public useCore(): boolean {
    if (this.inventory.cores > 0) {
      this.inventory.cores--;
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }
  public addTool(tool: 'drill' | 'hook' | 'wing' | 'bait'): void {
    switch (tool) {
      case 'drill': this.inventory.hasDrill = true; break;
      case 'hook': this.inventory.hasHook = true; break;
      case 'wing': this.inventory.hasWing = true; break;
      case 'bait': this.inventory.hasBait = true; break;
    }
    if (!this.inventory.tools.includes(tool)) this.inventory.tools.push(tool);
    this.emitInventoryChanged();
  }
  public useTool(tool: 'drill' | 'hook' | 'wing' | 'bait'): boolean {
    let has = false;
    switch (tool) {
      case 'drill': has = this.inventory.hasDrill; if (has) this.inventory.hasDrill = false; break;
      case 'hook': has = this.inventory.hasHook; if (has) this.inventory.hasHook = false; break;
      case 'wing': has = this.inventory.hasWing; if (has) this.inventory.hasWing = false; break;
      case 'bait': has = this.inventory.hasBait; if (has) this.inventory.hasBait = false; break;
    }
    if (has) {
      this.inventory.tools = this.inventory.tools.filter(t => t !== tool);
      this.emitInventoryChanged();
      return true;
    }
    return false;
  }

  // ---------- Крылья (временный эффект) ----------
  public activateWing(): void {
    this.wingActive = true;
    this.useTool('wing');
    // Эффект длится 3 шага (управляется ExecutionEngine)
    setTimeout(() => { this.wingActive = false; }, 3000);
  }
  public isWingActive(): boolean { return this.wingActive; }

  // ---------- Смерть и сброс ----------
  public kill(cause: string): void {
    if (this.isGhostMode) return;
    this.isAlive = false;
    eventBus.emit('PLAYER_DIED', { cause });
  }
  public revive(startPos: Point, startDir: 'up' | 'down' | 'left' | 'right'): void {
    this.position = { ...startPos };
    this.direction = startDir;
    this.isAlive = true;
    this.resetInventory();
    this.clones = [];
    this.riddenMonster = null;
    this.objects.clear();
    this.nextObjectId = 1;
    this.wingActive = false;
  }
  public resetInventory(): void {
    this.inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    this.emitInventoryChanged();
  }

  // ---------- Клонирование ----------
  public createClone(cloneId: string, position: Point, commands: Command[]): void {
    const newClone: CloneInfo = {
      id: cloneId,
      position: { ...position },
      inventory: JSON.parse(JSON.stringify(this.inventory)),
      commands: [...commands],
      currentCommandIndex: 0,
    };
    this.clones.push(newClone);
    eventBus.emit('CLONE_CREATED', { cloneId, pos: position });
  }
  public removeClone(cloneId: string): void {
    this.clones = this.clones.filter(c => c.id !== cloneId);
  }
  public getClone(cloneId: string): CloneInfo | undefined {
    return this.clones.find(c => c.id === cloneId);
  }
  public updateClonePosition(cloneId: string, newPos: Point): void {
    const clone = this.getClone(cloneId);
    if (clone) clone.position = { ...newPos };
  }
  public joinClones(): void {
    for (const clone of this.clones) {
      for (const key of clone.inventory.keys) {
        if (!this.inventory.keys.includes(key)) this.inventory.keys.push(key);
      }
      this.inventory.corn += clone.inventory.corn;
      this.inventory.cores += clone.inventory.cores;
      if (clone.inventory.hasDrill) this.inventory.hasDrill = true;
      if (clone.inventory.hasHook) this.inventory.hasHook = true;
      if (clone.inventory.hasWing) this.inventory.hasWing = true;
      if (clone.inventory.hasBait) this.inventory.hasBait = true;
      for (const tool of clone.inventory.tools) {
        if (!this.inventory.tools.includes(tool)) this.inventory.tools.push(tool);
      }
    }
    this.clones = [];
    this.emitInventoryChanged();
    eventBus.emit('CLONES_JOINED');
  }

  // ---------- Верховая езда ----------
  public rideMonster(monster: Monster): void {
    if (this.riddenMonster) this.dismountMonster();
    this.riddenMonster = { ...monster };
    this.riddenMonster.isRidden = true;
    this.position = { ...monster.position };
    eventBus.emit('MONSTER_TAMED', { monsterId: monster.id });
  }
  public dismountMonster(): void {
    if (this.riddenMonster) {
      this.riddenMonster.isRidden = false;
      this.riddenMonster = null;
    }
  }
  public isRiding(): boolean { return this.riddenMonster !== null; }

  // ---------- Поддержка ООП: создание объектов и вызов методов ----------
  public createObject(className: string, methods?: Map<string, Function>): string {
    const objId = `obj_${this.nextObjectId++}`;
    const obj: ObjectInstance = {
      id: objId,
      className,
      properties: new Map(),
      methods: methods ? new Map(methods) : undefined,
    };
    this.objects.set(objId, obj);
    eventBus.emit('OBJECT_CREATED', { className, objectId: objId });
    return objId;
  }

  public getObject(objectId: string): ObjectInstance | undefined {
    return this.objects.get(objectId);
  }

  public setObjectProperty(objectId: string, key: string, value: any): void {
    const obj = this.objects.get(objectId);
    if (obj) {
      obj.properties.set(key, value);
    }
  }

  public getObjectProperty(objectId: string, key: string): any {
    return this.objects.get(objectId)?.properties.get(key);
  }

  public callMethod(objectId: string, methodName: string, args: any[]): any {
    const obj = this.objects.get(objectId);
    if (!obj) {
      console.warn(`Object ${objectId} not found`);
      return null;
    }
    if (obj.methods && obj.methods.has(methodName)) {
      const method = obj.methods.get(methodName)!;
      // Метод вызывается в контексте объекта
      return method(obj, ...args);
    }
    console.warn(`Method ${methodName} not found on object ${objectId}`);
    return null;
  }

  // ---------- Приватные вспомогательные методы ----------
  private directionToDelta(dir: 'up' | 'down' | 'left' | 'right'): { col: number; row: number } {
    switch (dir) {
      case 'up': return { col: 0, row: -1 };
      case 'down': return { col: 0, row: 1 };
      case 'left': return { col: -1, row: 0 };
      case 'right': return { col: 1, row: 0 };
    }
  }
  private isWithinBounds(pos: Point): boolean {
    return pos.col >= 0 && pos.col < this.levelBounds.width && pos.row >= 0 && pos.row < this.levelBounds.height;
  }
  private canEnterTile(tile: number): boolean {
    if (tile === 4 || tile === 5) return false;
    if (tile === 2 && !this.inventory.hasWing && !this.isGhostMode && !this.wingActive) return false;
    if ((tile === 32 || tile === 33) && !this.isGhostMode) return false;
    return true;
  }
  private emitInventoryChanged(): void {
    eventBus.emit('INVENTORY_CHANGED', { inventory: this.getInventory() });
  }
}
