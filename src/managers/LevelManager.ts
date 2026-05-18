// src/managers/LevelManager.ts
// ПРОМЕТЕЙ: Динамическая загрузка уровней через манифест (production-совместимо).
// В dev-режиме можно использовать import.meta.glob, но для Capacitor и production-сборки
// используется заранее сгенерированный манифест public/levels-manifest.json.
// Манифест генерируется скриптом scripts/generate-level-manifest.js.

import { LevelData, LevelMetadata } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

interface ManifestEntry {
  id: string;
  worldId: string;
  levelNumber: number;
  name: string;
  isTutorial: boolean;
  optimalSteps: number;
  path: string; // относительный путь к JSON-файлу уровня (например, "levels/meadow/001.json")
}

interface LevelManifest {
  version: string;
  levels: ManifestEntry[];
  worlds: Record<string, string[]>; // worldId -> list of levelIds
}

export class LevelManager {
  private static instance: LevelManager;
  private manifest: LevelManifest | null = null;
  private levelIndex: Map<string, ManifestEntry> = new Map();
  private worldsLevels: Map<string, string[]> = new Map();
  private cache: Map<string, LevelData> = new Map();
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

  public async initialize(manifestUrl: string = '/levels-manifest.json'): Promise<void> {
    if (this.initialized) return;
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      this.manifest = await response.json() as LevelManifest;
      this.buildIndex();
      this.initialized = true;
      console.log('[LevelManager] Initialized with manifest, total levels:', this.levelIndex.size);
    } catch (error) {
      console.error('[LevelManager] Failed to initialize:', error);
      // В случае ошибки создаём пустой манифест (игра не запустится, но не крашнется)
      this.manifest = { version: '1.0', levels: [], worlds: {} };
      this.initialized = true;
    }
  }

  private buildIndex(): void {
    if (!this.manifest) return;
    this.levelIndex.clear();
    this.worldsLevels.clear();
    for (const entry of this.manifest.levels) {
      this.levelIndex.set(entry.id, entry);
      if (!this.worldsLevels.has(entry.worldId)) {
        this.worldsLevels.set(entry.worldId, []);
      }
      this.worldsLevels.get(entry.worldId)!.push(entry.id);
    }
    // Сортируем уровни в каждом мире по levelNumber
    for (const [worldId, ids] of this.worldsLevels.entries()) {
      ids.sort((a, b) => {
        const aNum = this.levelIndex.get(a)?.levelNumber ?? 0;
        const bNum = this.levelIndex.get(b)?.levelNumber ?? 0;
        return aNum - bNum;
      });
      this.worldsLevels.set(worldId, ids);
    }
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
        console.error(`[LevelManager] Level ${levelId} not found in manifest`);
        return null;
      }
      const response = await fetch(entry.path);
      if (!response.ok) {
        throw new Error(`Failed to load level ${levelId}: ${response.status}`);
      }
      const levelData = await response.json() as LevelData;
      if (!this.validateLevel(levelData)) {
        console.error(`[LevelManager] Invalid level ${levelId}`);
        return null;
      }
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
