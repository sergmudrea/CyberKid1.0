// src/scenes/GameScene.ts
// Эйдо: Основная игровая сцена. Интегрирует все модули:
// LevelMap (рендеринг), Player (персонаж), CommandPanel (UI),
// ExecutionEngine (выполнение команд), Pathfinder (оптимальный путь, звёзды),
// HintSystem (подсказки), ExplorationMode (свободное исследование).
// Обрабатывает загрузку уровня, сохранённой программы, запуск выполнения,
// победу/поражение, запись прогресса.

import { Scene } from 'phaser';
import { LevelData, Command, PathResult } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { saveManager } from '../managers/SaveManager';
import { settingsManager } from '../managers/SettingsManager';
import { LevelMap } from '../modules/LevelMap';
import { Player } from '../modules/Player';
import { CommandPanel } from '../modules/CommandPanel';
import { ExecutionEngine } from '../modules/ExecutionEngine';
import { Pathfinder } from '../modules/Pathfinder';
import { HintSystem } from '../modules/HintSystem';
import { ExplorationMode } from '../modules/ExplorationMode';

export class GameScene extends Scene {
  private level: LevelData | null = null;
  private levelId: string = '';
  private levelMap: LevelMap | null = null;
  private player: Player | null = null;
  private commandPanel: CommandPanel | null = null;
  private executionEngine: ExecutionEngine | null = null;
  private pathfinder: Pathfinder | null = null;
  private hintSystem: HintSystem | null = null;
  private explorationMode: ExplorationMode | null = null;

