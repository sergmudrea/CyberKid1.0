// src/managers/LevelManager.ts
// Эйдо: Динамическая загрузка и кэширование уровней.
// ⚠️ ВАЖНО: import.meta.glob работает только в dev-режиме Vite.
// Для production (Android/Capacitor) необходимо использовать fetch + манифест уровней.
// Рекомендация: перенести уровни в public/levels/, сгенерировать index.json со списком,
// и загружать через fetch. Текущая реализация оставлена для прототипа.

import { LevelData, LevelMetadata } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

type LevelModule = { default: LevelData };

interface LevelIndexEntry {
  id: string;
  worldId: string;
  levelNumber: number;
  name: string;
  isTutorial: boolean;
  optimalSteps: number;
  modulePath: string;
}

export class LevelManager {
  private static instance: LevelManager;
  private levelIndex: Map<string, LevelIndexEntry> = new Map();
  private cache: Map<string, LevelData> = new Map();
  private worldsLevels: Map<string, string[]> = new Map();
  private isLoading: Set<string> = new Set();
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): LevelManager {
    if (!LevelManager.instance) {
      LevelManager.instance = new LevelManager();
    }
    return LevelManager.instance;
  }

  public static resetInstance(): void {
    LevelManager.instance = undefined as any;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    // ВНИМАНИЕ: для production нужно заменить на загрузку манифеста через fetch
    const modules = import.meta.glob('/src/levels/**/*.json', { eager: false });
    for (const path in modules) {
      const fileName = path.split('/').pop()?.replace('.json', '') || '';
      const worldId = path.split('/').slice(-2)[0];
      const levelId = `${worldId}_${fileName}`;
      this.levelIndex.set(levelId, {
        id: levelId,
        worldId,
        levelNumber: this.extractNumber(fileName),
        name: '',
        isTutorial: false,
        optimalSteps: 0,
        modulePath: path,
      });
      if (!this.worldsLevels.has(worldId)) {
        this.worldsLevels.set(worldId, []);
      }
      this.worldsLevels.get(worldId)!.push(levelId);
    }
    for (const [worldId, ids] of this.worldsLevels.entries()) {
      ids.sort((a, b) => {
        const aNum = this.levelIndex.get(a)?.levelNumber ?? 0;
        const bNum = this.levelIndex.get(b)?.levelNumber ?? 0;
        return aNum - bNum;
      });
      this.worldsLevels.set(worldId, ids);
    }
    this.initialized = true;
  }

  public async loadLevel(levelId: string): Promise<LevelData | null> {
    if (!this.initialized) await this.initialize();
    if (this.cache.has(levelId)) {
      const level = this.cache.get(levelId)!;
      eventBus.emit('LEVEL_LOADED', { level });
      return level;
    }
    if (this.isLoading.has(levelId)) {
      await this.waitForLoad(levelId);
      return this.cache.get(levelId) || null;
    }
    this.isLoading.add(levelId);
    try {
      const entry = this.levelIndex.get(levelId);
      if (!entry) {
        console.error(`[LevelManager] Level ${levelId} not found`);
        return null;
      }
      const module = (await import(/* @vite-ignore */ entry.modulePath)) as LevelModule;
      const levelData = module.default;
      if (!this.validateLevel(levelData)) {
        console.error(`[LevelManager] Invalid level ${levelId}`);
        return null;
      }
      entry.name = levelData.name;
      entry.isTutorial = levelData.isTutorial || false;
      entry.optimalSteps = levelData.optimalSteps;
      this.cache.set(levelId, levelData);
      eventBus.emit('LEVEL_LOADED', { level: levelData });
      return levelData;
    } catch (error) {
      console.error(`[LevelManager] Load failed for ${levelId}`, error);
      return null;
    } finally {
      this.isLoading.delete(levelId);
    }
  }

  public async preloadLevels(levelIds: string[]): Promise<void> {
    await Promise.all(levelIds.map(id => this.loadLevel(id).catch(e => console.warn(`Preload ${id} failed`, e))));
  }

  public async getLevelMetadata(levelId: string): Promise<LevelMetadata | null> {
    if (!this.initialized) await this.initialize();
    const entry = this.levelIndex.get(levelId);
    if (!entry) return null;
    const cached = this.cache.get(levelId);
    return {
      id: levelId,
      name: cached?.name || entry.name,
      worldId: entry.worldId,
      levelNumber: entry.levelNumber,
      isCompleted: false,
      starsEarned: 0,
      isLocked: false,
      optimalSteps: cached?.optimalSteps || entry.optimalSteps,
    };
  }

  public getLevelIdsForWorld(worldId: string): string[] {
    return this.worldsLevels.get(worldId) || [];
  }

  public getNextLevelId(currentLevelId: string): string | null {
    const entry = this.levelIndex.get(currentLevelId);
    if (!entry) return null;
    const worldIds = this.worldsLevels.get(entry.worldId);
    if (!worldIds) return null;
    const idx = worldIds.indexOf(currentLevelId);
    if (idx === -1 || idx + 1 >= worldIds.length) return null;
    return worldIds[idx + 1];
  }

  public getPreviousLevelId(currentLevelId: string): string | null {
    const entry = this.levelIndex.get(currentLevelId);
    if (!entry) return null;
    const worldIds = this.worldsLevels.get(entry.worldId);
    if (!worldIds) return null;
    const idx = worldIds.indexOf(currentLevelId);
    if (idx <= 0) return null;
    return worldIds[idx - 1];
  }

  public clearCache(): void {
    this.cache.clear();
  }

  private extractNumber(fileName: string): number {
    const match = fileName.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  private validateLevel(level: LevelData): boolean {
    if (!level.id || !level.name || !level.worldId) return false;
    if (typeof level.width !== 'number' || typeof level.height !== 'number') return false;
    if (!level.map || !Array.isArray(level.map)) return false;
    if (!level.startPos || typeof level.startPos.col !== 'number' || typeof level.startPos.row !== 'number') return false;
    if (!level.coinPos || typeof level.coinPos.col !== 'number' || typeof level.coinPos.row !== 'number') return false;
    return true;
  }

  private async waitForLoad(levelId: string): Promise<void> {
    while (this.isLoading.has(levelId)) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

export const levelManager = LevelManager.getInstance();
