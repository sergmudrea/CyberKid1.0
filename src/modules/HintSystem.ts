// src/modules/HintSystem.ts
// Эйдо: Система автоматических подсказок для игрока.
// Отслеживает бездействие (отсутствие выполнения программы или движения в Exploration Mode),
// анализирует контекст (окружение, инвентарь, монстры) и выдаёт подсказки с повышающимся уровнем детализации.
// Интегрируется с Pathfinder для получения конкретных шагов.

import { LevelData, Point, Inventory, Monster, Command, LearningMode } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';
import { Pathfinder } from './Pathfinder';

export type HintTier = 1 | 2 | 3 | 4 | 5; // 1 — лёгкий намёк, 5 — прямое указание шагов

export interface Hint {
  text: string;
  tier: HintTier;
  type: 'move' | 'mechanic' | 'encouragement' | 'solution';
  targetPosition?: Point;   // для подсветки клетки
  commandHint?: Command;     // какая команда может помочь
}

export class HintSystem {
  private level: LevelData;
  private playerPosition: Point;
  private playerDirection: 'up' | 'down' | 'left' | 'right';
  private inventory: Inventory;
  private monsters: Monster[];
  private pathfinder: Pathfinder;
  private lastActionTime: number = Date.now();
  private currentTier: HintTier = 1;
  private hintTimer: number | null = null;
  private active: boolean = true;
  private explorationMode: boolean = false;
  private language: 'ru' | 'en' = 'en';
  private learningMode: LearningMode = LearningMode.SCHOLAR;

  // Конфигурация таймингов (в миллисекундах)
  private readonly TIER_TIMINGS: Record<HintTier, number> = {
    1: 15000,  // 15 сек — беспокойство (тип encouragement)
    2: 30000,  // 30 сек — направление (move)
    3: 60000,  // 60 сек — механика (mechanic)
    4: 90000,  // 90 сек — специфичная для уровня подсказка
    5: 120000, // 120 сек — решение (конкретные шаги)
  };

  constructor(level: LevelData) {
    this.level = level;
    this.playerPosition = { ...level.startPos };
    this.playerDirection = 'right';
    this.inventory = { keys: [], corn: 0, cores: 0, hasDrill: false, hasHook: false, hasWing: false, hasBait: false, tools: [] };
    this.monsters = [];
    this.pathfinder = new Pathfinder(level);
    this.pathfinder.setExplorationMode(this.explorationMode);
    this.updateSettings();
    this.setupEventListeners();
    this.startTimer();
  }

  // Обновление состояния игрока (вызывается из GameScene при каждом шаге)
  public updateState(
    pos: Point,
    dir: 'up' | 'down' | 'left' | 'right',
    inv: Inventory,
    monsters: Monster[]
  ): void {
    this.playerPosition = { ...pos };
    this.playerDirection = dir;
    this.inventory = { ...inv };
    this.monsters = monsters.map(m => ({ ...m }));
    this.resetTimer();
  }

  // Включение/выключение системы подсказок
  public setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  // Обновление настроек (язык, режим обучения)
  public updateSettings(): void {
    const settings = settingsManager.get();
    this.language = settings.language;
    this.learningMode = settings.learningMode;
    // В режиме Developer подсказки не показываем (или показываем минимально)
    if (this.learningMode === LearningMode.DEVELOPER) {
      this.active = false;
    } else {
      this.active = settings.autoHints;
    }
  }

  // Принудительный сброс таймера (при движении игрока или выполнении команды)
  public resetTimer(): void {
    this.lastActionTime = Date.now();
    this.currentTier = 1;
    this.stopTimer();
    if (this.active) this.startTimer();
  }

  // Получение подсказки по требованию (для кнопки "Help")
  public getManualHint(): Hint {
    const contextHint = this.analyzeContext();
    if (contextHint) return contextHint;
    return this.getFallbackHint();
  }

