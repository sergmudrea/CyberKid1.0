// src/modules/__tests__/ExecutionEngine.test.ts
import { ExecutionEngine } from '../ExecutionEngine';
import { LevelData, TileType, Command, MonsterType, Point } from '../../types/index';
import { Player } from '../Player';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
  },
}));

function createMockLevel(): LevelData {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    worldId: 'meadow',
    levelNumber: 1,
    width: 5,
    height: 5,
    map: Array(5).fill(null).map(() => Array(5).fill(TileType.PLATFORM)),
    objects: {
      holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
      springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
      corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
      clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
    },
    startPos: { col: 0, row: 0 },
    coinPos: { col: 4, row: 4 },
    optimalSteps: 8,
    solutions: { easy: { steps: 10, commands: [] }, mid: { steps: 8, commands: [] }, hard: { steps: 8, commands: [] }, backdoor: null },
    isTutorial: false,
    explorationPenalty: false,
  };
}

function mockTileGetter(col: number, row: number): number {
  return 0;
}

describe('ExecutionEngine', () => {
  let level: LevelData;
  let player: Player;
  let engine: ExecutionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    level = createMockLevel();
    player = new Player(level.startPos, 'right', level.width, level.height, mockTileGetter);
    engine = new ExecutionEngine(level, player);
  });

  test('should move and detect victory', async () => {
    level.coinPos = { col: 2, row: 0 };
    const commands = [Command.RIGHT, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition()).toEqual({ col: 2, row: 0 });
    expect(gameEvents.emit).toHaveBeenCalledWith('EXECUTION_FINISHED', expect.objectContaining({ success: true }));
  });

  test('should not die when hitting a wall', async () => {
    level.map[0][1] = TileType.WALL;
    const commands = [Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.isPlayerAlive()).toBe(true);
    expect(player.getPosition()).toEqual({ col: 0, row: 0 });
  });

  test('should die when stepping into a hole', async () => {
    level.map[0][1] = TileType.HOLE;
    const commands = [Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.isPlayerAlive()).toBe(false);
    expect(gameEvents.emit).toHaveBeenCalledWith('EXECUTION_FINISHED', expect.objectContaining({ success: false }));
  });

  test('should handle WAIT command', async () => {
    jest.useFakeTimers();
    const commands = [Command.WAIT, Command.RIGHT];
    engine.loadProgram(commands);
    const promise = engine.start();
    jest.advanceTimersByTime(1000);
    await promise;
    expect(player.getPosition().col).toBe(1);
    jest.useRealTimers();
  });

  test('should handle FOR_N loop', async () => {
    // FOR_N 3 раза RIGHT (упрощённо: парсер обработает)
    const commands = [Command.FOR_N, Command.RIGHT, Command.RIGHT, Command.RIGHT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(3);
  });

  test('should handle WHILE_WALL loop', async () => {
    // Ставим стену через одну клетку
    level.map[0][2] = TileType.WALL;
    const commands = [Command.WHILE_WALL, Command.RIGHT, Command.END, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    // Должен двигаться вправо, пока не упрётся в стену, потом сделать ещё один шаг (но стена блокирует)
    expect(player.getPosition().col).toBe(1);
  });

  test('should handle IF_KEY and ELSE', async () => {
    player.addKey('test_key');
    const commands = [Command.IF_KEY, Command.RIGHT, Command.ELSE, Command.LEFT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
  });

  test('should handle DRILL and detect backdoor', async () => {
    level.map[0][1] = TileType.WALL;
    player.addTool('drill');
    const commands = [Command.DRILL, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
    expect((engine as any).backdoorUsed).toBe(true);
  });

  test('should handle CLONE and JOIN', async () => {
    const commands = [Command.CLONE, Command.RIGHT, Command.JOIN];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getClones()).toHaveLength(0);
    expect(gameEvents.emit).toHaveBeenCalledWith('CLONE_CREATED', expect.any(Object));
  });

  test('should limit max steps', async () => {
    // Бесконечный цикл (while true)
    const commands = [Command.WHILE_WALL, Command.WAIT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(gameEvents.emit).toHaveBeenCalledWith('EXECUTION_FINISHED', expect.objectContaining({ success: false }));
  });
});
