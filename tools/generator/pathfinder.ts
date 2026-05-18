// tools/generator/pathfinder.ts
// ПРОМЕТЕЙ: Обновлённая BFS-валидация для генератора уровней.
// Синхронизирована с клиентским Pathfinder (поддерживает крылья, дрель, крюк, приманку, ключи/двери, кнопки, мосты, конвейеры, телепорты).

import { LevelData, Point, Inventory, Monster, MonsterType, TileType } from '../../src/types/index';

interface ValidationState {
  pos: Point;
  inv: Inventory;
  monsters: Monster[];
  doorsOpened: Set<string>;
  bridgesActive: Set<string>;
  buttonsPressed: Set<string>;
  steps: number;
}

function hashState(state: ValidationState): string {
  const monstersHash = state.monsters.map(m => `${m.id}:${m.position.col},${m.position.row}:${m.isTamed}`).join('|');
  const doorsHash = Array.from(state.doorsOpened).sort().join(',');
  const bridgesHash = Array.from(state.bridgesActive).sort().join(',');
  const buttonsHash = Array.from(state.buttonsPressed).sort().join(',');
  return `${state.pos.col},${state.pos.row}|inv:${state.inv.keys.sort().join(',')}|${state.inv.corn}|${state.inv.cores}|${state.inv.hasDrill}|${state.inv.hasHook}|${state.inv.hasWing}|${state.inv.hasBait}|monsters:${monstersHash}|doors:${doorsHash}|bridges:${bridgesHash}|buttons:${buttonsHash}`;
}

export class Pathfinder {
  private level: LevelData;
  private visited: Set<string> = new Set();
  private queue: ValidationState[] = [];

  constructor(level: LevelData) {
    this.level = level;
  }

  isSolvable(): boolean {
    return this.findPath() !== null;
  }

