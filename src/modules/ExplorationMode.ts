// src/modules/ExplorationMode.ts
// Эйдо: Режим свободного исследования (Exploration Mode).
// Активируется по клавише P (или через кнопку UI). Замораживает монстров,
// отключает смерть (ghost mode), показывает предупреждение о штрафе звёзд (максимум 2 звезды).
// При выходе возвращает игрока на исходную позицию и восстанавливает состояние.

import { Point, Monster, Inventory } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';
import type { Player } from './Player';
import type { LevelMap } from './LevelMap';

export interface ExplorationSnapshot {
  playerPos: Point;
  playerDir: 'up' | 'down' | 'left' | 'right';
  inventory: Inventory;
  monsters: Monster[];
}

export class ExplorationMode {
  private active: boolean = false;
  private snapshot: ExplorationSnapshot | null = null;
  private levelId: string = '';
  private warningShown: boolean = false;
  private wasUsedDuringLevel: boolean = false;
  private player: Player | null = null;
  private levelMap: LevelMap | null = null;
  private onToggleCallback?: (active: boolean) => void;

  constructor() {
    this.setupEventListeners();
  }

  // Внедрение зависимостей (вызывается из GameScene)
  public setPlayer(player: Player): void {
    this.player = player;
  }

  public setLevelMap(levelMap: LevelMap): void {
    this.levelMap = levelMap;
  }

  // Установить текущий уровень (перед входом в режим)
  public setLevel(levelId: string): void {
    this.levelId = levelId;
    this.warningShown = false;
    this.wasUsedDuringLevel = false;
  }

  // Активировать режим исследования (P key / UI button)
  public activate(
    currentPos: Point,
    currentDir: 'up' | 'down' | 'left' | 'right',
    currentInventory: Inventory,
    currentMonsters: Monster[]
  ): boolean {
    if (this.active) return false;

    // Показать предупреждение о штрафе звёзд (только один раз за уровень)
    if (!this.warningShown) {
      const message = settingsManager.get().language === 'ru'
        ? 'Внимание! В режиме исследования максимальная награда — 2 звезды. Продолжить?'
        : 'Warning! In Exploration Mode, maximum reward is 2 stars. Continue?';
      const confirmed = confirm(message);
      if (!confirmed) return false;
      this.warningShown = true;
    }

    // Сохраняем снимок состояния
    this.snapshot = {
      playerPos: { ...currentPos },
      playerDir: currentDir,
      inventory: JSON.parse(JSON.stringify(currentInventory)),
      monsters: currentMonsters.map(m => ({
        ...m,
        position: { ...m.position },
      })),
    };

    this.active = true;
    this.wasUsedDuringLevel = true;

    // Применяем ghost mode и заморозку монстров напрямую
    if (this.player) this.player.setGhostMode(true);
    if (this.levelMap) this.levelMap.setExplorationMode(true);

    eventBus.emit('EXPLORATION_TOGGLED', { enabled: true, penaltyWarningShown: this.warningShown });
    if (this.onToggleCallback) this.onToggleCallback(true);
    return true;
  }

  // Деактивировать режим исследования (вернуться к нормальной игре)
  public deactivate(): { snapshot: ExplorationSnapshot; explorationUsed: boolean } | null {
    if (!this.active || !this.snapshot) return null;

    // Отключаем ghost mode и заморозку
    if (this.player) this.player.setGhostMode(false);
    if (this.levelMap) this.levelMap.setExplorationMode(false);

    this.active = false;
    const snapshot = this.snapshot;
    const used = this.wasUsedDuringLevel;
    this.snapshot = null;

    eventBus.emit('EXPLORATION_TOGGLED', { enabled: false, penaltyWarningShown: false });
    if (this.onToggleCallback) this.onToggleCallback(false);
    return { snapshot, explorationUsed: used };
  }

  // Проверить, активен ли режим
  public isActive(): boolean {
    return this.active;
  }

  // Был ли использован Exploration Mode на этом уровне (для прогресса)
  public wasUsed(): boolean {
    return this.wasUsedDuringLevel;
  }

  // Установить колбэк для уведомления UI (например, для изменения цвета кнопки)
  public onToggle(callback: (active: boolean) => void): void {
    this.onToggleCallback = callback;
  }

  // Принудительное отключение (например, при победе или смерти)
  public forceDisable(): void {
    if (this.active) {
      this.deactivate();
    }
  }

  // ----- Приватные методы -----
  private setupEventListeners(): void {
    // Слушаем сброс уровня (например, при перезагрузке)
    eventBus.on('LEVEL_RESET', () => {
      if (this.active) this.forceDisable();
    });
  }

  // Очистка при уничтожении
  public destroy(): void {
    eventBus.off('LEVEL_RESET');
  }
}
