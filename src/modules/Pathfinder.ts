// src/modules/Pathfinder.ts
// Эйдо: BFS pathfinding engine с поддержкой основных механик (движение, инвентарь, монстры, телепорты, конвейеры, пружины, ключи/двери, инструменты).
// ВНИМАНИЕ: условные команды (IF/WHILE) не поддерживаются, т.к. BFS ищет чистый путь без условий.
// Для монстров CHASE/ZOMBIE/BOSS требуется доработка; пока они трактуются как непроходимые (кроме Exploration Mode).

import {
  LevelData,
  Point,
  Inventory,
  Monster,
  MonsterType,
  PathResult,
} from '../types/index';

interface SearchState {
  pos: Point;
  dir: 'up' | 'down' | 'left' | 'right';
  inv: Inventory;
  monsters: Monster[];
  doorsOpened: Set<string>;
  bridgesActive: Set<string>;
  buttonsPressed: Set<string>;
  steps: number;
  path: Point[];
}

function hashState(state: SearchState): string {
  const monstersHash = state.monsters.map(m => `${m.id}:${m.position.col},${m.position.row}:${m.isTamed}:${m.isRidden}`).join('|');
  const doorsHash = Array.from(state.doorsOpened).sort().join(',');
  const bridgesHash = Array.from(state.bridgesActive).sort().join(',');
  const buttonsHash = Array.from(state.buttonsPressed).sort().join(',');
  return `${state.pos.col},${state.pos.row}|dir:${state.dir}|inv:${state.inv.keys.sort().join(',')}|${state.inv.corn}|${state.inv.cores}|${state.inv.hasDrill}|${state.inv.hasHook}|${state.inv.hasWing}|${state.inv.hasBait}|monsters:${monstersHash}|doors:${doorsHash}|bridges:${bridgesHash}|buttons:${buttonsHash}`;
}

export class Pathfinder {
  private level: LevelData;
  private explorationMode: boolean = false;
  private visited: Set<string> = new Set();
  private queue: SearchState[] = [];

  constructor(level: LevelData) {
    this.level = level;
  }

  public setExplorationMode(enabled: boolean): void {
    this.explorationMode = enabled;
  }