  findPath(): ValidationState | null {
    const startState = this.createInitialState();
    this.visited.clear();
    this.queue = [startState];
    const maxNodes = 50000;
    let nodesVisited = 0;

    while (this.queue.length && nodesVisited < maxNodes) {
      const current = this.queue.shift()!;
      nodesVisited++;

      if (this.isGoal(current)) {
        return current;
      }

      const hash = hashState(current);
      if (this.visited.has(hash)) continue;
      this.visited.add(hash);

      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        this.queue.push(neighbor);
      }
    }
    return null;
  }

  private isGoal(state: ValidationState): boolean {
    return state.pos.col === this.level.coinPos.col && state.pos.row === this.level.coinPos.row;
  }

  private createInitialState(): ValidationState {
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
    }));
    return {
      pos: startPos,
      inv,
      monsters,
      doorsOpened: new Set(),
      bridgesActive: new Set(),
      buttonsPressed: new Set(),
      steps: 0,
    };
  }

  private getNeighbors(state: ValidationState): ValidationState[] {
    const neighbors: ValidationState[] = [];
    const dirs = [
      { col: 0, row: -1 }, // up
      { col: 0, row: 1 },  // down
      { col: -1, row: 0 }, // left
      { col: 1, row: 0 },  // right
    ];

    // 1. Обычные перемещения
    for (const delta of dirs) {
      const newPos = { col: state.pos.col + delta.col, row: state.pos.row + delta.row };
      if (!this.isWithinBounds(newPos)) continue;
      const canEnter = this.canEnterCell(state, newPos);
      if (!canEnter) continue;

      let currentState = this.cloneState(state);
      currentState = this.applyCellEffects(currentState, newPos);
      let finalPos = newPos;
      let extraSteps = 0;

      // Конвейеры
      let tile = this.level.map[finalPos.row]?.[finalPos.col];
      while (this.isConveyor(tile)) {
        const convDir = this.getConveyorDirection(tile);
        if (!convDir) break;
        const nextPos = { col: finalPos.col + convDir.col, row: finalPos.row + convDir.row };
        if (!this.isWithinBounds(nextPos)) break;
        const canEnterNext = this.canEnterCell(currentState, nextPos);
        if (!canEnterNext) break;
        currentState = this.applyCellEffects(currentState, nextPos);
        finalPos = nextPos;
        extraSteps++;
        tile = this.level.map[finalPos.row]?.[finalPos.col];
      }

      // Пружины
      tile = this.level.map[finalPos.row]?.[finalPos.col];
      if (this.isSpring(tile)) {
        const springDir = this.getSpringDirection(tile);
        if (springDir) {
          let springPos = { ...finalPos };
          for (let i = 0; i < 3; i++) {
            const next = { col: springPos.col + springDir.col, row: springPos.row + springDir.row };
            if (!this.isWithinBounds(next)) break;
            const canEnterNext = this.canEnterCell(currentState, next);
            if (!canEnterNext) break;
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
      neighbors.push(newState);
    }

    // 2. Дрель (разрушение стены впереди)
    if (state.inv.hasDrill) {
      for (const delta of dirs) {
        const wallPos = { col: state.pos.col + delta.col, row: state.pos.row + delta.row };
        if (!this.isWithinBounds(wallPos)) continue;
        const tile = this.level.map[wallPos.row]?.[wallPos.col];
        if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
          const afterPos = { col: wallPos.col + delta.col, row: wallPos.row + delta.row };
          if (this.isWithinBounds(afterPos) && this.canEnterCell(state, afterPos)) {
            const newState = this.cloneState(state);
            newState.inv.hasDrill = false;
            newState.inv.tools = newState.inv.tools.filter(t => t !== 'drill');
            newState.pos = afterPos;
            newState.steps = state.steps + 1;
            neighbors.push(newState);
          }
        }
      }
    }

    // 3. Крюк (притягивание к стене)
    if (state.inv.hasHook) {
      for (const delta of dirs) {
        let hookPos = state.pos;
        let foundWall = false;
        for (let i = 1; i <= 3; i++) {
          const checkPos = { col: state.pos.col + delta.col * i, row: state.pos.row + delta.row * i };
          if (!this.isWithinBounds(checkPos)) break;
          const tile = this.level.map[checkPos.row]?.[checkPos.col];
          if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
            hookPos = checkPos;
            foundWall = true;
            break;
          }
        }
        if (foundWall && (hookPos.col !== state.pos.col || hookPos.row !== state.pos.row)) {
          const newState = this.cloneState(state);
          newState.inv.hasHook = false;
          newState.inv.tools = newState.inv.tools.filter(t => t !== 'hook');
          newState.pos = hookPos;
          newState.steps = state.steps + 1;
          neighbors.push(newState);
        }
      }
    }

    // 4. Приманка (игнорирование монстров на один ход)
    if (state.inv.hasBait) {
      const baitState = this.cloneState(state);
      baitState.inv.hasBait = false;
      baitState.inv.tools = baitState.inv.tools.filter(t => t !== 'bait');
      for (const delta of dirs) {
        const newPos = { col: state.pos.col + delta.col, row: state.pos.row + delta.row };
        if (!this.isWithinBounds(newPos)) continue;
        const canEnter = this.canEnterCellIgnoringMonsters(baitState, newPos);
        if (canEnter) {
          const neighborState = this.cloneState(baitState);
          neighborState.pos = newPos;
          neighborState.steps = state.steps + 1;
          neighbors.push(neighborState);
        }
      }
    }

    return neighbors;
  }

  private canEnterCell(state: ValidationState, pos: Point): boolean {
    if (!this.isWithinBounds(pos)) return false;
    const tile = this.level.map[pos.row]?.[pos.col];
    if (tile === TileType.WALL || tile === TileType.FAKE_WALL) {
      if (!state.inv.hasDrill) return false;
    }
    if (tile === TileType.HOLE && !state.inv.hasWing) return false;
    if (tile === TileType.LAVA || tile === TileType.WATER) return false;
    if (tile === TileType.DOOR_LOCKED) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && !state.doorsOpened.has(door.id) && !state.inv.keys.includes(door.keyId || '')) {
        return false;
      }
    }
    if (tile === TileType.BRIDGE) {
      const bridge = this.level.objects.bridges.find(b => b.position.col === pos.col && b.position.row === pos.row);
      if (bridge && !state.bridgesActive.has(bridge.id)) return false;
    }
    const monsterHere = state.monsters.find(m => m.position.col === pos.col && m.position.row === pos.row);
    if (monsterHere && !monsterHere.isTamed && monsterHere.type !== MonsterType.TAMEABLE) {
      return false;
    }
    return true;
  }

  private canEnterCellIgnoringMonsters(state: ValidationState, pos: Point): boolean {
    if (!this.isWithinBounds(pos)) return false;
    const tile = this.level.map[pos.row]?.[pos.col];
    if (tile === TileType.WALL || tile === TileType.FAKE_WALL) return false;
    if (tile === TileType.HOLE && !state.inv.hasWing) return false;
    if (tile === TileType.LAVA || tile === TileType.WATER) return false;
    if (tile === TileType.DOOR_LOCKED) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && !state.doorsOpened.has(door.id) && !state.inv.keys.includes(door.keyId || '')) {
        return false;
      }
    }
    if (tile === TileType.BRIDGE) {
      const bridge = this.level.objects.bridges.find(b => b.position.col === pos.col && b.position.row === pos.row);
      if (bridge && !state.bridgesActive.has(bridge.id)) return false;
    }
    return true;
  }

  private applyCellEffects(state: ValidationState, pos: Point): ValidationState {
    const newState = this.cloneState(state);
    const tile = this.level.map[pos.row]?.[pos.col];
    if (tile === TileType.KEY) {
      const keyId = `key_${pos.col}_${pos.row}`;
      if (!newState.inv.keys.includes(keyId)) newState.inv.keys.push(keyId);
    }
    if (tile === TileType.CORN) newState.inv.corn++;
    if (tile === TileType.CORE) newState.inv.cores++;
    if (tile === TileType.TOOL_DRILL) { newState.inv.hasDrill = true; newState.inv.tools.push('drill'); }
    if (tile === TileType.TOOL_HOOK) { newState.inv.hasHook = true; newState.inv.tools.push('hook'); }
    if (tile === TileType.TOOL_WING) { newState.inv.hasWing = true; newState.inv.tools.push('wing'); }
    if (tile === TileType.TOOL_BAIT) { newState.inv.hasBait = true; newState.inv.tools.push('bait'); }
    if (tile === TileType.DOOR_LOCKED) {
      const door = this.level.objects.doors.find(d => d.position.col === pos.col && d.position.row === pos.row);
      if (door && !newState.doorsOpened.has(door.id)) {
        const keyIdx = newState.inv.keys.indexOf(door.keyId || '');
        if (keyIdx !== -1) {
          newState.inv.keys.splice(keyIdx, 1);
          newState.doorsOpened.add(door.id);
        }
      }
    }
    if (tile === TileType.BUTTON) {
      const buttonId = `${pos.col},${pos.row}`;
      if (!newState.buttonsPressed.has(buttonId)) {
        newState.buttonsPressed.add(buttonId);
        const bridges = this.level.objects.bridges.filter(b => b.buttonId === buttonId);
        for (const b of bridges) {
          newState.bridgesActive.add(b.id);
        }
      }
    }
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

  private getTeleportExit(state: ValidationState, entry: Point): Point | null {
    const teleport = this.level.objects.teleports.find(t => t.entry.col === entry.col && t.entry.row === entry.row);
    if (!teleport) return null;
    const exit = teleport.exit;
    if (this.canEnterCell(state, exit)) return exit;
    return null;
  }

  private cloneState(state: ValidationState): ValidationState {
    return {
      pos: { ...state.pos },
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
      monsters: state.monsters.map(m => ({ ...m, position: { ...m.position } })),
      doorsOpened: new Set(state.doorsOpened),
      bridgesActive: new Set(state.bridgesActive),
      buttonsPressed: new Set(state.buttonsPressed),
      steps: state.steps,
    };
  }

  private isWithinBounds(pos: Point): boolean {
    return pos.col >= 0 && pos.col < this.level.width && pos.row >= 0 && pos.row < this.level.height;
  }

  private isConveyor(tile: number): boolean { return tile >= 19 && tile <= 22; }
  private getConveyorDirection(tile: number): { col: number; row: number } | null {
    switch (tile) {
      case 19: return { col: 0, row: -1 };
      case 20: return { col: 0, row: 1 };
      case 21: return { col: -1, row: 0 };
      case 22: return { col: 1, row: 0 };
      default: return null;
    }
  }
  private isSpring(tile: number): boolean { return tile === 23; }
  private getSpringDirection(tile: number): { col: number; row: number } | null {
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
  private isTeleportIn(tile: number): boolean { return tile === 24; }
}
