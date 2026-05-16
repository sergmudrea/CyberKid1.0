// src/core/EventBus.ts
// Эйдо: Центральная шина событий. Все модули общаются только через неё.
// Полная типизация на основе GameEvent из types/index.ts.

import { GameEvent } from '../types/index';
import Phaser from 'phaser';

type EventType = GameEvent['type'];
type EventPayload<T extends EventType> = Extract<GameEvent, { type: T }>['payload'];

export class EventBus {
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
    if (this.debugMode) {
      console.log('[EventBus] Debug mode enabled');
    }
  }

  // Отправка типизированного события
  public emit<T extends EventType>(type: T, payload?: EventPayload<T>): void {
    if (this.debugMode) {
      console.log(`[EventBus] EMIT: ${type}`, payload ?? '');
    }
    this.emitter.emit(type, payload);
  }

  // Подписка на событие
  public on<T extends EventType>(
    type: T,
    callback: (payload?: EventPayload<T>) => void,
    context?: any
  ): void {
    if (this.debugMode) {
      console.log(`[EventBus] ON: ${type}`);
    }
    this.emitter.on(type, callback, context);
  }

  // Отписка
  public off<T extends EventType>(
    type: T,
    callback?: (payload?: EventPayload<T>) => void,
    context?: any
  ): void {
    if (this.debugMode) {
      console.log(`[EventBus] OFF: ${type}`);
    }
    this.emitter.off(type, callback, context);
  }

  // Однократная подписка
  public once<T extends EventType>(
    type: T,
    callback: (payload?: EventPayload<T>) => void,
    context?: any
  ): void {
    if (this.debugMode) {
      console.log(`[EventBus] ONCE: ${type}`);
    }
    this.emitter.once(type, callback, context);
  }

  // Очистить все слушатели (при перезагрузке сцены)
  public removeAllListeners(): void {
    if (this.debugMode) {
      console.log('[EventBus] Removing all listeners');
    }
    this.emitter.removeAllListeners();
  }

  // Удалить всех слушателей конкретного события
  public removeAllListenersFor<T extends EventType>(type: T): void {
    if (this.debugMode) {
      console.log(`[EventBus] Removing all listeners for ${type}`);
    }
    this.emitter.removeAllListeners(type);
  }

  // Получить количество слушателей (для тестирования)
  public listenerCount<T extends EventType>(type: T): number {
    return this.emitter.listenerCount(type);
  }

  // Проверка, есть ли слушатели
  public hasListeners<T extends EventType>(type: T): boolean {
    return this.emitter.listenerCount(type) > 0;
  }
}

// Синглтон для использования во всём приложении
export const gameEvents = EventBus.getInstance();

// Экспорт типов для удобства
export type { EventType, EventPayload };
