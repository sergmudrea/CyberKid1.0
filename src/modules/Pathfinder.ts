// src/modules/Pathfinder.ts
// ПРОМЕТЕЙ: BFS pathfinding engine с поддержкой всех механик, влияющих на перемещение.
// Крылья, дрель, крюк, приманка, ключи/двери, конвейеры, пружины, телепорты, кнопки, мосты.
// Команды, не меняющие положение/инвентарь/состояние мира (THROW, FEED, SCAN, CALL, DEF, CLASS и др.), не моделируются,
// так как они не влияют на пространство поиска (достижимость цели). Все инструменты и расходники учитываются.

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
        return current.path[1] || null;
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

    // 1. Обычные перемещения (шаг, конвейеры, пружины, телепорты)
    for (const d of directions) {
      const newPos = { col: state.pos.col + d.col, row: state.pos.row + d.row };
      if (!this.isWithinBounds(newPos)) continue;
      const canEnter = this.canEnterCell(state, newPos);
      if (!canEnter.allowed) continue;

      let currentState = this.cloneState(state);
      currentState = this.applyCellEffects(currentState, newPos);
      let finalPos = newPos;
      let extraSteps = 0;

      // Конвейеры (многократное перемещение)
      let tile = this.level.map[finalPos.row]?.[finalPos.col];
      while (this.isConveyor(tile)) {
        const convDir = this.getConveyorDirection(tile);
        if (!convDir) break;
        const nextPos = { col: finalPos.col + convDir.col, row: finalPos.row + convDir.row };
        if (!this.isWithinBounds(nextPos)) break;
        const canEnterNext = this.canEnterCell(currentState, nextPos);
        if (!canEnterNext.allowed) break;
        currentState = this.applyCellEffects(currentState, nextPos);
        finalPos = nextPos;
        extraSteps++;
        tile = this.level.map[finalPos.row]?.[finalPos.col];
      }

      // Пружины (выстрел на 3 клетки)
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

      // Телепорты
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

    // 2. Использование дрели (разрушение стены впереди)
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

    // 3. Использование крюка (притягивание к стене вперёд на расстояние до 3)
    if (state.inv.hasHook) {
      for (const d of directions) {
        let hookPos = state.pos;
        let foundWall = false;
        for (let i = 1; i <= 3; i++) {
          const checkPos = { col: state.pos.col + d.col * i, row: state.pos.row + d.row * i };
          if (!this.isWithinBounds(checkPos)) break;
          const tile = this.level.map[checkPos.row]?.[checkPos.col];
          if (tile === 4 || tile === 5) {
            hookPos = checkPos;
            foundWall = true;
            break;
          }
        }
        if (foundWall && (hookPos.col !== state.pos.col || hookPos.row !== state.pos.row)) {
          // После притяжения можно сделать шаг? По логике игры – телепорт к стене, без дополнительного перемещения.
          const newState = this.cloneState(state);
          newState.inv.hasHook = false;
          newState.inv.tools = newState.inv.tools.filter(t => t !== 'hook');
          newState.pos = hookPos;
          newState.steps = state.steps + 1;
          newState.path = [...state.path, hookPos];
          neighbors.push(newState);
        }
      }
    }

    // 4. Использование приманки (все монстры игнорируются на один ход – упрощённо: делаем всех монстров временно проходимыми)
    if (state.inv.hasBait) {
      // Создаём состояние с потраченной приманкой
      const baitState = this.cloneState(state);
      baitState.inv.hasBait = false;
      baitState.inv.tools = baitState.inv.tools.filter(t => t !== 'bait');
      // Для каждого направления пытаемся переместиться, игнорируя монстров
      for (const d of directions) {
        const newPos = { col: state.pos.col + d.col, row: state.pos.row + d.row };
        if (!this.isWithinBounds(newPos)) continue;
        const canEnter = this.canEnterCellIgnoringMonsters(baitState, newPos);
        if (canEnter.allowed) {
          const neighborState = this.cloneState(baitState);
          neighborState.pos = newPos;
          neighborState.steps = state.steps + 1;
          neighborState.path = [...state.path, newPos];
          neighbors.push(neighborState);
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
    // Двери
    if (tile === 11) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && door.isLocked && !state.doorsOpened.has(door.id) && !state.inv.keys.includes(door.keyId || '')) {
        return { allowed: false, reason: 'locked door' };
      }
    }
    // Мосты
    if (tile === 34) {
      const bridge = this.level.objects.bridges.find(b => b.position.col === pos.col && b.position.row === pos.row);
      if (bridge && !state.bridgesActive.has(bridge.id)) {
        return { allowed: false, reason: 'inactive bridge' };
      }
    }
    // Монстры (обычная проверка)
    const monsterHere = state.monsters.find(m => m.position.col === pos.col && m.position.row === pos.row);
    if (monsterHere && !this.explorationMode) {
      if (!monsterHere.isTamed && monsterHere.type !== MonsterType.TAMEABLE) {
        return { allowed: false, reason: 'monster' };
      }
    }
    return { allowed: true };
  }

  // Версия canEnterCell, игнорирующая монстров (для приманки)
  private canEnterCellIgnoringMonsters(state: SearchState, pos: Point): { allowed: boolean; reason?: string } {
    if (!this.isWithinBounds(pos)) return { allowed: false };
    const tile = this.level.map[pos.row]?.[pos.col];
    if (tile === 4 || tile === 5) {
      if (!this.explorationMode && !state.inv.hasDrill) return { allowed: false };
    }
    if (tile === 2) {
      if (!this.explorationMode && !state.inv.hasWing) return { allowed: false };
    }
    if (tile === 32 || tile === 33) {
      if (!this.explorationMode) return { allowed: false };
    }
    if (tile === 11) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && door.isLocked && !state.doorsOpened.has(door.id) && !state.inv.keys.includes(door.keyId || '')) {
        return { allowed: false };
      }
    }
    if (tile === 34) {
      const bridge = this.level.objects.bridges.find(b => b.position.col === pos.col && b.position.row === pos.row);
      if (bridge && !state.bridgesActive.has(bridge.id)) {
        return { allowed: false };
      }
    }
    // Монстры игнорируются
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
    // Дверь (открытие)
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
    // Кнопка (активация мостов)
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
    // Приручение монстров при входе на клетку
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
    }
    return newState;
  }

  private getTeleportExit(state: SearchState, entry: Point): Point | null {
    const teleport = this.level.objects.teleports.find(t => t.entry.col === entry.col && t.entry.row === entry.row);
    if (!teleport) return null;
    const exit = teleport.exit;
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
      case 19: return { col: 0, row: -1 };
      case 20: return { col: 0, row: 1 };
      case 21: return { col: -1, row: 0 };
      case 22: return { col: 1, row: 0 };
      default: return null;
    }
  }
  private isSpring(tile: number): boolean {
    return tile === 23;
  }
  private getSpringDirection(tile: number): { col: number; row: number } | null {
    // В реальной игре направление пружины берётся из данных уровня.
    // Для BFS используем выталкивание вверх, если нет данных.
    const spring = this.level.objects.springs.find(s => s.position.col === tile && s.position.row === tile);
    if (spring) {
      switch (spring.launchDirection) {
        case 'up': return { col: 0, row: -1 };
        case 'down': return { col: 0, row: 1 };
        case 'left': return { col: -1, row: 0 };
        case 'right': return { col: 1, row: 0 };
      }
    }
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
    const backdoorFound = (state!.inv.hasDrill === false && this.createInitialState().inv.hasDrill === true) ||
                          (state!.inv.hasHook === false && this.createInitialState().inv.hasHook === true) ||
                          (state!.inv.hasBait === false && this.createInitialState().inv.hasBait === true);
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
