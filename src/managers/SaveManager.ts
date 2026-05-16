// src/managers/SaveManager.ts
// Эйдо: Управление сохранениями программ игрока (командные последовательности).
// Поддерживает несколько слотов (профилей), сохранение/загрузку программ,
// сохранение последнего уровня и мира, экспорт/импорт всех сохранений, сброс.

import { Command } from '../types/index';
import { gameEvents } from '../core/EventBus';

const STORAGE_KEY_SLOTS = 'cyberkid_save_slots';
const STORAGE_KEY_PROGRAM = (slotId: string, levelId: string) => `cyberkid_program_${slotId}_${levelId}`;
const STORAGE_KEY_SESSION = 'cyberkid_session';

export interface SaveSlotMeta {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  lastLevelId?: string;
  lastWorldId?: string;      // добавлено для восстановления мира
}

export interface SessionState {
  currentSlotId: string;
  currentWorldId: string;
  currentLevelId: string;
  commandQueue: Command[];
}

export interface ProgramSaveData {
  slotId: string;
  levelId: string;
  commands: Command[];
  savedAt: number;
  autoSaved: boolean;
}

export class SaveManager {
  private static instance: SaveManager;
  private slots: SaveSlotMeta[] = [];
  private currentSlotId: string | null = null;

  private constructor() {
    this.loadSlotsFromStorage();
    this.loadSessionFromStorage();
  }

  public static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  // Для тестов: сброс синглтона
  public static resetInstance(): void {
    SaveManager.instance = undefined as any;
  }

  // ---------- Управление слотами ----------
  public getAllSlots(): SaveSlotMeta[] {
    return [...this.slots];
  }

  public getCurrentSlot(): SaveSlotMeta | null {
    if (!this.currentSlotId) return null;
    return this.slots.find(s => s.id === this.currentSlotId) || null;
  }

  public createSlot(name: string, slotId?: string): SaveSlotMeta {
    const id = slotId || `slot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newSlot: SaveSlotMeta = {
      id,
      name,
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    };
    this.slots.push(newSlot);
    this.saveSlotsToStorage();
    this.setCurrentSlot(id);
    return newSlot;
  }

  public deleteSlot(slotId: string): boolean {
    const index = this.slots.findIndex(s => s.id === slotId);
    if (index === -1) return false;
    this.slots.splice(index, 1);
    this.saveSlotsToStorage();

    // Удаляем все программы этого слота
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`cyberkid_program_${slotId}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (this.currentSlotId === slotId) {
      if (this.slots.length > 0) {
        this.setCurrentSlot(this.slots[0].id);
      } else {
        this.currentSlotId = null;
        this.saveSessionToStorage();
      }
    }
    return true;
  }

  public setCurrentSlot(slotId: string): boolean {
    const slot = this.slots.find(s => s.id === slotId);
    if (!slot) return false;
    this.currentSlotId = slotId;
    slot.lastPlayedAt = Date.now();
    this.saveSlotsToStorage();
    this.saveSessionToStorage();
    return true;
  }

  // ---------- Сохранение / загрузка программ ----------
  public saveProgram(levelId: string, commands: Command[], autoSaved: boolean = false): void {
    if (!this.currentSlotId) {
      console.warn('[SaveManager] No active slot, cannot save program');
      return;
    }
    const saveData: ProgramSaveData = {
      slotId: this.currentSlotId,
      levelId,
      commands: [...commands],
      savedAt: Date.now(),
      autoSaved,
    };
    const key = STORAGE_KEY_PROGRAM(this.currentSlotId, levelId);
    try {
      localStorage.setItem(key, JSON.stringify(saveData));
      // Обновляем lastLevelId в метаданных слота
      const slot = this.slots.find(s => s.id === this.currentSlotId);
      if (slot) {
        slot.lastLevelId = levelId;
        this.saveSlotsToStorage();
      }
      gameEvents.emit('PROGRAM_SAVED', { levelId, slot: parseInt(this.currentSlotId.split('_')[1] || '0') });
    } catch (e) {
      console.error('[SaveManager] Failed to save program', e);
    }
  }

