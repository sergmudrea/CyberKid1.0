import { LevelData, Point, Inventory, Monster, MonsterType } from '../../src/types/index';

interface SearchNode {
  pos: Point;
  steps: number;
  path: Point[];
  inv: Inventory;
  monsters: Monster[];
}

export class Pathfinder {
  private level: LevelData;
  constructor(level: LevelData) {
    this.level = level;
  }
  isSolvable(): boolean {
    return this.findPath() !== null;
  }
  findPath(): SearchNode | null {
    const start: SearchNode = {
      pos: this.level.startPos,
      steps: 0,
      path: [this.level.startPos],
      inv: { keys: [], corn: 0, cores: 0, hasDrill: false, hasHook: false, hasWing: false, hasBait: false, tools: [] },
      monsters: [],
    };
    const queue: SearchNode[] = [start];
    const visited = new Set<string>();
    while (queue.length) {
      const current = queue.shift()!;
      if (current.pos.col === this.level.coinPos.col && current.pos.row === this.level.coinPos.row) {
        return current;
      }
      const key = `${current.pos.col},${current.pos.row}`;
      if (visited.has(key)) continue;
      visited.add(key);
      for (const dir of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const newPos = { col: current.pos.col + dir[0], row: current.pos.row + dir[1] };
        if (newPos.col < 0 || newPos.col >= this.level.width || newPos.row < 0 || newPos.row >= this.level.height) continue;
        const tile = this.level.map[newPos.row][newPos.col];
        if (tile === 1 || tile === 4) continue;
        queue.push({
          pos: newPos,
          steps: current.steps + 1,
          path: [...current.path, newPos],
          inv: current.inv,
          monsters: current.monsters,
        });
      }
    }
    return null;
  }
}
