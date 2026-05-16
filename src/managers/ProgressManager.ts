// src/managers/ProgressManager.ts
// Эйдо: Управление прогрессом игрока (звёзды, статистика, разблокировка миров, достижения).
// Полностью соответствует ТЗ и arch.txt. Синглтон, сохраняет в localStorage, эмитит события.

import {
  PlayerProgress,
  LevelStats,
  Achievement,
  UserSettings,
} from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from './SettingsManager';

const STORAGE_KEY = 'cyberkid_progress';
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_star', name: 'Первая звезда', description: 'Получите 1 звезду', unlocked: false },
  { id: 'star_collector', name: 'Коллекционер звёзд', description: 'Соберите 100 звёзд', unlocked: false, progress: 0 },
  { id: 'black_star_hunter', name: 'Охотник за чёрными звёздами', description: 'Найдите 10 бэкдоров', unlocked: false, progress: 0 },
  { id: 'explorer', name: 'Исследователь', description: 'Используйте Exploration Mode 5 раз', unlocked: false, progress: 0 },
  { id: 'perfectionist', name: 'Перфекционист', description: 'Пройдите 10 уровней с 3 звёздами', unlocked: false, progress: 0 },
  { id: 'world_meadow', name: 'Завоеватель луга', description: 'Пройдите все уровни Meadow', unlocked: false },
  { id: 'world_ocean', name: 'Повелитель океана', description: 'Пройдите все уровни Ocean', unlocked: false },
  { id: 'world_clouds', name: 'Небожитель', description: 'Пройдите все уровни Clouds', unlocked: false },
  { id: 'world_fairytale', name: 'Сказочник', description: 'Пройдите все уровни Fairytale', unlocked: false },
  { id: 'world_volcano', name: 'Вулканолог', description: 'Пройдите все уровни Volcano', unlocked: false },
  { id: 'no_exploration', name: 'Чистая победа', description: 'Пройдите уровень без Exploration Mode', unlocked: false },
  { id: 'backdoor_master', name: 'Мастер бэкдоров', description: 'Найдите бэкдор на любом уровне', unlocked: false },
  { id: 'speedrunner', name: 'Спидраннер', description: 'Пройдите уровень быстрее оптимального (?)', unlocked: false },
  { id: 'tamer', name: 'Укротитель', description: 'Приручите монстра', unlocked: false },
  { id: 'cloner', name: 'Клон', description: 'Создайте клона', unlocked: false },
];

export class ProgressManager {
  private static instance: ProgressManager;
  private progress: PlayerProgress;
  private listeners: Array<(progress: PlayerProgress) => void> = [];

