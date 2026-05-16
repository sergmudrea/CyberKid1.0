// src/modules/__tests__/HintSystem.test.ts
import { HintSystem } from '../HintSystem';
import { LevelData, TileType, MonsterType, Command, LearningMode } from '../../types/index';
import { gameEvents } from '../../core/EventBus';
import { settingsManager } from '../../managers/SettingsManager';

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../managers/SettingsManager', () => ({
  settingsManager: {
    get: jest.fn().mockReturnValue({ language: 'en', learningMode: LearningMode.SCHOLAR, autoHints: true }),
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
      holes: [], walls: [], bricks: [], keys: [{ col: 2, row: 2 }], doors: [], monsters: [], teleports: [], conveyors: [],
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

describe('HintSystem', () => {
  let level: LevelData;
  let hintSystem: HintSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    level = createMockLevel();
    hintSystem = new HintSystem(level);
  });

  afterEach(() => {
    hintSystem.destroy();
    jest.useRealTimers();
  });

  test('should initialize', () => {
    expect(hintSystem).toBeDefined();
  });

  test('should reset timer on updateState', () => {
    const resetSpy = jest.spyOn(hintSystem, 'resetTimer');
    hintSystem.updateState({ col: 1, row: 0 }, 'right', { keys: [], corn: 0, cores: 0, hasDrill: false, hasHook: false, hasWing: false, hasBait: false, tools: [] }, []);
    expect(resetSpy).toHaveBeenCalled();
  });

  test('should show encouragement hint after 15 seconds', () => {
    jest.advanceTimersByTime(16000);
    expect(gameEvents.emit).toHaveBeenCalledWith('HINT_SHOWN', expect.objectContaining({ tier: 1 }));
  });

  test('should show direction hint after 30 seconds', () => {
    jest.advanceTimersByTime(31000);
    expect(gameEvents.emit).toHaveBeenCalledWith('HINT_SHOWN', expect.objectContaining({ tier: 2 }));
  });

  test('should show mechanic hint after 60 seconds', () => {
    jest.advanceTimersByTime(61000);
    expect(gameEvents.emit).toHaveBeenCalledWith('HINT_SHOWN', expect.objectContaining({ tier: 3 }));
  });

  test('should show level specific hint after 90 seconds', () => {
    jest.advanceTimersByTime(91000);
    expect(gameEvents.emit).toHaveBeenCalledWith('HINT_SHOWN', expect.objectContaining({ tier: 4 }));
  });

  test('should show solution hint after 120 seconds', () => {
    jest.advanceTimersByTime(121000);
    expect(gameEvents.emit).toHaveBeenCalledWith('HINT_SHOWN', expect.objectContaining({ tier: 5 }));
  });

  test('should return manual hint', () => {
    const hint = hintSystem.getManualHint();
    expect(hint).toBeDefined();
    expect(hint.text).toBeTruthy();
  });

  test('should respect disabled state', () => {
    hintSystem.setActive(false);
    jest.advanceTimersByTime(16000);
    // Должен быть вызван только если active = true, но у нас active = false
    // Проверим, что не было вызова HINT_SHOWN (или был только от предыдущих тестов? Очистим)
    jest.clearAllMocks();
    jest.advanceTimersByTime(16000);
    expect(gameEvents.emit).not.toHaveBeenCalled();
  });
});
