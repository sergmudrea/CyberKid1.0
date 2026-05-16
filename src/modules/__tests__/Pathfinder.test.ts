// src/modules/__tests__/Pathfinder.test.ts
import { Pathfinder } from '../Pathfinder';
import { LevelData, TileType, Command, MonsterType, Point } from '../../types/index';

function createSimpleLevel(): LevelData {
  return {
    id: 'test_001',
    name: 'Simple',
    description: '',
    worldId: 'meadow',
    levelNumber: 1,
    width: 5,
    height: 5,
    map: Array(5).fill(null).map(() => Array(5).fill(TileType.PLATFORM)),
    objects: {
      holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
      springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [], corn: [],
      cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [], clonePoints: [],
      ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
    },
    startPos: { col: 0, row: 0 },
    coinPos: { col: 4, row: 4 },
    optimalSteps: 8,
    solutions: { easy: { steps: 10, commands: [] }, mid: { steps: 8, commands: [] }, hard: { steps: 8, commands: [] }, backdoor: null },
    isTutorial: true,
    explorationPenalty: false,
  };
}

describe('Pathfinder', () => {
  test('should find optimal path in empty grid', () => {
    const level = createSimpleLevel();
    const pf = new Pathfinder(level);
    const result = pf.findOptimalPath();
    expect(result).not.toBeNull();
    expect(result?.isValid).toBe(true);
    expect(result?.stepsCount).toBe(8); // 4 вправо + 4 вниз = 8
  });

  test('should detect unsolvable level (wall blocking)', () => {
    const level = createSimpleLevel();
    level.map[1][0] = TileType.WALL;
    level.map[1][1] = TileType.WALL;
    level.map[1][2] = TileType.WALL;
    level.map[1][3] = TileType.WALL;
    level.map[1][4] = TileType.WALL;
    const pf = new Pathfinder(level);
    const result = pf.findOptimalPath();
    expect(result).toBeNull();
    expect(pf.isSolvable()).toBe(false);
  });

  test('should handle key and door', () => {
    const level = createSimpleLevel();
    level.map[2][2] = TileType.KEY;
    level.map[3][3] = TileType.DOOR_LOCKED;
    level.objects.keys.push({ col: 2, row: 2 });
    level.objects.doors.push({ id: 'door1', position: { col: 3, row: 3 }, isLocked: true, keyId: 'key1' });
    const pf = new Pathfinder(level);
    const result = pf.findOptimalPath();
    expect(result).not.toBeNull();
    expect(result?.isValid).toBe(true);
  });

  test('should calculate stars correctly', () => {
    const pf = new Pathfinder(createSimpleLevel());
    expect(pf.calculateStars(8, 8, false)).toBe(3);
    expect(pf.calculateStars(10, 8, false)).toBe(2);
    expect(pf.calculateStars(15, 8, false)).toBe(1);
    expect(pf.calculateStars(8, 8, true)).toBe(2);
    expect(pf.calculateStars(15, 8, true)).toBe(1);
  });

  test('should handle conveyor belts', () => {
    const level = createSimpleLevel();
    level.map[1][1] = TileType.CONVEYOR_RIGHT;
    level.map[1][2] = TileType.PLATFORM;
    const pf = new Pathfinder(level);
    const result = pf.findOptimalPath();
    expect(result).not.toBeNull();
  });

  test('should handle teleporters', () => {
    const level = createSimpleLevel();
    level.map[2][2] = TileType.TELEPORT_IN;
    level.map[4][4] = TileType.TELEPORT_OUT;
    level.objects.teleports.push({ id: 'tp1', entry: { col: 2, row: 2 }, exit: { col: 4, row: 4 } });
    const pf = new Pathfinder(level);
    const result = pf.findOptimalPath();
    expect(result).not.toBeNull();
  });

  test('should handle drill tool', () => {
    const level = createSimpleLevel();
    level.map[1][0] = TileType.WALL;
    level.map[1][0] = TileType.WALL;
    level.objects.drills.push({ col: 0, row: 1 });
    level.map[0][1] = TileType.TOOL_DRILL;
    const pf = new Pathfinder(level);
    const result = pf.findOptimalPath();
    expect(result).not.toBeNull();
    expect(result?.backdoorFound).toBe(true); // drill использован
  });

  test('should handle exploration mode (no death)', () => {
    const level = createSimpleLevel();
    level.map[2][2] = TileType.HOLE;
    const pf = new Pathfinder(level);
    pf.setExplorationMode(true);
    const result = pf.findOptimalPath();
    expect(result).not.toBeNull();
    expect(result?.explorationUsed).toBe(true);
  });
});
