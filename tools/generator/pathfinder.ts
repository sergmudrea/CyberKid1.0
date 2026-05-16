// tools/generator/pathfinder.ts
// Полноценный BFS для валидации уровней (поддерживает основные механики)
import { LevelData, Point, Inventory, Monster, MonsterType, TileType } from '../../src/types/index';

interface SearchNode {
  pos: Point;
  steps: number;
  inv: Inventory;
  monsters: Monster[];
  doorsOpened: Set<string>;
  bridgesActive: Set<string>;
  buttonsPressed: Set<string>;
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
    const startInv: Inventory = { keys: [], corn: 0, cores: 0, hasDrill: false, hasHook: false, hasWing: false, hasBait: false, tools: [] };
    const startMonsters = this.level.objects.monsters.map(m => ({ ...m, position: { ...m.position } }));
    const startNode: SearchNode = {
      pos: { ...this.level.startPos },
      steps: 0,
      inv: startInv,
      monsters: startMonsters,
      doorsOpened: new Set(),
      bridgesActive: new Set(),
      buttonsPressed: new Set(),
    };
    const queue: SearchNode[] = [startNode];
    const visited = new Set<string>();
    const maxNodes = 50000;
    let nodesVisited = 0;
    
    while (queue.length && nodesVisited < maxNodes) {
      const current = queue.shift()!;
      nodesVisited++;
      
      if (this.isGoal(current)) {
        return current;
      }
      
      const hash = this.hashState(current);
      if (visited.has(hash)) continue;
      visited.add(hash);
      
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        queue.push(neighbor);
      }
    }
    return null;
  }
  
  private isGoal(node: SearchNode): boolean {
    return node.pos.col === this.level.coinPos.col && node.pos.row === this.level.coinPos.row;
  }
  
  private hashState(node: SearchNode): string {
    const monstersHash = node.monsters.map(m => `${m.id}:${m.position.col},${m.position.row}:${m.isTamed}`).join('|');
    return `${node.pos.col},${node.pos.row}|keys:${node.inv.keys.sort()}|corn:${node.inv.corn}|drill:${node.inv.hasDrill}|wing:${node.inv.hasWing}|monsters:${monstersHash}`;
  }
  
  private getNeighbors(node: SearchNode): SearchNode[] {
    const neighbors: SearchNode[] = [];
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dx, dy] of dirs) {
      const newPos = { col: node.pos.col + dx, row: node.pos.row + dy };
      if (newPos.col < 0 || newPos.col >= this.level.width || newPos.row < 0 || newPos.row >= this.level.height) continue;
      const tile = this.level.map[newPos.row][newPos.col];
      if (tile === TileType.WALL || tile === TileType.FAKE_WALL) continue;
      if (tile === TileType.HOLE && !node.inv.hasWing) continue;
      if (tile === TileType.DOOR_LOCKED) {
        const door = this.level.objects.doors.find(d => d.position.col === newPos.col && d.position.row === newPos.row);
        if (door && !node.doorsOpened.has(door.id) && !node.inv.keys.includes(door.keyId || '')) continue;
      }
      const monsterHere = node.monsters.find(m => m.position.col === newPos.col && m.position.row === newPos.row);
      if (monsterHere && !monsterHere.isTamed) continue;
      
      const newInv = { ...node.inv, keys: [...node.inv.keys] };
      const newMonsters = node.monsters.map(m => ({ ...m }));
      const newDoors = new Set(node.doorsOpened);
      const newBridges = new Set(node.bridgesActive);
      const newButtons = new Set(node.buttonsPressed);
      
      if (tile === TileType.KEY) {
        newInv.keys.push(`key_${newPos.col}_${newPos.row}`);
      }
      if (tile === TileType.TOOL_WING) {
        newInv.hasWing = true;
      }
      if (tile === TileType.TOOL_DRILL) {
        newInv.hasDrill = true;
      }
      if (tile === TileType.CORN) {
        newInv.corn++;
      }
      if (tile === TileType.DOOR_LOCKED) {
        const door = this.level.objects.doors.find(d => d.position.col === newPos.col && d.position.row === newPos.row);
        if (door && newInv.keys.includes(door.keyId || '')) {
          newInv.keys = newInv.keys.filter(k => k !== door.keyId);
          newDoors.add(door.id);
        }
      }
      if (monsterHere && monsterHere.type === MonsterType.TAMEABLE && newInv.corn > 0) {
        newInv.corn--;
        const idx = newMonsters.findIndex(m => m.id === monsterHere.id);
        if (idx !== -1) newMonsters[idx].isTamed = true;
      }
      
      neighbors.push({
        pos: newPos,
        steps: node.steps + 1,
        inv: newInv,
        monsters: newMonsters,
        doorsOpened: newDoors,
        bridgesActive: newBridges,
        buttonsPressed: newButtons,
      });
    }
    return neighbors;
  }
}
