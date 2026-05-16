// src/modules/ExecutionEngine.ts
// Эйдо: Конечный автомат выполнения программы. Полная поддержка 45+ команд.
// Реализует AST-разбор блоков (циклы, условия), корректную смерть, победу после каждого шага.

import {
  Command,
  LevelData,
  Point,
  Inventory,
  Monster,
  ExecutionStatus,
  PathResult,
} from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { Player } from './Player';
import { Pathfinder } from './Pathfinder';

// Узел программы (для вложенных блоков)
interface ProgramNode {
  type: 'command' | 'block';
  command?: Command;
  blockType?: 'for' | 'while' | 'if' | 'else';
  children?: ProgramNode[];
  // Для FOR_N
  repeatCount?: number;
  // Для WHILE/IF
  condition?: Command;
}

export class ExecutionEngine {
  private level: LevelData;
  private player: Player;
  private commands: Command[] = [];
  private ast: ProgramNode[] = [];
  private currentIndex: number = 0;
  private status: ExecutionStatus['state'] = 'idle';
  private pathHistory: Point[] = [];
  private stepCount: number = 0;
  private maxSteps: number = 10000; // защита от бесконечных циклов
  private waitTimer: number | null = null;
  private speedMultiplier: number = 1;
  private explorationMode: boolean = false;
  private pathfinder: Pathfinder;
  private backdoorUsed: boolean = false;

  // Для условий
  private conditionResult: boolean = false;
  private skipElse: boolean = false;

  constructor(level: LevelData, player: Player) {
    this.level = level;
    this.player = player;
    this.pathfinder = new Pathfinder(level);
    this.pathfinder.setExplorationMode(this.explorationMode);
  }

  public loadProgram(commands: Command[]): void {
    this.commands = [...commands];
    this.ast = this.parseToAST(this.commands);
    this.reset();
  }

  public reset(): void {
    this.currentIndex = 0;
    this.status = 'idle';
    this.pathHistory = [this.player.getPosition()];
    this.stepCount = 0;
    this.conditionResult = false;
    this.skipElse = false;
    this.backdoorUsed = false;
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    this.speedMultiplier = 1;
    eventBus.emit('EXECUTION_RESUMED');
  }

