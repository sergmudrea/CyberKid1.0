// src/core/EventBus.ts
// Эйдо: Центральная шина событий. Все модули общаются только через неё.
// Импортируем типы событий из ядра.
import { GameEvent } from '../types/index';
import Phaser from 'phaser';

type EventCallback = (payload?: any) => void;

class EventBus {
  private static instance: EventBus;
  private emitter: Phaser.Events.EventEmitter;
  private debugMode: boolean = false;

  private constructor() {
    this.emitter = new Phaser.Events.EventEmitter();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Включение отладочного логирования (только для Developer Mode)
  public setDebug(enabled: boolean): void {
    this.debugMode = enabled;
  }

  // Отправка типизированного события
  public emit<T extends GameEvent['type']>(
    type: T,
    payload?: Extract<GameEvent, { type: T }>['payload']
  ): void {
    if (this.debugMode) {
      console.log(`[EventBus] ${type}`, payload);
    }
    this.emitter.emit(type, payload);
  }

  // Подписка на событие
  public on<T extends GameEvent['type']>(
    type: T,
    callback: (payload?: Extract<GameEvent, { type: T }>['payload']) => void,
    context?: any
  ): void {
    this.emitter.on(type, callback, context);
  }

  // Отписка
  public off<T extends GameEvent['type']>(
    type: T,
    callback?: (payload?: any) => void,
    context?: any
  ): void {
    this.emitter.off(type, callback, context);
  }

  // Однократная подписка
  public once<T extends GameEvent['type']>(
    type: T,
    callback: (payload?: Extract<GameEvent, { type: T }>['payload']) => void,
    context?: any
  ): void {
    this.emitter.once(type, callback, context);
  }

  // Очистить все слушатели (при перезагрузке сцены)
  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

// Синглтон для использования во всём приложении
export const gameEvents = EventBus.getInstance();

// Также экспортируем класс для возможности тестирования
export { EventBus };