  private isExecuting: boolean = false;
  private currentProgram: Command[] = [];
  private victoryPending: boolean = false;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId: string }): void {
    this.levelId = data.levelId;
  }

  async create(): Promise<void> {
    // Загружаем уровень
    this.level = await levelManager.loadLevel(this.levelId);
    if (!this.level) {
      console.error(`Failed to load level ${this.levelId}`);
      this.scene.start('LevelSelect', { worldId: 'meadow', levelNum: 1 });
      return;
    }

    // Создаём модули
    this.createLevelMap();
    this.createPlayer();
    this.createCommandPanel();
    this.createPathfinder();
    this.createHintSystem();
    this.createExplorationMode();
    this.createExecutionEngine();

    // Загружаем сохранённую программу
    this.loadSavedProgram();

    // Настраиваем доступные команды (из уровня/мира)
    this.setAvailableCommands();

    // Подписываемся на события
    this.setupEventListeners();

    // Показываем начальное состояние
    this.updateUI();

    // Запускаем HintSystem
    if (this.hintSystem) this.hintSystem.setActive(true);

    // Очищаем обработчики при уничтожении сцены
    this.events.once('shutdown', () => this.removeEventListeners());
  }

  update(): void {
    // Можно добавить анимации, но основные обновления через события
  }

  // ---------- Создание модулей ----------
  private createLevelMap(): void {
    if (!this.level) return;
    this.levelMap = new LevelMap(this, this.level, 48);
    this.levelMap.setExplorationMode(false);
  }

  private createPlayer(): void {
    if (!this.level) return;
    const tileGetter = (col: number, row: number): number => {
      if (!this.level) return 0;
      return this.level.map[row]?.[col] ?? 0;
    };
    this.player = new Player(this.level.startPos, 'right', this.level.width, this.level.height, tileGetter);
    this.player.setGhostMode(false);
  }

  private createCommandPanel(): void {
    this.commandPanel = new CommandPanel(this);
    this.commandPanel.show();
  }

  private createPathfinder(): void {
    if (!this.level) return;
    this.pathfinder = new Pathfinder(this.level);
    this.pathfinder.setExplorationMode(false);
  }

  private createHintSystem(): void {
    if (!this.level || !this.player) return;
    this.hintSystem = new HintSystem(this.level);
    this.hintSystem.updateState(
      this.player.getPosition(),
      this.player.getDirection(),
      this.player.getInventory(),
      this.level.objects.monsters
    );
  }

  private createExplorationMode(): void {
    if (!this.player || !this.levelMap) return;
    this.explorationMode = new ExplorationMode();
    this.explorationMode.setPlayer(this.player);
    this.explorationMode.setLevelMap(this.levelMap);
    this.explorationMode.setLevel(this.levelId);
    this.explorationMode.onToggle((active) => {
      if (this.pathfinder) this.pathfinder.setExplorationMode(active);
      if (this.hintSystem) this.hintSystem.setActive(!active);
      this.updateUI();
    });
  }

  private createExecutionEngine(): void {
    if (!this.level || !this.player) return;
    this.executionEngine = new ExecutionEngine(this.level, this.player);
  }

  // ---------- Загрузка и настройка ----------
  private loadSavedProgram(): void {
    const saved = saveManager.loadProgram(this.levelId);
    if (saved && saved.length > 0) {
      this.currentProgram = saved;
    } else if (this.level?.initialCode) {
      this.currentProgram = [...this.level.initialCode];
    } else {
      this.currentProgram = [];
    }
    if (this.commandPanel) {
      this.commandPanel.loadProgram(this.levelId, this.currentProgram);
    }
  }

  private setAvailableCommands(): void {
    if (!this.commandPanel || !this.level) return;
    const allCommands = Object.values(Command).filter(c => typeof c === 'string') as Command[];
    this.commandPanel.setAvailableCommands(allCommands);
  }

  // ---------- Обработка событий ----------
  private setupEventListeners(): void {
    eventBus.on('COMMAND_QUEUE_CHANGED', this.onCommandQueueChanged.bind(this));
    eventBus.on('EXECUTION_START', this.onExecutionStart.bind(this));
    eventBus.on('EXECUTION_FINISHED', this.onExecutionFinished.bind(this));
    eventBus.on('EXECUTION_STEP', this.onExecutionStep.bind(this));
    eventBus.on('PLAYER_MOVED', this.onPlayerMoved.bind(this));
    eventBus.on('PLAYER_DIED', this.onPlayerDied.bind(this));
    eventBus.on('EXPLORATION_TOGGLED', this.onExplorationToggled.bind(this));
    eventBus.on('PROGRESS_UPDATED', this.onProgressUpdated.bind(this));
  }

  private removeEventListeners(): void {
    eventBus.off('COMMAND_QUEUE_CHANGED', this.onCommandQueueChanged.bind(this));
    eventBus.off('EXECUTION_START', this.onExecutionStart.bind(this));
    eventBus.off('EXECUTION_FINISHED', this.onExecutionFinished.bind(this));
    eventBus.off('EXECUTION_STEP', this.onExecutionStep.bind(this));
    eventBus.off('PLAYER_MOVED', this.onPlayerMoved.bind(this));
    eventBus.off('PLAYER_DIED', this.onPlayerDied.bind(this));
    eventBus.off('EXPLORATION_TOGGLED', this.onExplorationToggled.bind(this));
    eventBus.off('PROGRESS_UPDATED', this.onProgressUpdated.bind(this));
  }

  private onCommandQueueChanged(payload: any): void {
    if (payload && payload.commands) {
      this.currentProgram = payload.commands;
      if (!this.isExecuting) {
        saveManager.saveProgram(this.levelId, this.currentProgram, false);
      }
    }
  }

  private onExecutionStart(): void {
    this.isExecuting = true;
    if (this.commandPanel) this.commandPanel.setExecuting(true);
    if (this.hintSystem) this.hintSystem.setActive(false);
  }

  private onExecutionFinished(payload: any): void {
    this.isExecuting = false;
    if (this.commandPanel) this.commandPanel.setExecuting(false);
    if (this.hintSystem && !this.explorationMode?.isActive()) {
      this.hintSystem.setActive(true);
    }
    if (payload && payload.success && payload.result) {
      this.handleVictory(payload.result);
    } else if (payload && !payload.success) {
      this.handleDefeat();
    }
  }

  private onExecutionStep(): void {
    if (this.hintSystem && this.player && this.level) {
      this.hintSystem.updateState(
        this.player.getPosition(),
        this.player.getDirection(),
        this.player.getInventory(),
        this.level.objects.monsters
      );
    }
  }

  private onPlayerMoved(): void {
    if (this.hintSystem && this.player && this.level) {
      this.hintSystem.updateState(
        this.player.getPosition(),
        this.player.getDirection(),
        this.player.getInventory(),
        this.level.objects.monsters
      );
    }
  }

  private onPlayerDied(): void {
    this.handleDefeat();
  }

  private onExplorationToggled(payload: any): void {
    if (payload && this.level && this.pathfinder) {
      this.pathfinder.setExplorationMode(payload.enabled);
    }
  }

  private onProgressUpdated(): void {
    this.updateUI();
  }

  // ---------- Игровая логика ----------
  private async handleVictory(result: PathResult): Promise<void> {
    if (this.victoryPending) return;
    this.victoryPending = true;

    const explorationUsed = this.explorationMode?.isActive() || false;
    const backdoorUsed = result.backdoorFound;

    // Сохраняем прогресс — порядок аргументов: levelId, stars, blackStar, steps, explorationUsed, backdoorUsed, optimalSteps
    progressManager.completeLevel(
      this.levelId,
      result.starsEarned,
      backdoorUsed,           // blackStar
      result.stepsCount,
      explorationUsed,        // explorationUsed
      backdoorUsed,           // backdoorUsed
      this.level?.optimalSteps || 0
    );

    if (explorationUsed) {
      progressManager.recordExplorationUsed(this.levelId);
    }
    if (backdoorUsed) {
      progressManager.recordBackdoorFound(this.levelId, 'backdoor');
    }

    if (this.executionEngine) this.executionEngine.stop();

    this.scene.start('VictoryScreen', {
      levelId: this.levelId,
      stars: result.starsEarned,
      blackStar: backdoorUsed,
      stepsUsed: result.stepsCount,
      optimalSteps: this.level?.optimalSteps || 0,
      explorationUsed,
    });
  }

  private handleDefeat(): void {
    if (this.victoryPending) return;
    progressManager.recordDeath(this.levelId, 'enemy');
    if (this.executionEngine) this.executionEngine.stop();
    this.isExecuting = false;
    if (this.commandPanel) this.commandPanel.setExecuting(false);
    const lang = settingsManager.get().language;
    const msg = lang === 'ru' ? 'Вы проиграли! Попробуйте снова.' : 'You lost! Try again.';
    // Временно используем alert, позже заменить на кастомный тост
    alert(msg);
    // Сохраняем текущую программу перед перезагрузкой
    saveManager.saveProgram(this.levelId, this.currentProgram, false);
    this.resetLevel();
  }

  private resetLevel(): void {
    this.victoryPending = false;
    this.scene.restart({ levelId: this.levelId });
  }

  private updateUI(): void {
    // Обновление информации на панели (при необходимости)
  }
}