  // ---------- Приватные методы ----------
  private startTimer(): void {
    if (this.hintTimer) clearInterval(this.hintTimer);
    // Используем интервал для проверки прогрессии тиров
    this.hintTimer = window.setInterval(() => {
      if (!this.active) return;
      const elapsed = Date.now() - this.lastActionTime;
      let newTier: HintTier | null = null;
      if (elapsed >= this.TIER_TIMINGS[5]) newTier = 5;
      else if (elapsed >= this.TIER_TIMINGS[4]) newTier = 4;
      else if (elapsed >= this.TIER_TIMINGS[3]) newTier = 3;
      else if (elapsed >= this.TIER_TIMINGS[2]) newTier = 2;
      else if (elapsed >= this.TIER_TIMINGS[1]) newTier = 1;
      if (newTier !== null && newTier > this.currentTier) {
        this.currentTier = newTier;
        this.showHintForTier(this.currentTier);
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.hintTimer) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
  }

  private showHintForTier(tier: HintTier): void {
    let hint: Hint | null = null;
    switch (tier) {
      case 1:
        hint = this.getRestlessHint();
        break;
      case 2:
        hint = this.getDirectionHint();
        break;
      case 3:
        hint = this.getMechanicHint();
        break;
      case 4:
        hint = this.getLevelSpecificHint();
        break;
      case 5:
        hint = this.getSolutionHint();
        break;
    }
    if (hint) {
      this.emitHint(hint);
    }
  }

  private getRestlessHint(): Hint {
    const texts: Record<'ru' | 'en', string[]> = {
      ru: ['Что-то не так? Попробуй подумать иначе.', 'Может, стоит посмотреть вокруг?', 'Не сдавайся!'],
      en: ['Something wrong? Try a different approach.', 'Maybe look around?', 'Don\'t give up!'],
    };
    const random = Math.floor(Math.random() * texts[this.language].length);
    return {
      text: texts[this.language][random],
      tier: 1,
      type: 'encouragement',
    };
  }

  private getDirectionHint(): Hint {
    // Используем Pathfinder для получения следующего шага
    const nextMove = this.pathfinder.getHint(this.playerPosition, this.inventory, this.monsters, this.playerDirection);
    if (nextMove) {
      let dirText = '';
      if (nextMove.col > this.playerPosition.col) dirText = this.language === 'ru' ? 'вправо' : 'right';
      else if (nextMove.col < this.playerPosition.col) dirText = this.language === 'ru' ? 'влево' : 'left';
      else if (nextMove.row > this.playerPosition.row) dirText = this.language === 'ru' ? 'вниз' : 'down';
      else if (nextMove.row < this.playerPosition.row) dirText = this.language === 'ru' ? 'вверх' : 'up';
      const text = this.language === 'ru' 
        ? `Попробуй двигаться ${dirText}.` 
        : `Try moving ${dirText}.`;
      return {
        text,
        tier: 2,
        type: 'move',
        targetPosition: nextMove,
      };
    }
    return this.getMechanicHint();
  }

  private getMechanicHint(): Hint {
    const contextHint = this.analyzeContext();
    if (contextHint) return contextHint;
    // Общая подсказка о механиках
    const texts: Record<'ru' | 'en', string> = {
      ru: 'Используй доступные инструменты (ключи, кукурузу, дрель) для преодоления препятствий.',
      en: 'Use available tools (keys, corn, drill) to overcome obstacles.',
    };
    return {
      text: texts[this.language],
      tier: 3,
      type: 'mechanic',
    };
  }

  private getLevelSpecificHint(): Hint {
    // Анализ препятствий вокруг
    const frontPos = this.getFrontPosition();
    if (this.isWallAt(frontPos) && this.inventory.hasDrill) {
      const text = this.language === 'ru' 
        ? 'Стена преграждает путь. Используй дрель (команда DRILL), чтобы разрушить её.' 
        : 'A wall blocks the way. Use the drill (DRILL command) to break it.';
      return { text, tier: 4, type: 'mechanic', commandHint: Command.DRILL };
    }
    if (this.isHoleAt(frontPos) && this.inventory.hasWing) {
      const text = this.language === 'ru'
        ? 'Впереди яма. Используй крылья (команда WING), чтобы перелететь.'
        : 'A hole ahead. Use wings (WING command) to fly over.';
      return { text, tier: 4, type: 'mechanic', commandHint: Command.WING };
    }
    if (this.isMonsterAt(frontPos) && this.inventory.corn > 0) {
      const text = this.language === 'ru'
        ? 'Монстр впереди. Накорми его кукурузой (команда FEED), чтобы приручить.'
        : 'A monster ahead. Feed it corn (FEED command) to tame it.';
      return { text, tier: 4, type: 'mechanic', commandHint: Command.FEED };
    }
    // Подсказка о цели
    const coinPos = this.level.coinPos;
    const dx = coinPos.col - this.playerPosition.col;
    const dy = coinPos.row - this.playerPosition.row;
    let dirToCoin = '';
    if (Math.abs(dx) > Math.abs(dy)) {
      dirToCoin = dx > 0 ? (this.language === 'ru' ? 'вправо' : 'right') : (this.language === 'ru' ? 'влево' : 'left');
    } else {
      dirToCoin = dy > 0 ? (this.language === 'ru' ? 'вниз' : 'down') : (this.language === 'ru' ? 'вверх' : 'up');
    }
    const text = this.language === 'ru'
      ? `Цель находится ${dirToCoin} от тебя.`
      : `The goal is ${dirToCoin} from you.`;
    return { text, tier: 4, type: 'move' };
  }

  private getSolutionHint(): Hint {
    // Получаем первые 3 шага оптимального пути
    const optimalPath = this.pathfinder.findOptimalPath();
    if (optimalPath && optimalPath.path.length > 1) {
      const nextSteps = optimalPath.path.slice(1, Math.min(4, optimalPath.path.length));
      const stepsText = nextSteps.map((step, idx) => {
        let dir = '';
        if (step.col > this.playerPosition.col) dir = this.language === 'ru' ? 'вправо' : 'right';
        else if (step.col < this.playerPosition.col) dir = this.language === 'ru' ? 'влево' : 'left';
        else if (step.row > this.playerPosition.row) dir = this.language === 'ru' ? 'вниз' : 'down';
        else dir = this.language === 'ru' ? 'вверх' : 'up';
        return `${idx + 1}) ${dir}`;
      }).join('; ');
      const text = this.language === 'ru'
        ? `Оптимальные следующие шаги: ${stepsText}`
        : `Optimal next steps: ${stepsText}`;
      return {
        text,
        tier: 5,
        type: 'solution',
        targetPosition: nextSteps[0],
      };
    }
    return {
      text: this.language === 'ru' ? 'Попробуй сбросить программу и подумать заново.' : 'Try resetting the program and think again.',
      tier: 5,
      type: 'encouragement',
    };
  }

  private analyzeContext(): Hint | null {
    // Анализируем окружение на наличие ключей, дверей, монстров, ям
    const frontPos = this.getFrontPosition();
    if (this.isDoorAt(frontPos)) {
      if (this.inventory.keys.length > 0) {
        const text = this.language === 'ru'
          ? 'Закрытая дверь. Используй ключ (команда USE_KEY), чтобы открыть.'
          : 'Locked door. Use a key (USE_KEY command) to open.';
        return { text, tier: 3, type: 'mechanic', commandHint: Command.USE_KEY };
      } else {
        const text = this.language === 'ru'
          ? 'Нужен ключ. Поищи ключ на уровне.'
          : 'You need a key. Look for a key on the level.';
        return { text, tier: 3, type: 'mechanic' };
      }
    }
    if (this.isKeyNearby()) {
      const text = this.language === 'ru'
        ? 'Рядом ключ. Подбери его (команда PICKUP или просто наступи).'
        : 'A key is nearby. Pick it up (PICKUP command or step on it).';
      return { text, tier: 2, type: 'move' };
    }
    // Проверка инвентаря на наличие неиспользованных инструментов
    if (this.inventory.hasDrill) {
      const text = this.language === 'ru'
        ? 'У тебя есть дрель. Ею можно разрушать стены (команда DRILL).'
        : 'You have a drill. Use it to break walls (DRILL command).';
      return { text, tier: 3, type: 'mechanic', commandHint: Command.DRILL };
    }
    if (this.inventory.hasHook) {
      const text = this.language === 'ru'
        ? 'У тебя есть крюк. Притянись к стене (команда HOOK).'
        : 'You have a hook. Pull yourself to a wall (HOOK command).';
      return { text, tier: 3, type: 'mechanic', commandHint: Command.HOOK };
    }
    return null;
  }

  private getFrontPosition(): Point {
    switch (this.playerDirection) {
      case 'up': return { col: this.playerPosition.col, row: this.playerPosition.row - 1 };
      case 'down': return { col: this.playerPosition.col, row: this.playerPosition.row + 1 };
      case 'left': return { col: this.playerPosition.col - 1, row: this.playerPosition.row };
      case 'right': return { col: this.playerPosition.col + 1, row: this.playerPosition.row };
    }
  }

  private isWallAt(pos: Point): boolean {
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === 4 || tile === 5;
  }
  private isHoleAt(pos: Point): boolean {
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === 2;
  }
  private isMonsterAt(pos: Point): boolean {
    return this.monsters.some(m => m.position.col === pos.col && m.position.row === pos.row);
  }
  private isDoorAt(pos: Point): boolean {
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === 11;
  }
  private isKeyNearby(): boolean {
    // Проверка клеток вокруг игрока
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const pos = { col: this.playerPosition.col + dx, row: this.playerPosition.row + dy };
        const tile = this.level.map[pos.row]?.[pos.col];
        if (tile === 10) return true;
      }
    }
    return false;
  }

  private getFallbackHint(): Hint {
    return {
      text: this.language === 'ru' ? 'Попробуй использовать команды движения и посмотреть, что произойдёт.' : 'Try using movement commands and see what happens.',
      tier: 1,
      type: 'encouragement',
    };
  }

  private emitHint(hint: Hint): void {
    eventBus.emit('HINT_SHOWN', { hintText: hint.text, tier: hint.tier });
    // В реальном приложении можно также показать тост или визуальный эффект
    console.log(`[HintSystem] Tier ${hint.tier}: ${hint.text}`);
  }

  private setupEventListeners(): void {
    eventBus.on('SETTINGS_CHANGED', () => this.updateSettings());
    eventBus.on('EXECUTION_STEP', () => this.resetTimer());
    eventBus.on('PLAYER_MOVED', () => this.resetTimer());
    eventBus.on('EXPLORATION_TOGGLED', () => this.resetTimer());
  }

  // Очистка при уничтожении
  public destroy(): void {
    this.stopTimer();
    eventBus.off('SETTINGS_CHANGED');
    eventBus.off('EXECUTION_STEP');
    eventBus.off('PLAYER_MOVED');
    eventBus.off('EXPLORATION_TOGGLED');
  }
}
