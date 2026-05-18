// src/scenes/GameScene.ts
// ПРОМЕТЕЙ: Полностью переработанная сцена GameScene с интеграцией нового ExecutionEngine.
// Поддерживает клоны, функции, ООП, Exploration Mode, подсказки, запись прогресса.
// Обрабатывает новые события: OBJECT_CREATED, CLONES_JOINED, CLONE_MOVED и т.д.

import { Scene } from 'phaser';
import { LevelData, Command } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { levelManager } from '../managers/LevelManager';
import { progressManager } from '../managers/ProgressManager';
import { saveManager } from '../managers/SaveManager';
import { settingsManager } from '../managers/SettingsManager';
import { LevelMap } from '../modules/LevelMap';
import { Player } from '../modules/Player';
import { CommandPanel, ProgramItem } from '../modules/CommandPanel';
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
  private currentProgram: ProgramItem[] = [];
  private victoryPending: boolean = false;
  private cloneStepInterval: number | null = null;

  constructor() {
    super('GameScene');
  }

  init(data: { levelId?: string; levelData?: LevelData }): void {
    if (data.levelData) {
      this.level = data.levelData;
      this.levelId = this.level.id;
    } else if (data.levelId) {
      this.levelId = data.levelId;
      this.level = null;
    } else {
      console.error('No level data provided');
      this.scene.start('MainMenu');
    }
  }

  async create(): Promise<void> {
    if (!this.level) {
      this.level = await levelManager.loadLevel(this.levelId);
    }
    if (!this.level) {
      console.error(`Failed to load level ${this.levelId}`);
      this.scene.start('LevelSelect', { worldId: 'meadow', levelNum: 1 });
      return;
    }

    this.createLevelMap();
    this.createPlayer();
    this.createCommandPanel();
    this.createPathfinder();
    this.createHintSystem();
    this.createExplorationMode();
    this.createExecutionEngine();

    this.loadSavedProgram();
    this.setAvailableCommands();
    this.setupEventListeners();

    if (this.hintSystem) this.hintSystem.setActive(true);

    // Запускаем цикл обновления клонов (если ExecutionEngine поддерживает)
    this.cloneStepInterval = window.setInterval(() => {
      if (this.executionEngine && this.isExecuting) {
        this.executionEngine.stepClones().catch(console.warn);
      }
    }, 200);

    this.events.once('shutdown', () => this.cleanup());
  }

  update(): void {
    // Здесь можно добавить анимации или дополнительные проверки
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

  private loadSavedProgram(): void {
    const saved = saveManager.loadProgram(this.levelId);
    if (saved && saved.length > 0) {
      // Преобразуем плоский список команд в ProgramItem[] (с параметрами)
      this.currentProgram = this.unflattenProgram(saved);
    } else if (this.level?.initialCode) {
      this.currentProgram = this.unflattenProgram(this.level.initialCode);
    } else {
      this.currentProgram = [];
    }
    if (this.commandPanel) {
      this.commandPanel.loadProgram(this.levelId, this.currentProgram);
    }
  }

  private unflattenProgram(commands: Command[]): ProgramItem[] {
    // Простейшая эмуляция – превращает каждую команду в ProgramItem без параметров.
    // В реальном проекте нужно парсить числа/строки.
    return commands.map(cmd => ({ command: cmd }));
  }

  private setAvailableCommands(): void {
    if (!this.commandPanel || !this.level) return;
    const allCommands = Object.values(Command).filter(c => typeof c === 'string') as Command[];
    this.commandPanel.setAvailableCommands(allCommands);
  }

  // ---------- Обработка событий ----------
  private setupEventListeners(): void {
    eventBus.on('COMMAND_QUEUE_CHANGED', this.onCommandQueueChanged);
    eventBus.on('EXECUTION_START', this.onExecutionStart);
    eventBus.on('EXECUTION_FINISHED', this.onExecutionFinished);
    eventBus.on('EXECUTION_STEP', this.onExecutionStep);
    eventBus.on('PLAYER_MOVED', this.onPlayerMoved);
    eventBus.on('PLAYER_DIED', this.onPlayerDied);
    eventBus.on('EXPLORATION_TOGGLED', this.onExplorationToggled);
    eventBus.on('PROGRESS_UPDATED', this.onProgressUpdated);
    eventBus.on('OBJECT_CREATED', this.onObjectCreated);
    eventBus.on('CLONES_JOINED', this.onClonesJoined);
  }

  private removeEventListeners(): void {
    eventBus.off('COMMAND_QUEUE_CHANGED', this.onCommandQueueChanged);
    eventBus.off('EXECUTION_START', this.onExecutionStart);
    eventBus.off('EXECUTION_FINISHED', this.onExecutionFinished);
    eventBus.off('EXECUTION_STEP', this.onExecutionStep);
    eventBus.off('PLAYER_MOVED', this.onPlayerMoved);
    eventBus.off('PLAYER_DIED', this.onPlayerDied);
    eventBus.off('EXPLORATION_TOGGLED', this.onExplorationToggled);
    eventBus.off('PROGRESS_UPDATED', this.onProgressUpdated);
    eventBus.off('OBJECT_CREATED', this.onObjectCreated);
    eventBus.off('CLONES_JOINED', this.onClonesJoined);
  }

  private onCommandQueueChanged = (payload: any): void => {
    if (payload && payload.commands) {
      // Преобразуем плоский список команд в ProgramItem[] (упрощённо)
      this.currentProgram = payload.commands.map((c: Command) => ({ command: c }));
      if (!this.isExecuting) {
        saveManager.saveProgram(this.levelId, payload.commands, false);
      }
    }
  };

  private onExecutionStart = (): void => {
    this.isExecuting = true;
    if (this.commandPanel) this.commandPanel.setExecuting(true);
    if (this.hintSystem) this.hintSystem.setActive(false);
  };

  private onExecutionFinished = (payload: any): void => {
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
  };

  private onExecutionStep = (): void => {
    if (this.hintSystem && this.player && this.level) {
      this.hintSystem.updateState(
        this.player.getPosition(),
        this.player.getDirection(),
        this.player.getInventory(),
        this.level.objects.monsters
      );
    }
  };

  private onPlayerMoved = (): void => {
    if (this.hintSystem && this.player && this.level) {
      this.hintSystem.updateState(
        this.player.getPosition(),
        this.player.getDirection(),
        this.player.getInventory(),
        this.level.objects.monsters
      );
    }
  };

  private onPlayerDied = (): void => {
    this.handleDefeat();
  };

  private onExplorationToggled = (payload: any): void => {
    if (payload && this.level && this.pathfinder) {
      this.pathfinder.setExplorationMode(payload.enabled);
    }
  };

  private onProgressUpdated = (): void => {
    this.updateUI();
  };

  private onObjectCreated = (payload: any): void => {
    // Можно показать уведомление или визуализировать объект на карте
    console.log(`Object created: ${payload.className} (${payload.objectId})`);
  };

  private onClonesJoined = (): void => {
    if (this.levelMap) {
      // Обновить отображение (клоны исчезли)
    }
  };

  // ---------- Игровая логика ----------
  private async handleVictory(result: any): Promise<void> {
    if (this.victoryPending) return;
    this.victoryPending = true;

    const explorationUsed = this.explorationMode?.isActive() || false;
    const backdoorUsed = result.backdoorFound;

    progressManager.completeLevel(
      this.levelId,
      result.starsEarned,
      backdoorUsed,
      result.stepsCount,
      explorationUsed,
      backdoorUsed,
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
    alert(msg);
    // Сохраняем текущую программу перед перезапуском
    saveManager.saveProgram(this.levelId, this.flattenProgram(this.currentProgram), false);
    this.resetLevel();
  }

  private flattenProgram(items: ProgramItem[]): Command[] {
    const result: Command[] = [];
    for (const item of items) {
      result.push(item.command);
      if (item.param !== undefined) {
        result.push(item.param as unknown as Command);
      }
      if (item.children) {
        result.push(...this.flattenProgram(item.children));
        result.push(Command.END);
      }
    }
    return result;
  }

  private resetLevel(): void {
    this.victoryPending = false;
    this.scene.restart({ levelId: this.levelId });
  }

  private updateUI(): void {
    // Обновление UI (например, отображение звёзд, прогресса)
  }

  private cleanup(): void {
    if (this.cloneStepInterval) {
      clearInterval(this.cloneStepInterval);
      this.cloneStepInterval = null;
    }
    if (this.commandPanel) this.commandPanel.destroy();
    if (this.levelMap) this.levelMap.destroy();
    if (this.hintSystem) this.hintSystem.destroy();
    if (this.explorationMode) this.explorationMode.destroy();
    this.removeEventListeners();
  }
}