  public loadProgram(levelId: string): Command[] | null {
    if (!this.currentSlotId) return null;
    const key = STORAGE_KEY_PROGRAM(this.currentSlotId, levelId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw) as ProgramSaveData;
        gameEvents.emit('PROGRAM_LOADED', { commands: data.commands });
        return data.commands;
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to load program', e);
    }
    return null;
  }

  public deleteProgram(levelId: string): void {
    if (!this.currentSlotId) return;
    const key = STORAGE_KEY_PROGRAM(this.currentSlotId, levelId);
    localStorage.removeItem(key);
  }

  public hasSavedProgram(levelId: string): boolean {
    if (!this.currentSlotId) return false;
    const key = STORAGE_KEY_PROGRAM(this.currentSlotId, levelId);
    return localStorage.getItem(key) !== null;
  }

  // ---------- Сессия (текущий мир, уровень, очередь команд) ----------
  public saveSessionState(worldId: string, levelId: string, commandQueue: Command[]): void {
    if (!this.currentSlotId) return;
    // Обновляем lastWorldId и lastLevelId в слоте
    const slot = this.slots.find(s => s.id === this.currentSlotId);
    if (slot) {
      slot.lastWorldId = worldId;
      slot.lastLevelId = levelId;
      this.saveSlotsToStorage();
    }
    const session: SessionState = {
      currentSlotId: this.currentSlotId,
      currentWorldId: worldId,
      currentLevelId: levelId,
      commandQueue: [...commandQueue],
    };
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    } catch (e) {
      console.warn('[SaveManager] Failed to save session', e);
    }
  }

  public loadSessionState(): Partial<SessionState> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION);
      if (raw) {
        return JSON.parse(raw) as SessionState;
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to load session', e);
    }
    return null;
  }

  public updateCurrentLevel(levelId: string, worldId: string): void {
    if (!this.currentSlotId) return;
    const slot = this.slots.find(s => s.id === this.currentSlotId);
    if (slot) {
      slot.lastLevelId = levelId;
      slot.lastWorldId = worldId;
      this.saveSlotsToStorage();
    }
  }

  // ---------- Экспорт / импорт всех данных ----------
  public exportAllData(): string {
    const allData: Record<string, any> = {
      version: '1.0',
      slots: this.slots,
      currentSlotId: this.currentSlotId,
      programs: {},
    };
    for (const slot of this.slots) {
      const slotPrograms: Record<string, ProgramSaveData> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`cyberkid_program_${slot.id}_`)) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const data = JSON.parse(raw) as ProgramSaveData;
              slotPrograms[data.levelId] = data;
            }
          } catch (e) {}
        }
      }
      allData.programs[slot.id] = slotPrograms;
    }
    const sessionRaw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (sessionRaw) allData.session = JSON.parse(sessionRaw);
    return JSON.stringify(allData, null, 2);
  }

  public importAllData(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.version !== '1.0') {
        console.warn('[SaveManager] Unknown data version, import may fail');
      }
      if (data.slots && Array.isArray(data.slots)) {
        this.slots = data.slots;
        this.saveSlotsToStorage();
      }
      if (data.currentSlotId) {
        this.currentSlotId = data.currentSlotId;
      }
      if (data.programs) {
        for (const slotId of Object.keys(data.programs)) {
          const slotPrograms = data.programs[slotId];
          for (const levelId of Object.keys(slotPrograms)) {
            const progData = slotPrograms[levelId];
            const key = STORAGE_KEY_PROGRAM(slotId, levelId);
            localStorage.setItem(key, JSON.stringify(progData));
          }
        }
      }
      if (data.session) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(data.session));
      }
      this.saveSessionToStorage();
      // Не эмитим событие, так как импорт обычно не требует мгновенного обновления
      return true;
    } catch (e) {
      console.error('[SaveManager] Import failed', e);
      return false;
    }
  }

  public resetAllData(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cyberkid_') || key === STORAGE_KEY_SESSION)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    this.slots = [];
    this.currentSlotId = null;
    this.saveSlotsToStorage();
    this.saveSessionToStorage();
    this.createSlot('Игрок');
  }

  // ---------- Приватные вспомогательные методы ----------
  private loadSlotsFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
      if (raw) {
        this.slots = JSON.parse(raw);
        return;
      }
    } catch (e) {}
    this.slots = [{ id: 'slot_default', name: 'Игрок', createdAt: Date.now(), lastPlayedAt: Date.now() }];
    this.saveSlotsToStorage();
  }

  private saveSlotsToStorage(): void {
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(this.slots));
  }

  private loadSessionFromStorage(): void {
    const session = this.loadSessionState();
    if (session && session.currentSlotId) {
      if (this.slots.some(s => s.id === session.currentSlotId)) {
        this.currentSlotId = session.currentSlotId;
      } else {
        this.currentSlotId = this.slots[0]?.id || null;
      }
    } else {
      this.currentSlotId = this.slots[0]?.id || null;
    }
  }

  private saveSessionToStorage(): void {
    if (!this.currentSlotId) return;
    const slot = this.slots.find(s => s.id === this.currentSlotId);
    const session: Partial<SessionState> = {
      currentSlotId: this.currentSlotId,
      currentWorldId: slot?.lastWorldId || 'meadow',
      currentLevelId: slot?.lastLevelId || 'meadow_001',
      commandQueue: [],
    };
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  }
}

export const saveManager = SaveManager.getInstance();
