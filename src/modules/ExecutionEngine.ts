// src/modules/ExecutionEngine.ts
// ПРОМЕТЕЙ: Полностью переработанный движок выполнения с поддержкой функций, ООП, параллелизма.
// Поддерживает 45+ команд, AST с блоками, стек вызовов, клоны, классы, методы, параметры.

import {
  Command,
  LevelData,
  Point,
  Inventory,
  Monster,
  ExecutionStatus,
  PathResult,
  CallFrame,
  CloneInfo,
} from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { Player } from './Player';
import { Pathfinder } from './Pathfinder';

// Парсер превращает плоский список команд в AST с учётом блоков, функций, классов
// Поддерживает вложенность, параметры, возвраты, методы объектов
interface ProgramNode {
  type: 'command' | 'block' | 'function' | 'class';
  command?: Command;
  blockType?: 'for' | 'while' | 'if' | 'else';
  children?: ProgramNode[];
  repeatCount?: number;                 // для FOR_N
  condition?: Command;                  // для WHILE/IF
  functionName?: string;
  params?: any[];
  className?: string;
  methodName?: string;
  returnType?: string;
}

interface FunctionDef {
  name: string;
  params: string[];
  body: ProgramNode[];
  returnType?: string;
}

interface ClassDef {
  name: string;
  methods: Map<string, FunctionDef>;
  parentClass?: string;
}

interface ObjectInstance {
  className: string;
  id: string;
  properties: Map<string, any>;
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
  private maxSteps: number = 10000;
  private waitTimer: number | null = null;
  private speedMultiplier: number = 1;
  private explorationMode: boolean = false;
  private pathfinder: Pathfinder;
  private backdoorUsed: boolean = false;

  // Поддержка функций и ООП
  private callStack: CallFrame[] = [];
  private functions: Map<string, FunctionDef> = new Map();
  private classes: Map<string, ClassDef> = new Map();
  private objects: Map<string, ObjectInstance> = new Map();
  private nextObjectId: number = 1;
  private currentObjectContext: string | null = null;

