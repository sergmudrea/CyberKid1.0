// src/managers/__tests__/LevelManager.test.ts
import { LevelManager } from '../LevelManager';
import { LevelData, TileType, Command, Point } from '../../types/index';
import { gameEvents } from '../../core/EventBus';

// Мокаем импорт.meta.glob и динамический импорт
jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

// Мокаем глобальный import.meta.glob
(global as any).import = {
  meta: {
    glob: jest.fn(),
  },
};

describe('LevelManager', () => {
  let levelManager: LevelManager;
  const mockLevel: LevelData = {
    id: 'meadow_001',
    name: 'First Steps',
    description: 'Learn to move',
    worldId: 'meadow',
    levelNumber: 1,
    width: 5,
    height: 5,
    map: [
      [TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM],
      [TileType.PLATFORM, TileType.START, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM],
      [TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM],
      [TileType.PLATFORM, TileType.PLATFORM, TileType.GOAL, TileType.PLATFORM, TileType.PLATFORM],
      [TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM, TileType.PLATFORM],
    ],
    objects: {
      holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
      springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [], corn: [],
      cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [], clonePoints: [],
      ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
    },
    startPos: { col: 1, row: 1 },
    coinPos: { col: 2, row: 3 },
    optimalSteps: 4,
    solutions: {
      easy: { steps: 10, commands: [] },
      mid: { steps: 6, commands: [] },
      hard: { steps: 4, commands: [] },
      backdoor: null,
    },
    isTutorial: true,
    explorationPenalty: false,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    LevelManager.resetInstance();
    levelManager = LevelManager.getInstance();
    // Мокаем import.meta.glob
    const globMock = jest.fn().mockReturnValue({
      '/src/levels/meadow/001.json': () => Promise.resolve({ default: mockLevel }),
      '/src/levels/meadow/002.json': () => Promise.resolve({ default: { ...mockLevel, id: 'meadow_002', levelNumber: 2 } }),
      '/src/levels/ocean/101.json': () => Promise.resolve({ default: { ...mockLevel, id: 'ocean_101', worldId: 'ocean', levelNumber: 101 } }),
    });
    (global as any).import = {
      meta: { glob: globMock },
    };
    // Инициализируем менеджер
    await levelManager.initialize();
  });

  test('should initialize and build index', () => {
    const levelIds = levelManager.getLevelIdsForWorld('meadow');
    expect(levelIds).toHaveLength(2);
    expect(levelIds).toContain('meadow_001');
    expect(levelIds).toContain('meadow_002');
    const oceanIds = levelManager.getLevelIdsForWorld('ocean');
    expect(oceanIds).toHaveLength(1);
    expect(oceanIds[0]).toBe('ocean_101');
  });

  test('should load level by id', async () => {
    const level = await levelManager.loadLevel('meadow_001');
    expect(level).not.toBeNull();
    expect(level?.id).toBe('meadow_001');
    expect(level?.name).toBe('First Steps');
    expect(gameEvents.emit).toHaveBeenCalledWith('LEVEL_LOADED', { level: expect.objectContaining({ id: 'meadow_001' }) });
  });

  test('should cache loaded level', async () => {
    const first = await levelManager.loadLevel('meadow_001');
    const second = await levelManager.loadLevel('meadow_001');
    expect(first).toBe(second); // один и тот же объект в кэше
  });

  test('should return null for unknown level', async () => {
    const level = await levelManager.loadLevel('unknown');
    expect(level).toBeNull();
  });

  test('should get metadata', async () => {
    const meta = await levelManager.getLevelMetadata('meadow_001');
    expect(meta).not.toBeNull();
    expect(meta?.id).toBe('meadow_001');
    expect(meta?.name).toBe('First Steps'); // после загрузки имя подтянется
    expect(meta?.worldId).toBe('meadow');
  });

  test('should get next level id', async () => {
    await levelManager.loadLevel('meadow_001'); // загружаем чтобы индекс знал порядок
    const next = levelManager.getNextLevelId('meadow_001');
    expect(next).toBe('meadow_002');
  });

  test('should get previous level id', async () => {
    await levelManager.loadLevel('meadow_002');
    const prev = levelManager.getPreviousLevelId('meadow_002');
    expect(prev).toBe('meadow_001');
  });

  test('should return null for next of last level', () => {
    const next = levelManager.getNextLevelId('meadow_002');
    expect(next).toBeNull();
  });

  test('should clear cache', async () => {
    await levelManager.loadLevel('meadow_001');
    expect((levelManager as any).cache.size).toBeGreaterThan(0);
    levelManager.clearCache();
    expect((levelManager as any).cache.size).toBe(0);
  });
});
