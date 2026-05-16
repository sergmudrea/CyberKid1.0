// src/managers/SettingsManager.ts
// Эйдо: Управление настройками пользователя с сохранением в localStorage.
// Полная поддержка LearningMode, языка, звука, вибрации, авто-подсказок.
// Одиночка (Singleton), эмитит SETTINGS_CHANGED только один раз за изменение.

import { UserSettings, LearningMode, gameEvents } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';

const STORAGE_KEY = 'cyberkid_settings';
const DEFAULT_SETTINGS: UserSettings = {
  learningMode: LearningMode.SCHOLAR,
  language: 'en',
  soundEnabled: true,
  musicEnabled: true,
  soundVolume: 0.7,
  musicVolume: 0.5,
  vibrationEnabled: true,
  showTutorials: true,
  autoHints: true,
  developerMode: false,
};

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: UserSettings;
  private listeners: Array<(settings: UserSettings) => void> = [];

  private constructor() {
    this.settings = this.loadFromLocalStorage();
    this.applySideEffectsForAll();
    // Синхронизируем EventBus debug режим при старте
    this.syncEventBusDebug();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  // Получить текущие настройки (копия для защиты от мутаций)
  public get(): UserSettings {
    return { ...this.settings };
  }

  // Получить конкретное значение
  public getValue<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key];
  }

  // Установить одно значение
  public set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.applySideEffects(key, value);
    this.saveToLocalStorage();
    this.notifyListeners();
    // Единоразовая эмиссия события после всех изменений
    eventBus.emit('SETTINGS_CHANGED', this.settings);
  }

  // Массовое обновление (например, при загрузке профиля)
  public update(newSettings: Partial<UserSettings>): void {
    let changed = false;
    for (const key in newSettings) {
      const k = key as keyof UserSettings;
      if (newSettings[k] !== undefined && this.settings[k] !== newSettings[k]) {
        this.settings[k] = newSettings[k]!;
        this.applySideEffects(k, this.settings[k]);
        changed = true;
      }
    }
    if (changed) {
      this.saveToLocalStorage();
      this.notifyListeners();
      eventBus.emit('SETTINGS_CHANGED', this.settings);
    }
  }

  // Подписка на изменения (альтернатива EventBus для внутренних нужд)
  public subscribe(callback: (settings: UserSettings) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Сброс до значений по умолчанию
  public reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToLocalStorage();
    this.notifyListeners();
    eventBus.emit('SETTINGS_CHANGED', this.settings);
  }

  // Вспомогательные методы для UI
  public toggleSound(): void {
    this.set('soundEnabled', !this.settings.soundEnabled);
  }

  public toggleMusic(): void {
    this.set('musicEnabled', !this.settings.musicEnabled);
  }

  public toggleVibration(): void {
    this.set('vibrationEnabled', !this.settings.vibrationEnabled);
  }

  public toggleDeveloperMode(): void {
    this.set('developerMode', !this.settings.developerMode);
  }

  // Вибрация (короткая)
  public vibrateShort(): void {
    if (this.settings.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(20);
    }
  }

  // Вибрация (длинная)
  public vibrateLong(): void {
    if (this.settings.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(100);
    }
  }

  // Применение побочных эффектов при изменении конкретного ключа
  private applySideEffects<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    switch (key) {
      case 'vibrationEnabled':
        // Ничего дополнительного не требуется, vibrate проверяет флаг
        break;
      case 'developerMode':
        this.syncEventBusDebug();
        break;
      case 'soundEnabled':
      case 'musicEnabled':
      case 'soundVolume':
      case 'musicVolume':
        // Здесь можно будет вызвать AudioManager.update(), но пока нет.
        // НЕ эмитим SETTINGS_CHANGED повторно — событие уже будет отправлено в set/update.
        break;
      case 'learningMode':
        // Можно будет уведомить UI о смене режима (перерисовать панель команд)
        break;
      case 'language':
        // Можно будет уведомить систему локализации
        break;
      default:
        // Другие поля пока не требуют сайд-эффектов
        break;
    }
  }

  // Применение всех сайд-эффектов при загрузке (например, синхронизация дебага)
  private applySideEffectsForAll(): void {
    this.syncEventBusDebug();
  }

  // Синхронизация режима отладки EventBus
  private syncEventBusDebug(): void {
    // Используем импортированный gameEvents из core/EventBus
    if (this.settings.developerMode) {
      eventBus.setDebug(true);
    } else {
      eventBus.setDebug(false);
    }
  }

  private loadFromLocalStorage(): UserSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('[SettingsManager] Failed to load settings', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[SettingsManager] Failed to save settings', e);
    }
  }

  private notifyListeners(): void {
    const copy = this.get();
    this.listeners.forEach(cb => cb(copy));
  }
}

// Синглтон для использования во всём приложении
export const settingsManager = SettingsManager.getInstance();