  // Поддержка клонов (параллелизм)
  private clones: CloneInfo[] = [];
  private currentCloneId: string | null = null;
  private cloneStepQueue: Map<string, number> = new Map(); // cloneId -> next command index

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
    this.preloadFunctionsAndClasses();
  }

  private preloadFunctionsAndClasses(): void {
    // Сбор определений функций (DEF) и классов (CLASS) из AST
    const collect = (nodes: ProgramNode[]) => {
      for (const node of nodes) {
        if (node.type === 'function' && node.functionName) {
          const fnDef: FunctionDef = {
            name: node.functionName,
            params: (node.params as string[]) || [],
            body: node.children || [],
            returnType: node.returnType,
          };
          this.functions.set(node.functionName, fnDef);
        } else if (node.type === 'class' && node.className) {
          const classDef: ClassDef = {
            name: node.className,
            methods: new Map(),
            parentClass: undefined,
          };
          if (node.children) {
            for (const child of node.children) {
              if (child.type === 'function' && child.functionName) {
                const methodDef: FunctionDef = {
                  name: child.functionName,
                  params: (child.params as string[]) || [],
                  body: child.children || [],
                  returnType: child.returnType,
                };
                classDef.methods.set(child.functionName, methodDef);
              }
            }
          }
          this.classes.set(node.className, classDef);
        } else if (node.children) {
          collect(node.children);
        }
      }
    };
    collect(this.ast);
  }

  public reset(): void {
    this.currentIndex = 0;
    this.status = 'idle';
    this.pathHistory = [this.player.getPosition()];
    this.stepCount = 0;
    this.backdoorUsed = false;
    if (this.waitTimer) {
      clearTimeout(this.waitTimer);
      this.waitTimer = null;
    }
    this.speedMultiplier = 1;
    this.callStack = [];
    this.clones = [];
    this.cloneStepQueue.clear();
    this.currentCloneId = null;
    this.currentObjectContext = null;
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
      this.start();
    }
  }

  public stop(): void {
    this.status = 'finished';
    if (this.waitTimer) clearTimeout(this.waitTimer);
  }

  // ---------- AST-парсер (улучшенная версия) ----------
  private parseToAST(commands: Command[]): ProgramNode[] {
    const nodes: ProgramNode[] = [];
    let i = 0;
    while (i < commands.length) {
      const cmd = commands[i];
      if (cmd === Command.DEF) {
        const { node, nextIndex } = this.parseFunctionDef(commands, i);
        nodes.push(node);
        i = nextIndex;
      } else if (cmd === Command.CLASS) {
        const { node, nextIndex } = this.parseClassDef(commands, i);
        nodes.push(node);
        i = nextIndex;
      } else if (cmd === Command.FOR_N) {
        const repeatCount = this.extractNumber(commands, i + 1);
        const { block, nextIndex } = this.parseBlock(commands, i + 2);
        nodes.push({
          type: 'block',
          blockType: 'for',
          children: block,
          repeatCount,
        });
        i = nextIndex;
      } else if (cmd === Command.FOR_LOOP) {
        const from = this.extractNumber(commands, i + 1);
        const to = this.extractNumber(commands, i + 2);
        const repeatCount = Math.max(0, to - from);
        const { block, nextIndex } = this.parseBlock(commands, i + 3);
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
        const { block, nextIndex, elseBlock } = this.parseIfElse(commands, i);
        const ifNode: ProgramNode = {
          type: 'block',
          blockType: 'if',
          condition: cmd,
          children: block,
        };
        nodes.push(ifNode);
        if (elseBlock && elseBlock.children && elseBlock.children.length > 0) {
          nodes.push({
            type: 'block',
            blockType: 'else',
            children: elseBlock.children,
          });
        }
        i = nextIndex;
      } else if (cmd === Command.CALL) {
        const funcName = this.extractString(commands, i + 1);
        const params: any[] = [];
        let paramIdx = i + 2;
        while (paramIdx < commands.length && this.isValueToken(commands[paramIdx])) {
          params.push(this.extractValue(commands[paramIdx]));
          paramIdx++;
        }
        nodes.push({
          type: 'command',
          command: Command.CALL,
          functionName: funcName,
          params,
        });
        i = paramIdx;
      } else if (cmd === Command.NEW) {
        const className = this.extractString(commands, i + 1);
        nodes.push({
          type: 'command',
          command: Command.NEW,
          className,
        });
        i += 2;
      } else if (cmd === Command.METHOD) {
        const objId = this.extractString(commands, i + 1);
        const methodName = this.extractString(commands, i + 2);
        const params: any[] = [];
        let paramIdx = i + 3;
        while (paramIdx < commands.length && this.isValueToken(commands[paramIdx])) {
          params.push(this.extractValue(commands[paramIdx]));
          paramIdx++;
        }
        nodes.push({
          type: 'command',
          command: Command.METHOD,
          functionName: methodName,
          params,
          className: objId,
        });
        i = paramIdx;
      } else {
        nodes.push({ type: 'command', command: cmd });
        i++;
      }
    }
    return nodes;
  }

  private parseFunctionDef(commands: Command[], startIdx: number): { node: ProgramNode; nextIndex: number } {
    let i = startIdx + 1;
    const funcName = this.extractString(commands, i);
    i++;
    const params: string[] = [];
    while (i < commands.length && commands[i] === Command.PARAM) {
      const paramName = this.extractString(commands, i + 1);
      params.push(paramName);
      i += 2;
    }
    const { block, nextIndex } = this.parseBlock(commands, i);
    return {
      node: {
        type: 'function',
        functionName: funcName,
        params,
        children: block,
      },
      nextIndex,
    };
  }

  private parseClassDef(commands: Command[], startIdx: number): { node: ProgramNode; nextIndex: number } {
    let i = startIdx + 1;
    const className = this.extractString(commands, i);
    i++;
    const methods: ProgramNode[] = [];
    while (i < commands.length && commands[i] === Command.DEF) {
      const { node, nextIndex } = this.parseFunctionDef(commands, i);
      methods.push(node);
      i = nextIndex;
    }
    // Пропускаем END класса
    let endIdx = i;
    if (commands[endIdx] === Command.END) endIdx++;
    return {
      node: {
        type: 'class',
        className,
        children: methods,
      },
      nextIndex: endIdx,
    };
  }

  private parseBlock(commands: Command[], startIdx: number): { block: ProgramNode[]; nextIndex: number } {
    const blockNodes: ProgramNode[] = [];
    let i = startIdx;
    let depth = 1;
    while (i < commands.length && depth > 0) {
      const cmd = commands[i];
      if (cmd === Command.FOR_N || cmd === Command.FOR_LOOP || cmd === Command.WHILE_MONSTER ||
          cmd === Command.WHILE_WALL || cmd === Command.WHILE_HOLE || cmd === Command.IF_WALL ||
          cmd === Command.IF_HOLE || cmd === Command.IF_MONSTER || cmd === Command.IF_COIN ||
          cmd === Command.IF_KEY || cmd === Command.IF_NO_KEY || cmd === Command.DEF || cmd === Command.CLASS) {
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

  private parseIfElse(commands: Command[], startIdx: number): { block: ProgramNode[]; nextIndex: number; elseBlock: { children: ProgramNode[] } | null } {
    let i = startIdx + 1;
    let depth = 1;
    let elseStart = -1;
    const ifBody: Command[] = [];
    while (i < commands.length && depth > 0) {
      const cmd = commands[i];
      if (cmd === Command.IF_WALL || cmd === Command.IF_HOLE || cmd === Command.IF_MONSTER ||
          cmd === Command.IF_COIN || cmd === Command.IF_KEY || cmd === Command.IF_NO_KEY ||
          cmd === Command.WHILE_MONSTER || cmd === Command.WHILE_WALL || cmd === Command.WHILE_HOLE ||
          cmd === Command.FOR_N || cmd === Command.FOR_LOOP || cmd === Command.DEF || cmd === Command.CLASS) {
        depth++;
      } else if (cmd === Command.ELSE && depth === 1) {
        elseStart = i + 1;
        depth++; // временно увеличиваем, чтобы пропустить до END
      } else if (cmd === Command.END) {
        depth--;
        if (depth === 0) {
          if (elseStart !== -1) {
            const elseCommands = commands.slice(elseStart, i);
            const elseBlock = this.parseToAST(elseCommands);
            i++;
            break;
          }
          i++;
          break;
        }
      }
      if (elseStart === -1) ifBody.push(cmd);
      i++;
    }
    const block = this.parseToAST(ifBody);
    const elseBlock = elseStart !== -1 ? { children: this.parseToAST(commands.slice(elseStart, i-1)) } : null;
    return { block, nextIndex: i, elseBlock };
  }

  private extractNumber(commands: Command[], idx: number): number {
    const token = commands[idx];
    if (typeof token === 'number') return token;
    if (typeof token === 'string') {
      const parsed = parseInt(token, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 1;
  }

  private extractString(commands: Command[], idx: number): string {
    const token = commands[idx];
    if (typeof token === 'string') return token;
    return token.toString();
  }

  private extractValue(cmd: Command): any {
    if (typeof cmd === 'number') return cmd;
    if (typeof cmd === 'string') return cmd;
    return null;
  }

  private isValueToken(cmd: Command): boolean {
    return typeof cmd === 'number' || (typeof cmd === 'string' && !Object.values(Command).includes(cmd as Command));
  }

  // ---------- Выполнение AST ----------
  private async runAST(nodes: ProgramNode[], context?: { objectId?: string; cloneId?: string }): Promise<'ok' | 'dead' | 'finished'> {
    for (let idx = 0; idx < nodes.length && this.status === 'running'; idx++) {
      const node = nodes[idx];
      if (node.type === 'command') {
        const result = await this.executeCommand(node.command!, node);
        if (result === 'dead') return 'dead';
        if (result === 'finished') return 'finished';
        if (result === 'wait') return 'wait';
      } else if (node.type === 'block') {
        if (node.blockType === 'for') {
          for (let i = 0; i < (node.repeatCount || 1); i++) {
            const result = await this.runAST(node.children || [], context);
            if (result === 'dead') return 'dead';
            if (result === 'finished') return 'finished';
            if (result === 'wait') return 'wait';
          }
        } else if (node.blockType === 'while') {
          let condition = true;
          while (condition && this.status === 'running') {
            condition = await this.evaluateCondition(node.condition!);
            if (!condition) break;
            const result = await this.runAST(node.children || [], context);
            if (result === 'dead') return 'dead';
            if (result === 'finished') return 'finished';
            if (result === 'wait') return 'wait';
            if (this.stepCount >= this.maxSteps) return 'dead';
          }
        } else if (node.blockType === 'if') {
          const cond = await this.evaluateCondition(node.condition!);
          if (cond) {
            const result = await this.runAST(node.children || [], context);
            if (result === 'dead') return 'dead';
            if (result === 'finished') return 'finished';
            if (result === 'wait') return 'wait';
          }
        } else if (node.blockType === 'else') {
          const result = await this.runAST(node.children || [], context);
          if (result === 'dead') return 'dead';
          if (result === 'finished') return 'finished';
          if (result === 'wait') return 'wait';
        }
      } else if (node.type === 'function') {
        continue;
      } else if (node.type === 'class') {
        continue;
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

  private async executeCommand(cmd: Command, node?: ProgramNode): Promise<'ok' | 'dead' | 'wait' | 'finished'> {
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

      // Функции
      case Command.CALL:
        if (node && node.functionName) {
          await this.callFunction(node.functionName, node.params || []);
        }
        break;
      case Command.RETURN:
        this.handleReturn();
        break;
      case Command.PARAM:
        break;

      // ООП
      case Command.NEW:
        if (node && node.className) {
          this.createObject(node.className);
        }
        break;
      case Command.METHOD:
        if (node && node.functionName && node.className) {
          await this.callMethod(node.className, node.functionName, node.params || []);
        }
        break;
      case Command.CLASS:
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
    if (this.stepCount >= this.maxSteps) return 'dead';
    return 'ok';
  }

  // ---------- Реализация функций и ООП ----------
  private async callFunction(name: string, args: any[]): Promise<void> {
    const fn = this.functions.get(name);
    if (!fn) {
      console.warn(`Function ${name} not defined`);
      return;
    }
    const frame: CallFrame = {
      functionName: name,
      returnAddress: this.currentIndex,
      localVars: new Map(),
    };
    for (let i = 0; i < fn.params.length && i < args.length; i++) {
      frame.localVars.set(fn.params[i], args[i]);
    }
    this.callStack.push(frame);
    await this.runAST(fn.body);
    this.callStack.pop();
  }

  private handleReturn(): void {
    if (this.callStack.length > 0) {
      // Просто выходим из функции, не меняя статус
    }
  }

  private createObject(className: string): void {
    const classDef = this.classes.get(className);
    if (!classDef) {
      console.warn(`Class ${className} not defined`);
      return;
    }
    const objId = `obj_${this.nextObjectId++}`;
    const obj: ObjectInstance = {
      className,
      id: objId,
      properties: new Map(),
    };
    this.objects.set(objId, obj);
    eventBus.emit('OBJECT_CREATED', { className, objectId: objId });
  }

  private async callMethod(objectId: string, methodName: string, args: any[]): Promise<void> {
    const obj = this.objects.get(objectId);
    if (!obj) {
      console.warn(`Object ${objectId} not found`);
      return;
    }
    const classDef = this.classes.get(obj.className);
    if (!classDef) {
      console.warn(`Class ${obj.className} not defined`);
      return;
    }
    const method = classDef.methods.get(methodName);
    if (!method) {
      console.warn(`Method ${methodName} not found in class ${obj.className}`);
      return;
    }
    this.currentObjectContext = objectId;
    await this.callFunction(`${obj.className}.${methodName}`, args);
    this.currentObjectContext = null;
  }

  // ---------- Клонирование и параллелизм ----------
  private executeClone(): void {
    const cloneId = `clone_${Date.now()}_${Math.random()}`;
    const cloneCommands = [...this.commands.slice(this.currentIndex)];
    const cloneInfo: CloneInfo = {
      id: cloneId,
      position: this.player.getPosition(),
      inventory: JSON.parse(JSON.stringify(this.player.getInventory())),
      commands: cloneCommands,
      currentIndex: 0,
    };
    this.clones.push(cloneInfo);
    this.cloneStepQueue.set(cloneId, 0);
    this.backdoorUsed = true;
    eventBus.emit('CLONE_CREATED', { cloneId, pos: this.player.getPosition() });
  }

  private async executeJoin(): Promise<void> {
    for (const clone of this.clones) {
      const inv = this.player.getInventory();
      for (const key of clone.inventory.keys) {
        if (!inv.keys.includes(key)) inv.keys.push(key);
      }
      inv.corn += clone.inventory.corn;
      inv.cores += clone.inventory.cores;
      if (clone.inventory.hasDrill) inv.hasDrill = true;
      if (clone.inventory.hasHook) inv.hasHook = true;
      if (clone.inventory.hasWing) inv.hasWing = true;
      if (clone.inventory.hasBait) inv.hasBait = true;
    }
    this.clones = [];
    this.cloneStepQueue.clear();
    eventBus.emit('CLONES_JOINED');
  }

  public async stepClones(): Promise<void> {
    for (const clone of this.clones) {
      const stepIdx = this.cloneStepQueue.get(clone.id) || 0;
      if (stepIdx < clone.commands.length) {
        const cmd = clone.commands[stepIdx];
        // Упрощённая эмуляция движения клона
        if (cmd === Command.UP || cmd === Command.DOWN || cmd === Command.LEFT || cmd === Command.RIGHT) {
          const dir = this.cmdToDirection(cmd);
          const delta = this.directionToDelta(dir);
          const newPos = { col: clone.position.col + delta.col, row: clone.position.row + delta.row };
          if (this.isWithinBounds(newPos) && !this.isWallAt(newPos) && !this.isMonsterAt(newPos)) {
            clone.position = newPos;
            eventBus.emit('CLONE_MOVED', { cloneId: clone.id, pos: newPos });
          }
        }
        this.cloneStepQueue.set(clone.id, stepIdx + 1);
      }
    }
  }

  private cmdToDirection(cmd: Command): 'up' | 'down' | 'left' | 'right' {
    switch (cmd) {
      case Command.UP: return 'up';
      case Command.DOWN: return 'down';
      case Command.LEFT: return 'left';
      default: return 'right';
    }
  }

  // ---------- Реализация команд взаимодействия (полные версии) ----------
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
    if (!this.explorationMode && this.isDeadlyTile(tile, newPos)) {
      this.player.kill('hazard');
      return 'dead';
    }
    const success = this.player.move(dir);
    if (!success && !this.explorationMode) return 'ok';
    if (!this.explorationMode && this.isDeadlyTile(tile, newPos)) {
      this.player.kill('hazard');
      return 'dead';
    }
    return 'ok';
  }

  private executePush(): void {
    const dir = this.player.getDirection();
    const brickPos = this.getFrontPosition(this.player.getPosition(), dir);
    if (this.isBrickAt(brickPos)) {
      const pushPos = this.getFrontPosition(brickPos, dir);
      if (!this.isWallAt(pushPos) && !this.isMonsterAt(pushPos)) {
        this.removeBrick(brickPos);
        this.backdoorUsed = true;
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
      this.player.useTool('bait');
      this.backdoorUsed = true;
    }
  }

  private executeScan(): void {
    const pos = this.player.getPosition();
    const objects: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const scanPos = { col: pos.col + dx, row: pos.row + dy };
        if (this.isWithinBounds(scanPos)) {
          const tile = this.level.map[scanPos.row][scanPos.col];
          if (tile === 10) objects.push('key');
          if (tile === 15) objects.push('drill');
          if (tile === 16) objects.push('hook');
          if (tile === 17) objects.push('wing');
          if (tile === 18) objects.push('bait');
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
    const inv = this.player.getInventory();
    if (inv.keys.length > 0) {
      const keyId = inv.keys[0];
      this.player.useKey(keyId);
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

  private isDeadlyTile(tile: number, pos: Point): boolean {
    if (tile === 2) return true;
    if (tile === 32 || tile === 33) return true;
    const monsterHere = this.level.objects.monsters.some(m => m.position.col === pos.col && m.position.row === pos.row);
    if (monsterHere && !this.explorationMode) return true;
    return false;
  }

  private removeWall(pos: Point): void {
    this.level.map[pos.row][pos.col] = 0;
  }

  private removeBrick(pos: Point): void {
    this.level.map[pos.row][pos.col] = 0;
  }

  private openDoor(pos: Point): void {
    this.level.map[pos.row][pos.col] = 12;
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

  private directionToDelta(dir: 'up' | 'down' | 'left' | 'right'): { col: number; row: number } {
    switch (dir) {
      case 'up': return { col: 0, row: -1 };
      case 'down': return { col: 0, row: 1 };
      case 'left': return { col: -1, row: 0 };
      case 'right': return { col: 1, row: 0 };
    }
  }
}