  public findOptimalPath(): PathResult | null {
    const startState = this.createInitialState();
    this.visited.clear();
    this.queue = [startState];

    while (this.queue.length > 0) {
      const current = this.queue.shift()!;
      if (this.isGoalReached(current)) {
        return this.buildPathResult(current, true);
      }
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        const hash = hashState(neighbor);
        if (!this.visited.has(hash)) {
          this.visited.add(hash);
          this.queue.push(neighbor);
        }
      }
    }
    return this.buildPathResult(null, false);
  }

  public isSolvable(): boolean {
    return this.findOptimalPath() !== null;
  }

  public getOptimalSteps(): number {
    const result = this.findOptimalPath();
    return result?.stepsCount ?? Infinity;
  }

  public calculateStars(playerSteps: number, optimalSteps: number, explorationUsed: boolean): number {
    if (explorationUsed) return Math.min(2, playerSteps <= optimalSteps ? 2 : 1);
    if (playerSteps <= optimalSteps) return 3;
    if (playerSteps <= optimalSteps * 1.5) return 2;
    return 1;
  }

  public getHint(currentPos: Point, currentInv: Inventory, currentMonsters: Monster[], currentDir: 'up' | 'down' | 'left' | 'right' = 'right'): Point | null {
    const startState = this.createInitialState();
    startState.pos = currentPos;
    startState.inv = currentInv;
    startState.monsters = currentMonsters;
    startState.dir = currentDir;
    this.visited.clear();
    this.queue = [startState];
    let depth = 0;
    const maxDepth = 20;
    while (this.queue.length > 0 && depth < maxDepth) {
      const current = this.queue.shift()!;
      if (this.isGoalReached(current)) {
        return current.path[1] || null; // первый шаг от начальной позиции
      }
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        const hash = hashState(neighbor);
        if (!this.visited.has(hash)) {
          this.visited.add(hash);
          this.queue.push(neighbor);
        }
      }
      depth++;
    }
    return null;
  }

  // ---- Private methods ----
  private createInitialState(): SearchState {
    const startPos = { ...this.level.startPos };
    const inv: Inventory = {
      keys: [],
      corn: 0,
      cores: 0,
      hasDrill: false,
      hasHook: false,
      hasWing: false,
      hasBait: false,
      tools: [],
    };
    const monsters = this.level.objects.monsters.map(m => ({
      ...m,
      position: { ...m.position },
      isTamed: m.isTamed,
      isRidden: m.isRidden,
    }));
    return {
      pos: startPos,
      dir: 'right',
      inv,
      monsters,
      doorsOpened: new Set(),
      bridgesActive: new Set(),
      buttonsPressed: new Set(),
      steps: 0,
      path: [startPos],
    };
  }

  private isGoalReached(state: SearchState): boolean {
    return state.pos.col === this.level.coinPos.col && state.pos.row === this.level.coinPos.row;
  }

  private getNeighbors(state: SearchState): SearchState[] {
    const neighbors: SearchState[] = [];
    const directions: { col: number; row: number; dir: 'up' | 'down' | 'left' | 'right' }[] = [
      { col: 0, row: -1, dir: 'up' },
      { col: 0, row: 1, dir: 'down' },
      { col: -1, row: 0, dir: 'left' },
      { col: 1, row: 0, dir: 'right' },
    ];
    for (const d of directions) {
      const newPos = { col: state.pos.col + d.col, row: state.pos.row + d.row };
      if (!this.isWithinBounds(newPos)) continue;
      const canEnter = this.canEnterCell(state, newPos);
      if (!canEnter.allowed) continue;

      // Применяем эффекты клетки ПОСЛЕ входа (сбор предметов, активация кнопок)
      let currentState = this.cloneState(state);
      currentState = this.applyCellEffects(currentState, newPos);
      let finalPos = newPos;
      let extraSteps = 0;

      // Обработка конвейера (многократное перемещение)
      let tile = this.level.map[finalPos.row]?.[finalPos.col];
      while (this.isConveyor(tile)) {
        const convDir = this.getConveyorDirection(tile);
        if (!convDir) break;
        const nextPos = { col: finalPos.col + convDir.col, row: finalPos.row + convDir.row };
        if (!this.isWithinBounds(nextPos)) break;
        const canEnterNext = this.canEnterCell(currentState, nextPos);
        if (!canEnterNext.allowed) break;
        // Применяем эффекты промежуточной клетки конвейера
        currentState = this.applyCellEffects(currentState, nextPos);
        finalPos = nextPos;
        extraSteps++;
        tile = this.level.map[finalPos.row]?.[finalPos.col];
      }

      // Обработка пружины
      tile = this.level.map[finalPos.row]?.[finalPos.col];
      if (this.isSpring(tile)) {
        const springDir = this.getSpringDirection(tile);
        if (springDir) {
          let springPos = { ...finalPos };
          for (let i = 0; i < 3; i++) {
            const next = { col: springPos.col + springDir.col, row: springPos.row + springDir.row };
            if (!this.isWithinBounds(next)) break;
            const canEnterNext = this.canEnterCell(currentState, next);
            if (!canEnterNext.allowed) break;
            currentState = this.applyCellEffects(currentState, next);
            springPos = next;
            extraSteps++;
            if (this.isTeleportIn(this.level.map[springPos.row]?.[springPos.col])) {
              const exit = this.getTeleportExit(currentState, springPos);
              if (exit) {
                currentState = this.applyCellEffects(currentState, exit);
                springPos = exit;
                extraSteps++;
              }
            }
          }
          finalPos = springPos;
        }
      }

      // Обработка телепорта (после всех перемещений)
      tile = this.level.map[finalPos.row]?.[finalPos.col];
      if (this.isTeleportIn(tile)) {
        const exit = this.getTeleportExit(currentState, finalPos);
        if (exit) {
          currentState = this.applyCellEffects(currentState, exit);
          finalPos = exit;
          extraSteps++;
        }
      }

      const newState = this.cloneState(currentState);
      newState.pos = finalPos;
      newState.steps = state.steps + 1 + extraSteps;
      newState.path = [...state.path, finalPos];
      neighbors.push(newState);
    }

    // Использование drill (сверлить стену)
    if (state.inv.hasDrill) {
      const dirs = [
        { col: 0, row: -1, dir: 'up' as const },
        { col: 0, row: 1, dir: 'down' as const },
        { col: -1, row: 0, dir: 'left' as const },
        { col: 1, row: 0, dir: 'right' as const },
      ];
      for (const d of dirs) {
        const wallPos = { col: state.pos.col + d.col, row: state.pos.row + d.row };
        if (!this.isWithinBounds(wallPos)) continue;
        const tile = this.level.map[wallPos.row]?.[wallPos.col];
        if (tile === 4 || tile === 5) { // WALL или FAKE_WALL
          const afterPos = { col: wallPos.col + d.col, row: wallPos.row + d.row };
          if (this.isWithinBounds(afterPos) && this.canEnterCell(state, afterPos).allowed) {
            const newState = this.cloneState(state);
            newState.inv.hasDrill = false;
            newState.inv.tools = newState.inv.tools.filter(t => t !== 'drill');
            newState.pos = afterPos;
            newState.steps = state.steps + 1;
            newState.path = [...state.path, afterPos];
            neighbors.push(newState);
          }
        }
      }
    }

    return neighbors;
  }

  private canEnterCell(state: SearchState, pos: Point): { allowed: boolean; reason?: string } {
    if (!this.isWithinBounds(pos)) return { allowed: false, reason: 'out of bounds' };
    const tile = this.level.map[pos.row]?.[pos.col];
    // Стены
    if (tile === 4 || tile === 5) {
      if (!this.explorationMode && !state.inv.hasDrill) return { allowed: false, reason: 'wall' };
    }
    // Яма
    if (tile === 2) {
      if (!this.explorationMode && !state.inv.hasWing) return { allowed: false, reason: 'hole' };
    }
    // Лава / вода
    if (tile === 32 || tile === 33) {
      if (!this.explorationMode) return { allowed: false, reason: 'lava/water' };
    }
    // Двери (locked)
    if (tile === 11) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && door.isLocked && !state.doorsOpened.has(door.id) && !state.inv.keys.includes(door.keyId || '')) {
        return { allowed: false, reason: 'locked door' };
      }
    }
    // Мосты (неактивные непроходимы)
    if (tile === 34) {
      const bridge = this.level.objects.bridges.find(b => b.position.col === pos.col && b.position.row === pos.row);
      if (bridge && !state.bridgesActive.has(bridge.id)) {
        return { allowed: false, reason: 'inactive bridge' };
      }
    }
    // Монстры
    const monsterHere = state.monsters.find(m => m.position.col === pos.col && m.position.row === pos.row);
    if (monsterHere && !this.explorationMode) {
      // Приручённые или tameable (если накормлены) — проходимы
      if (!monsterHere.isTamed && monsterHere.type !== MonsterType.TAMEABLE) {
        // Для CHASE, ZOMBIE, BOSS пока считаем непроходимыми
        return { allowed: false, reason: 'monster' };
      }
    }
    return { allowed: true };
  }

  private applyCellEffects(state: SearchState, pos: Point): SearchState {
    const newState = this.cloneState(state);
    const tile = this.level.map[pos.row]?.[pos.col];
    // Ключ
    if (tile === 10) {
      const keyObj = this.level.objects.keys.find(k => k.col === pos.col && k.row === pos.row);
      const keyId = (keyObj as any)?.keyId || `key_${pos.col}_${pos.row}`;
      if (!newState.inv.keys.includes(keyId)) {
        newState.inv.keys.push(keyId);
      }
    }
    // Кукуруза
    if (tile === 13) newState.inv.corn++;
    // Ядро
    if (tile === 14) newState.inv.cores++;
    // Инструменты
    if (tile === 15) { newState.inv.hasDrill = true; newState.inv.tools.push('drill'); }
    if (tile === 16) { newState.inv.hasHook = true; newState.inv.tools.push('hook'); }
    if (tile === 17) { newState.inv.hasWing = true; newState.inv.tools.push('wing'); }
    if (tile === 18) { newState.inv.hasBait = true; newState.inv.tools.push('bait'); }
    // Дверь (открытие, если есть ключ)
    if (tile === 11) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && door.isLocked && !newState.doorsOpened.has(door.id)) {
        const keyIdx = newState.inv.keys.indexOf(door.keyId || '');
        if (keyIdx !== -1) {
          newState.inv.keys.splice(keyIdx, 1);
          newState.doorsOpened.add(door.id);
        }
      }
    }
    // Кнопка
    if (tile === 29) {
      const buttonId = `${pos.col},${pos.row}`;
      if (!newState.buttonsPressed.has(buttonId)) {
        newState.buttonsPressed.add(buttonId);
        const bridges = this.level.objects.bridges.filter(b => b.buttonId === buttonId);
        for (const b of bridges) {
          newState.bridgesActive.add(b.id);
        }
      }
    }
    // Кормление монстров (при входе на клетку с монстром)
    const monsterIdx = newState.monsters.findIndex(m => m.position.col === pos.col && m.position.row === pos.row);
    if (monsterIdx !== -1) {
      const monster = newState.monsters[monsterIdx];
      if (monster.type === MonsterType.TAMEABLE && newState.inv.corn > 0 && !monster.isTamed) {
        newState.inv.corn--;
        monster.isTamed = true;
      } else if (monster.type === MonsterType.CHASE && newState.inv.cores > 0 && !monster.isTamed) {
        newState.inv.cores--;
        monster.isTamed = true;
      }
      // Для ZOMBIE и BOSS пока не поддерживается приручение
    }
    return newState;
  }

  private getTeleportExit(state: SearchState, entry: Point): Point | null {
    const teleport = this.level.objects.teleports.find(t => t.entry.col === entry.col && t.entry.row === entry.row);
    if (!teleport) return null;
    const exit = teleport.exit;
    // Проверяем, можно ли войти на выход
    if (this.canEnterCell(state, exit).allowed) {
      return exit;
    }
    return null;
  }

  private cloneState(state: SearchState): SearchState {
    return {
      pos: { ...state.pos },
      dir: state.dir,
      inv: {
        keys: [...state.inv.keys],
        corn: state.inv.corn,
        cores: state.inv.cores,
        hasDrill: state.inv.hasDrill,
        hasHook: state.inv.hasHook,
        hasWing: state.inv.hasWing,
        hasBait: state.inv.hasBait,
        tools: [...state.inv.tools],
      },
      monsters: state.monsters.map(m => ({
        ...m,
        position: { ...m.position },
      })),
      doorsOpened: new Set(state.doorsOpened),
      bridgesActive: new Set(state.bridgesActive),
      buttonsPressed: new Set(state.buttonsPressed),
      steps: state.steps,
      path: [...state.path],
    };
  }

  private isWithinBounds(pos: Point): boolean {
    return pos.col >= 0 && pos.col < this.level.width && pos.row >= 0 && pos.row < this.level.height;
  }

  private isConveyor(tile: number): boolean {
    return tile >= 19 && tile <= 22;
  }
  private getConveyorDirection(tile: number): { col: number; row: number } | null {
    switch (tile) {
      case 19: return { col: 0, row: -1 }; // CONVEYOR_UP
      case 20: return { col: 0, row: 1 };  // CONVEYOR_DOWN
      case 21: return { col: -1, row: 0 }; // CONVEYOR_LEFT
      case 22: return { col: 1, row: 0 };  // CONVEYOR_RIGHT
      default: return null;
    }
  }
  private isSpring(tile: number): boolean {
    return tile === 23;
  }
  private getSpringDirection(tile: number): { col: number; row: number } | null {
    // Для упрощения пружина всегда толкает вверх; в реальности нужно брать из объектов уровня
    return { col: 0, row: -1 };
  }
  private isTeleportIn(tile: number): boolean {
    return tile === 24;
  }

  private buildPathResult(state: SearchState | null, success: boolean): PathResult {
    if (!success) {
      return {
        isValid: false,
        path: [],
        stepsCount: 0,
        errorMessage: 'No path found',
        finalInventory: this.createInitialState().inv,
        monstersState: [],
        visitedCells: 0,
        optimalStepsReference: 0,
        starsEarned: 0,
        killedByMonster: false,
        fellIntoHole: false,
        fellIntoLava: false,
        drowned: false,
        explorationUsed: this.explorationMode,
        backdoorFound: false,
      };
    }
    const backdoorFound = state!.inv.hasDrill === false && this.createInitialState().inv.hasDrill === true;
    return {
      isValid: true,
      path: state!.path,
      stepsCount: state!.steps,
      finalInventory: state!.inv,
      monstersState: state!.monsters,
      visitedCells: this.visited.size,
      optimalStepsReference: state!.steps,
      starsEarned: 3,
      killedByMonster: false,
      fellIntoHole: false,
      fellIntoLava: false,
      drowned: false,
      explorationUsed: this.explorationMode,
      backdoorFound,
    };
  }
}