  private constructor() {
    this.progress = this.loadFromLocalStorage();
    // Если нет достижений, добавить дефолтные
    if (!this.progress.achievements || this.progress.achievements.length === 0) {
      this.progress.achievements = JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS));
      this.saveToLocalStorage();
    }
    this.ensureAllWorldsUnlockedLogic();
  }

  public static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  // Получить копию прогресса
  public get(): PlayerProgress {
    return JSON.parse(JSON.stringify(this.progress));
  }

  // Получить статистику по уровню
  public getLevelStats(levelId: string): LevelStats | undefined {
    return this.progress.levelStats[levelId];
  }

  // Получить количество звёзд за уровень (0 если не пройден)
  public getStars(levelId: string): number {
    return this.progress.levelStats[levelId]?.stars || 0;
  }

  // Проверить, пройден ли уровень
  public isLevelCompleted(levelId: string): boolean {
    return this.progress.levelStats[levelId]?.completed || false;
  }

  // Проверить, разблокирован ли мир
  public isWorldUnlocked(worldId: string): boolean {
    if (worldId === 'meadow') return true;
    return this.progress.unlockedWorlds.includes(worldId);
  }

  // Записать результат прохождения уровня
  public completeLevel(
    levelId: string,
    stars: number,
    blackStar: boolean,
    stepsUsed: number,
    explorationUsed: boolean,
    backdoorUsed: boolean,
    optimalSteps: number
  ): void {
    const existing = this.progress.levelStats[levelId];
    const wasCompleted = existing?.completed || false;
    const oldStars = existing?.stars || 0;

    const stats: LevelStats = {
      stars: Math.max(stars, oldStars),
      blackStar: blackStar || (existing?.blackStar || false),
      attempts: (existing?.attempts || 0) + 1,
      bestSteps: existing ? Math.min(stepsUsed, existing.bestSteps) : stepsUsed,
      completed: true,
      explorationUsed: explorationUsed || (existing?.explorationUsed || false),
      backdoorUsed: backdoorUsed || (existing?.backdoorUsed || false),
      lastPlayed: Date.now(),
    };

    this.progress.levelStats[levelId] = stats;

    // Обновляем общие счётчики
    if (!wasCompleted) {
      this.progress.levelsCompleted.push(levelId);
    }
    if (stars === 3 && !explorationUsed && (!existing || existing.stars < 3)) {
      if (!this.progress.perfectLevels.includes(levelId)) {
        this.progress.perfectLevels.push(levelId);
      }
    }

    // Пересчёт totalStars и totalBlackStars
    let totalStars = 0;
    let totalBlackStars = 0;
    for (const st of Object.values(this.progress.levelStats)) {
      totalStars += st.stars;
      if (st.blackStar) totalBlackStars++;
    }
    this.progress.totalStars = totalStars;
    this.progress.totalBlackStars = totalBlackStars;

    // Обновляем достижения (без промежуточных сохранений внутри)
    this.updateAchievementsOnComplete(levelId, stars, blackStar, explorationUsed, backdoorUsed, stepsUsed, optimalSteps);

    // Авто-разблокировка следующего мира (заглушка)
    this.checkWorldUnlockByCompletion();

    // Единое сохранение и уведомление
    this.saveToLocalStorage();
    this.notifyListeners();
    eventBus.emit('PROGRESS_UPDATED', this.progress);
    eventBus.emit('LEVEL_COMPLETED', { levelId, stars, blackStar, stepsUsed });
  }

  // Запись смерти
  public recordDeath(levelId: string, cause: string): void {
    const stats = this.progress.levelStats[levelId] || {
      stars: 0,
      blackStar: false,
      attempts: 0,
      bestSteps: Infinity,
      completed: false,
      explorationUsed: false,
      backdoorUsed: false,
      lastPlayed: 0,
    };
    stats.attempts += 1;
    this.progress.levelStats[levelId] = stats;
    this.progress.totalDeaths += 1;
    this.progress.deathsByType[cause] = (this.progress.deathsByType[cause] || 0) + 1;
    this.saveToLocalStorage();
    this.notifyListeners();
    eventBus.emit('PROGRESS_UPDATED', this.progress);
  }

  // Запись использования Exploration Mode
  public recordExplorationUsed(levelId: string): void {
    // Убедимся, что запись уровня существует
    if (!this.progress.levelStats[levelId]) {
      this.progress.levelStats[levelId] = {
        stars: 0,
        blackStar: false,
        attempts: 0,
        bestSteps: Infinity,
        completed: false,
        explorationUsed: false,
        backdoorUsed: false,
        lastPlayed: Date.now(),
      };
    }
    const stats = this.progress.levelStats[levelId];
    if (!stats.explorationUsed) {
      stats.explorationUsed = true;
      this.progress.explorationUsedCount += 1;
      // Сначала обновляем достижения
      this.updateAchievementsOnExploration();
      // Затем сохраняем и уведомляем
      this.saveToLocalStorage();
      this.notifyListeners();
      eventBus.emit('PROGRESS_UPDATED', this.progress);
    }
  }

  // Запись найденного бэкдора
  public recordBackdoorFound(levelId: string, backdoorType: string): void {
    // Убедимся, что запись уровня существует
    if (!this.progress.levelStats[levelId]) {
      this.progress.levelStats[levelId] = {
        stars: 0,
        blackStar: false,
        attempts: 0,
        bestSteps: Infinity,
        completed: false,
        explorationUsed: false,
        backdoorUsed: false,
        lastPlayed: Date.now(),
      };
    }
    const stats = this.progress.levelStats[levelId];
    if (!stats.backdoorUsed) {
      stats.backdoorUsed = true;
      this.progress.backdoorsFound += 1;
      // Сначала обновляем достижения (хоть метод пуст, но для единообразия)
      this.updateAchievementsOnBackdoor();
      // Затем сохраняем и уведомляем
      this.saveToLocalStorage();
      this.notifyListeners();
      eventBus.emit('PROGRESS_UPDATED', this.progress);
      eventBus.emit('BACKDOOR_FOUND', { levelId, backdoorType });
    }
  }

  // Разблокировать мир принудительно (покупка или достижение)
  public unlockWorld(worldId: string): void {
    if (!this.progress.unlockedWorlds.includes(worldId)) {
      this.progress.unlockedWorlds.push(worldId);
      this.saveToLocalStorage();
      this.notifyListeners();
      eventBus.emit('WORLD_UNLOCKED', { worldId });
      eventBus.emit('PROGRESS_UPDATED', this.progress);
    }
  }

  // Обновить настройки (сохраняются в прогресс)
  public updateSettings(settings: UserSettings): void {
    this.progress.settings = settings;
    this.saveToLocalStorage();
    this.notifyListeners();
    eventBus.emit('SETTINGS_CHANGED', settings);
    eventBus.emit('PROGRESS_UPDATED', this.progress);
  }

  // Добавить время игры (секунды)
  public addPlayTime(seconds: number): void {
    this.progress.totalPlayTimeSec += seconds;
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  // Экспорт прогресса в JSON
  public exportProgress(): string {
    return JSON.stringify(this.progress);
  }

  // Импорт прогресса (перезаписывает текущий)
  public importProgress(json: string): boolean {
    try {
      const imported = JSON.parse(json) as PlayerProgress;
      // Базовая валидация
      if (imported && typeof imported.totalStars === 'number') {
        this.progress = imported;
        this.saveToLocalStorage();
        this.notifyListeners();
        eventBus.emit('PROGRESS_UPDATED', this.progress);
        return true;
      }
    } catch (e) {
      console.warn('[ProgressManager] Import failed', e);
    }
    return false;
  }

  // Сброс всего прогресса
  public resetAll(): void {
    const emptyStats: Record<string, LevelStats> = {};
    this.progress = {
      totalStars: 0,
      totalBlackStars: 0,
      levelsCompleted: [],
      perfectLevels: [],
      levelStats: emptyStats,
      totalAttempts: 0,
      totalDeaths: 0,
      deathsByType: {},
      totalPlayTimeSec: 0,
      explorationUsedCount: 0,
      backdoorsFound: 0,
      unlockedWorlds: ['meadow'],
      lastPlayedWorld: 'meadow',
      lastPlayedLevelId: '',
      achievements: JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS)),
      settings: settingsManager.get(),
    };
    this.saveToLocalStorage();
    this.notifyListeners();
    eventBus.emit('PROGRESS_UPDATED', this.progress);
  }

  // Подписка на изменения
  public subscribe(callback: (progress: PlayerProgress) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // ------ Приватные методы ------
  private loadFromLocalStorage(): PlayerProgress {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
        const defaultSettings = settingsManager.get();
        const merged: PlayerProgress = {
          totalStars: parsed.totalStars ?? 0,
          totalBlackStars: parsed.totalBlackStars ?? 0,
          levelsCompleted: parsed.levelsCompleted ?? [],
          perfectLevels: parsed.perfectLevels ?? [],
          levelStats: parsed.levelStats ?? {},
          totalAttempts: parsed.totalAttempts ?? 0,
          totalDeaths: parsed.totalDeaths ?? 0,
          deathsByType: parsed.deathsByType ?? {},
          totalPlayTimeSec: parsed.totalPlayTimeSec ?? 0,
          explorationUsedCount: parsed.explorationUsedCount ?? 0,
          backdoorsFound: parsed.backdoorsFound ?? 0,
          unlockedWorlds: parsed.unlockedWorlds ?? ['meadow'],
          lastPlayedWorld: parsed.lastPlayedWorld ?? 'meadow',
          lastPlayedLevelId: parsed.lastPlayedLevelId ?? '',
          achievements: parsed.achievements ?? JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS)),
          settings: parsed.settings ?? defaultSettings,
        };
        return merged;
      }
    } catch (e) {
      console.warn('[ProgressManager] Failed to load', e);
    }
    return this.getDefaultProgress();
  }

  private getDefaultProgress(): PlayerProgress {
    return {
      totalStars: 0,
      totalBlackStars: 0,
      levelsCompleted: [],
      perfectLevels: [],
      levelStats: {},
      totalAttempts: 0,
      totalDeaths: 0,
      deathsByType: {},
      totalPlayTimeSec: 0,
      explorationUsedCount: 0,
      backdoorsFound: 0,
      unlockedWorlds: ['meadow'],
      lastPlayedWorld: 'meadow',
      lastPlayedLevelId: '',
      achievements: JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS)),
      settings: settingsManager.get(),
    };
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.warn('[ProgressManager] Failed to save', e);
    }
  }

  private notifyListeners(): void {
    const copy = this.get();
    this.listeners.forEach(cb => cb(copy));
  }

  private ensureAllWorldsUnlockedLogic(): void {
    if (!this.progress.unlockedWorlds || this.progress.unlockedWorlds.length === 0) {
      this.progress.unlockedWorlds = ['meadow'];
      this.saveToLocalStorage();
    }
  }

  private checkWorldUnlockByCompletion(): void {
    // Заглушка. В реальной реализации будет связь с LevelManager и конфигом миров.
  }

  private updateAchievementsOnComplete(
    levelId: string,
    stars: number,
    blackStar: boolean,
    explorationUsed: boolean,
    backdoorUsed: boolean,
    stepsUsed: number,
    optimalSteps: number
  ): void {
    // first_star
    if (stars >= 1 && !this.findAchievement('first_star')?.unlocked) {
      this.unlockAchievement('first_star');
    }
    // star_collector
    const starCollector = this.findAchievement('star_collector');
    if (starCollector && !starCollector.unlocked) {
      starCollector.progress = (starCollector.progress || 0) + stars;
      if (starCollector.progress >= 100) this.unlockAchievement('star_collector');
    }
    // black_star_hunter
    if (blackStar) {
      const blackHunter = this.findAchievement('black_star_hunter');
      if (blackHunter && !blackHunter.unlocked) {
        blackHunter.progress = (blackHunter.progress || 0) + 1;
        if (blackHunter.progress >= 10) this.unlockAchievement('black_star_hunter');
      }
    }
    // perfectionist — увеличиваем прогресс только если уровень ещё не в perfectLevels
    if (stars === 3 && !explorationUsed) {
      const perfectionist = this.findAchievement('perfectionist');
      if (perfectionist && !perfectionist.unlocked) {
        const alreadyPerfect = this.progress.perfectLevels.includes(levelId);
        if (!alreadyPerfect) {
          perfectionist.progress = (perfectionist.progress || 0) + 1;
          if (perfectionist.progress >= 10) this.unlockAchievement('perfectionist');
        }
      }
    }
    // no_exploration
    if (!explorationUsed && !this.findAchievement('no_exploration')?.unlocked) {
      this.unlockAchievement('no_exploration');
    }
    // backdoor_master
    if (backdoorUsed && !this.findAchievement('backdoor_master')?.unlocked) {
      this.unlockAchievement('backdoor_master');
    }
    // speedrunner (если stepsUsed < optimalSteps)
    if (stepsUsed < optimalSteps && !this.findAchievement('speedrunner')?.unlocked) {
      this.unlockAchievement('speedrunner');
    }
  }

  private updateAchievementsOnExploration(): void {
    const explorer = this.findAchievement('explorer');
    if (explorer && !explorer.unlocked) {
      explorer.progress = (explorer.progress || 0) + 1;
      if (explorer.progress >= 5) this.unlockAchievement('explorer');
    }
  }

  private updateAchievementsOnBackdoor(): void {
    // Резерв для будущих достижений, связанных с бэкдорами
  }

  private findAchievement(id: string): Achievement | undefined {
    return this.progress.achievements.find(a => a.id === id);
  }

  private unlockAchievement(id: string): void {
    const ach = this.findAchievement(id);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = Date.now();
      // Не сохраняем и не нотифицируем здесь — это сделает вызывающий метод
      eventBus.emit('ACHIEVEMENT_UNLOCKED', { achievementId: id });
    }
  }
}

export const progressManager = ProgressManager.getInstance();