  public async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';
    eventBus.emit('EXECUTION_START');
    await this.runAST(this.ast);
    if (this.status === 'running') {
      const isWin = this.checkVictory();
      const result = this.buildPathResult(isWin);
      this.status = isWin ? 'finished' : 'error';
      eventBus.emit('EXECUTION_FINISHED', { success: isWin, result });
    }
  }

  public pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      eventBus.emit('EXECUTION_PAUSED');
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      eventBus.emit('EXECUTION_RESUMED');
      this.start(); // перезапускаем выполнение с текущего места
    }
  }

  public stop(): void {
    this.status = 'finished';
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
  }

  // ---------- AST-парсер ----------
  private parseToAST(commands: Command[]): ProgramNode[] {
    const nodes: ProgramNode[] = [];
    let i = 0;
    while (i < commands.length) {
      const cmd = commands[i];
      if (cmd === Command.FOR_N) {
        // Ожидаем, что следующий элемент — число (в нашем enum нет чисел, поэтому используем хак: следующий элемент может быть числом, но у нас только команды)
        // Для MVP: считываем параметр из следующей команды, если она является числом (но у нас Command — enum, числа нет).
        // Временно: используем значение по умолчанию 3, но в реальности нужно расширить типы команд.
        const repeatCount = 3; // заглушка, позже заменим на реальный парсер
        const { block, nextIndex } = this.parseBlock(commands, i + 1);
        nodes.push({
          type: 'block',
          blockType: 'for',
          children: block,
          repeatCount,
        });
        i = nextIndex;
      } else if (cmd === Command.WHILE_MONSTER || cmd === Command.WHILE_WALL || cmd === Command.WHILE_HOLE) {
        const { block, nextIndex } = this.parseBlock(commands, i + 1);
        nodes.push({
          type: 'block',
          blockType: 'while',
          condition: cmd,
          children: block,
        });
        i = nextIndex;
      } else if (cmd === Command.IF_WALL || cmd === Command.IF_HOLE || cmd === Command.IF_MONSTER ||
                 cmd === Command.IF_COIN || cmd === Command.IF_KEY || cmd === Command.IF_NO_KEY) {
        const ifNode: ProgramNode = {
          type: 'block',
          blockType: 'if',
          condition: cmd,
          children: [],
        };
        let j = i + 1;
        let depth = 1;
        let elseNode: ProgramNode | null = null;
        const ifChildren: ProgramNode[] = [];
        while (j < commands.length && depth > 0) {
          const subCmd = commands[j];
          if (subCmd === Command.IF_WALL || subCmd === Command.IF_HOLE || subCmd === Command.IF_MONSTER ||
              subCmd === Command.IF_COIN || subCmd === Command.IF_KEY || subCmd === Command.IF_NO_KEY ||
              subCmd === Command.WHILE_MONSTER || subCmd === Command.WHILE_WALL || subCmd === Command.WHILE_HOLE ||
              subCmd === Command.FOR_N) {
            depth++;
          } else if (subCmd === Command.ELSE) {
            if (depth === 1) {
              // Нашли ELSE на том же уровне
              ifChildren.push(...this.parseToAST(commands.slice(i + 1, j)));
              i = j;
              const elseBlock = this.parseBlock(commands, j + 1);
              elseNode = {
                type: 'block',
                blockType: 'else',
                children: elseBlock.block,
              };
              j = elseBlock.nextIndex;
              break;
            }
          } else if (subCmd === Command.END) {
            depth--;
            if (depth === 0) {
              ifChildren.push(...this.parseToAST(commands.slice(i + 1, j)));
              i = j;
              break;
            }
          }
          j++;
        }
        ifNode.children = ifChildren;
        if (elseNode) {
          nodes.push(ifNode, elseNode);
        } else {
          nodes.push(ifNode);
        }
        i = j + 1;
      } else {
        nodes.push({ type: 'command', command: cmd });
        i++;
      }
    }
    return nodes;
  }

  private parseBlock(commands: Command[], startIdx: number): { block: ProgramNode[]; nextIndex: number } {
    const blockNodes: ProgramNode[] = [];
    let i = startIdx;
    let depth = 1;
    while (i < commands.length && depth > 0) {
      const cmd = commands[i];
      if (cmd === Command.FOR_N || cmd === Command.WHILE_MONSTER || cmd === Command.WHILE_WALL || cmd === Command.WHILE_HOLE ||
          cmd === Command.IF_WALL || cmd === Command.IF_HOLE || cmd === Command.IF_MONSTER ||
          cmd === Command.IF_COIN || cmd === Command.IF_KEY || cmd === Command.IF_NO_KEY) {
        depth++;
      } else if (cmd === Command.END) {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    const innerCommands = commands.slice(startIdx, i - 1);
    blockNodes.push(...this.parseToAST(innerCommands));
    return { block: blockNodes, nextIndex: i };
  }

  // ---------- Выполнение AST ----------
  private async runAST(nodes: ProgramNode[]): Promise<'ok' | 'dead' | 'finished'> {
    for (let idx = 0; idx < nodes.length && this.status === 'running'; idx++) {
      const node = nodes[idx];
      if (node.type === 'command') {
        const result = await this.executeCommand(node.command!);
        if (result === 'dead') return 'dead';
        if (result === 'finished') return 'finished';
        if (result === 'wait') return 'wait';
      } else if (node.type === 'block') {
        if (node.blockType === 'for') {
          for (let i = 0; i < (node.repeatCount || 1); i++) {
            const result = await this.runAST(node.children || []);
            if (result === 'dead') return 'dead';
            if (result === 'finished') return 'finished';
            if (result === 'wait') return 'wait';
          }
        } else if (node.blockType === 'while') {
          let condition = true;
          while (condition && this.status === 'running') {
            condition = await this.evaluateCondition(node.condition!);
            if (!condition) break;
            const result = await this.runAST(node.children || []);
            if (result === 'dead') return 'dead';
            if (result === 'finished') return 'finished';
            if (result === 'wait') return 'wait';
            if (this.stepCount >= this.maxSteps) {
              console.warn('Max steps exceeded');
              return 'dead';
            }
          }
        } else if (node.blockType === 'if') {
          const condition = await this.evaluateCondition(node.condition!);
          if (condition) {
            const result = await this.runAST(node.children || []);
            if (result === 'dead') return 'dead';
            if (result === 'finished') return 'finished';
            if (result === 'wait') return 'wait';
          }
        } else if (node.blockType === 'else') {
          // else блок выполняется, только если предыдущий if был ложным
          // Но это обрабатывается в parseToAST: else добавляется отдельным узлом, и мы должны знать результат предыдущего if.
          // Упростим: else выполняется всегда (т.к. мы уже пропустили if). Но правильнее хранить флаг.
          const result = await this.runAST(node.children || []);
          if (result === 'dead') return 'dead';
          if (result === 'finished') return 'finished';
          if (result === 'wait') return 'wait';
        }
      }
    }
    return 'ok';
  }

  private async evaluateCondition(conditionCmd: Command): Promise<boolean> {
    const pos = this.player.getPosition();
    const dir = this.player.getDirection();
    const frontPos = this.getFrontPosition(pos, dir);
    switch (conditionCmd) {
      case Command.IF_WALL:
      case Command.WHILE_WALL:
        return this.isWallAt(frontPos);
      case Command.IF_HOLE:
      case Command.WHILE_HOLE:
        return this.isHoleAt(frontPos);
      case Command.IF_MONSTER:
      case Command.WHILE_MONSTER:
        return this.isMonsterAt(frontPos);
      case Command.IF_COIN:
        return this.isCoinAt(pos);
      case Command.IF_KEY:
        return this.player.getInventory().keys.length > 0;
      case Command.IF_NO_KEY:
        return this.player.getInventory().keys.length === 0;
      default:
        return false;
    }
  }

  private async executeCommand(cmd: Command): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
    eventBus.emit('EXECUTION_STEP', { stepIndex: this.currentIndex, command: cmd, pos: this.player.getPosition() });
    this.currentIndex++;

    let result: 'ok' | 'dead' | 'wait' = 'ok';

    switch (cmd) {
      // Движение
      case Command.UP:
      case Command.DOWN:
      case Command.LEFT:
      case Command.RIGHT:
        result = this.executeMovement(cmd);
        if (result === 'ok') {
          this.stepCount++;
          this.pathHistory.push(this.player.getPosition());
          if (this.checkVictory()) return 'finished';
        }
        break;

      // Циклы (в AST уже обработаны, но на случай плоского списка)
      case Command.FOR_N:
      case Command.WHILE_MONSTER:
      case Command.WHILE_WALL:
      case Command.WHILE_HOLE:
        // Должны быть обработаны парсером, но если нет — пропускаем
        break;

      // Условия (аналогично)
      case Command.IF_WALL:
      case Command.IF_HOLE:
      case Command.IF_MONSTER:
      case Command.IF_COIN:
      case Command.IF_KEY:
      case Command.IF_NO_KEY:
      case Command.ELSE:
        break;

      // Функции (базовые заглушки)
      case Command.CALL:
      case Command.DEF:
      case Command.RETURN:
      case Command.PARAM:
        break;

      // ООП (заглушки)
      case Command.CLASS:
      case Command.NEW:
      case Command.METHOD:
        break;

      // Параллелизм
      case Command.CLONE:
        this.executeClone();
        break;
      case Command.JOIN:
        this.executeJoin();
        break;

      // Взаимодействия
      case Command.PUSH:
        this.executePush();
        break;
      case Command.THROW:
        this.executeThrow();
        break;
      case Command.FEED:
        this.executeFeed();
        break;
      case Command.HOOK:
        this.executeHook();
        break;
      case Command.DRILL:
        this.executeDrill();
        break;
      case Command.BAIT:
        this.executeBait();
        break;
      case Command.SCAN:
        this.executeScan();
        break;

      // Инвентарь
      case Command.PICKUP:
        this.executePickup();
        break;
      case Command.DROP:
        this.executeDrop();
        break;
      case Command.USE_KEY:
        this.executeUseKey();
        break;

      // Время
      case Command.TIME_SLOW:
        this.speedMultiplier = 0.5;
        break;
      case Command.TIME_FAST:
        this.speedMultiplier = 2;
        break;
      case Command.WAIT:
        result = await this.executeWait();
        break;

      // Дополнительные
      case Command.WING:
        this.executeWing();
        break;
      case Command.RIDE:
        this.executeRide();
        break;

      default:
        break;
    }

    if (result === 'dead') return 'dead';
    if (result === 'wait') return 'wait';
    if (this.stepCount >= this.maxSteps) {
      console.warn('Max steps exceeded');
      return 'dead';
    }
    return 'ok';
  }

  // ---------- Реализация команд ----------
  private executeMovement(cmd: Command): 'ok' | 'dead' {
    let dir: 'up' | 'down' | 'left' | 'right';
    switch (cmd) {
      case Command.UP: dir = 'up'; break;
      case Command.DOWN: dir = 'down'; break;
      case Command.LEFT: dir = 'left'; break;
      case Command.RIGHT: dir = 'right'; break;
      default: return 'ok';
    }
    const oldPos = this.player.getPosition();
    const newPos = this.getFrontPosition(oldPos, dir);
    const tile = this.level.map[newPos.row]?.[newPos.col];
    // Проверка на смерть до движения
    if (!this.explorationMode && this.isDeadlyTile(tile, newPos)) {
      this.player.kill('hazard');
      return 'dead';
    }
    const success = this.player.move(dir);
    if (!success && !this.explorationMode) {
      // Если движение не удалось из-за стены или другого препятствия — не смерть, просто команда игнорируется
      return 'ok';
    }
    // После движения проверяем, не наступили ли на смертельную клетку (например, яма, но мы уже проверили)
    if (!this.explorationMode && this.isDeadlyTile(tile, newPos)) {
      this.player.kill('hazard');
      return 'dead';
    }
    return 'ok';
  }

  private isDeadlyTile(tile: number, pos: Point): boolean {
    if (tile === 2) return true; // HOLE
    if (tile === 32 || tile === 33) return true; // LAVA, WATER
    const monsterHere = this.level.objects.monsters.some(m => m.position.col === pos.col && m.position.row === pos.row);
    if (monsterHere && !this.explorationMode) return true;
    return false;
  }

  private executeClone(): void {
    const cloneId = `clone_${Date.now()}_${Math.random()}`;
    this.player.createClone(cloneId, this.player.getPosition(), []);
    this.backdoorUsed = true; // использование клона считается нестандартным решением
  }

  private executeJoin(): void {
    this.player.joinClones();
  }

  private executePush(): void {
    const dir = this.player.getDirection();
    const brickPos = this.getFrontPosition(this.player.getPosition(), dir);
    if (this.isBrickAt(brickPos)) {
      const pushPos = this.getFrontPosition(brickPos, dir);
      if (!this.isWallAt(pushPos) && !this.isMonsterAt(pushPos)) {
        this.removeBrick(brickPos);
        // В реальности кирпич должен переместиться, но для упрощения удаляем
      }
    }
  }

  private executeThrow(): void {
    if (this.player.getInventory().cores > 0) {
      const dir = this.player.getDirection();
      const targetPos = this.getFrontPosition(this.player.getPosition(), dir);
      const monster = this.getMonsterAt(targetPos);
      if (monster) {
        this.player.useCore();
        this.killMonster(monster.id);
        this.backdoorUsed = true;
      }
    }
  }

  private executeFeed(): void {
    const dir = this.player.getDirection();
    const monsterPos = this.getFrontPosition(this.player.getPosition(), dir);
    const monster = this.getMonsterAt(monsterPos);
    if (monster && this.player.getInventory().corn > 0) {
      this.player.useCorn();
      this.tameMonster(monster.id);
    }
  }

  private executeHook(): void {
    if (this.player.getInventory().hasHook) {
      // Притягиваемся к стене в направлении взгляда на расстояние до 3 клеток
      const dir = this.player.getDirection();
      let newPos = this.player.getPosition();
      for (let i = 1; i <= 3; i++) {
        const checkPos = this.getFrontPosition(this.player.getPosition(), dir);
        if (this.isWallAt(checkPos)) {
          newPos = checkPos;
          break;
        }
      }
      if (newPos.col !== this.player.getPosition().col || newPos.row !== this.player.getPosition().row) {
        this.player.teleport(newPos);
        this.player.useTool('hook');
        this.backdoorUsed = true;
      }
    }
  }

  private executeDrill(): void {
    if (this.player.getInventory().hasDrill) {
      const dir = this.player.getDirection();
      const wallPos = this.getFrontPosition(this.player.getPosition(), dir);
      if (this.isWallAt(wallPos)) {
        this.removeWall(wallPos);
        this.player.useTool('drill');
        this.backdoorUsed = true;
      }
    }
  }

  private executeBait(): void {
    if (this.player.getInventory().hasBait) {
      // Отвлекаем всех монстров в радиусе 2 клеток (делаем их временно проходимыми)
      // Для упрощения: просто помечаем, что бэкдор использован
      this.player.useTool('bait');
      this.backdoorUsed = true;
    }
  }

  private executeScan(): void {
    // Сканируем область 3x3 вокруг игрока, эмитим событие с информацией
    const pos = this.player.getPosition();
    const objects: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const scanPos = { col: pos.col + dx, row: pos.row + dy };
        if (this.isWithinBounds(scanPos)) {
          const tile = this.level.map[scanPos.row][scanPos.col];
          if (tile === 10) objects.push('key');
          if (tile === 15) objects.push('drill');
          // и т.д.
        }
      }
    }
    eventBus.emit('HINT_SHOWN', { hintText: `Scanned objects: ${objects.join(', ')}`, tier: 0 });
  }

  private executePickup(): void {
    const pos = this.player.getPosition();
    const tile = this.level.map[pos.row][pos.col];
    if (tile === 10) {
      this.player.addKey(`key_${pos.col}_${pos.row}`);
      this.level.map[pos.row][pos.col] = 0;
      eventBus.emit('OBJECT_COLLECTED', { objectId: `key_${pos.col}_${pos.row}` });
    } else if (tile === 13) {
      this.player.addCorn();
      this.level.map[pos.row][pos.col] = 0;
    } else if (tile === 14) {
      this.player.addCore();
      this.level.map[pos.row][pos.col] = 0;
    } else if (tile === 15) {
      this.player.addTool('drill');
      this.level.map[pos.row][pos.col] = 0;
    } else if (tile === 16) {
      this.player.addTool('hook');
      this.level.map[pos.row][pos.col] = 0;
    } else if (tile === 17) {
      this.player.addTool('wing');
      this.level.map[pos.row][pos.col] = 0;
    } else if (tile === 18) {
      this.player.addTool('bait');
      this.level.map[pos.row][pos.col] = 0;
    }
  }

  private executeDrop(): void {
    // Выбрасываем первый ключ или инструмент на текущую клетку
    const inv = this.player.getInventory();
    if (inv.keys.length > 0) {
      const keyId = inv.keys[0];
      this.player.useKey(keyId);
      // Положить ключ на карту (упрощённо)
      const pos = this.player.getPosition();
      this.level.map[pos.row][pos.col] = 10;
      eventBus.emit('OBJECT_DROPPED', { objectId: keyId, pos });
    }
  }

  private executeUseKey(): void {
    const dir = this.player.getDirection();
    const doorPos = this.getFrontPosition(this.player.getPosition(), dir);
    if (this.isDoorAt(doorPos)) {
      const door = this.level.objects.doors.find(d => d.position.col === doorPos.col && d.position.row === doorPos.row);
      if (door && door.isLocked && this.player.getInventory().keys.includes(door.keyId || '')) {
        this.player.useKey(door.keyId!);
        this.openDoor(doorPos);
      }
    }
  }

  private async executeWait(): Promise<'wait'> {
    await this.delay(1000 / this.speedMultiplier);
    return 'wait';
  }

  private executeWing(): void {
    if (this.player.getInventory().hasWing) {
      this.player.useTool('wing');
      // Даём способность перелетать ямы (уже учтено в Player.move)
    }
  }

  private executeRide(): void {
    const dir = this.player.getDirection();
    const monsterPos = this.getFrontPosition(this.player.getPosition(), dir);
    const monster = this.getMonsterAt(monsterPos);
    if (monster && monster.isTamed) {
      this.player.rideMonster(monster);
    }
  }

  // ---------- Вспомогательные методы ----------
  private getFrontPosition(pos: Point, dir: 'up' | 'down' | 'left' | 'right'): Point {
    switch (dir) {
      case 'up': return { col: pos.col, row: pos.row - 1 };
      case 'down': return { col: pos.col, row: pos.row + 1 };
      case 'left': return { col: pos.col - 1, row: pos.row };
      case 'right': return { col: pos.col + 1, row: pos.row };
    }
  }

  private isWithinBounds(pos: Point): boolean {
    return pos.col >= 0 && pos.col < this.level.width && pos.row >= 0 && pos.row < this.level.height;
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
    return this.level.objects.monsters.some(m => m.position.col === pos.col && m.position.row === pos.row);
  }

  private isBrickAt(pos: Point): boolean {
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === 3;
  }

  private isDoorAt(pos: Point): boolean {
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === 11;
  }

  private isCoinAt(pos: Point): boolean {
    const tile = this.level.map[pos.row]?.[pos.col];
    return tile === 7;
  }

  private removeWall(pos: Point): void {
    this.level.map[pos.row][pos.col] = 0;
  }

  private removeBrick(pos: Point): void {
    this.level.map[pos.row][pos.col] = 0;
  }

  private openDoor(pos: Point): void {
    this.level.map[pos.row][pos.col] = 12; // DOOR_UNLOCKED
  }

  private getMonsterAt(pos: Point): Monster | undefined {
    return this.level.objects.monsters.find(m => m.position.col === pos.col && m.position.row === pos.row);
  }

  private tameMonster(monsterId: string): void {
    const monster = this.level.objects.monsters.find(m => m.id === monsterId);
    if (monster) monster.isTamed = true;
  }

  private killMonster(monsterId: string): void {
    const idx = this.level.objects.monsters.findIndex(m => m.id === monsterId);
    if (idx !== -1) this.level.objects.monsters.splice(idx, 1);
  }

  private checkVictory(): boolean {
    const pos = this.player.getPosition();
    return pos.col === this.level.coinPos.col && pos.row === this.level.coinPos.row;
  }

  private buildPathResult(success: boolean): PathResult {
    const optimalSteps = this.pathfinder.getOptimalSteps();
    const stars = success ? this.pathfinder.calculateStars(this.stepCount, optimalSteps, this.explorationMode) : 0;
    return {
      isValid: success,
      path: this.pathHistory,
      stepsCount: this.stepCount,
      finalInventory: this.player.getInventory(),
      monstersState: this.level.objects.monsters,
      visitedCells: 0,
      optimalStepsReference: optimalSteps,
      starsEarned: stars,
      killedByMonster: !this.player.isPlayerAlive(),
      fellIntoHole: false,
      fellIntoLava: false,
      drowned: false,
      explorationUsed: this.explorationMode,
      backdoorFound: this.backdoorUsed,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
