// src/modules/__tests__/ExplorationMode.test.ts
import { ExplorationMode } from '../ExplorationMode';
import { Point, Monster, MonsterType, Inventory } from '../../types/index';
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
    get: jest.fn().mockReturnValue({ language: 'en' }),
  },
}));

// Моки для Player и LevelMap
class MockPlayer {
  setGhostMode = jest.fn();
}
class MockLevelMap {
  setExplorationMode = jest.fn();
}

describe('ExplorationMode', () => {
  let exploration: ExplorationMode;
  let mockPlayer: MockPlayer;
  let mockLevelMap: MockLevelMap;
  const mockPos: Point = { col: 2, row: 2 };
  const mockDir: 'up' | 'down' | 'left' | 'right' = 'right';
  const mockInventory: Inventory = {
    keys: ['key1'],
    corn: 1,
    cores: 0,
    hasDrill: false,
    hasHook: false,
    hasWing: false,
    hasBait: false,
    tools: [],
  };
  const mockMonsters: Monster[] = [
    { id: 'm1', type: MonsterType.PATROL, position: { col: 3, row: 2 }, direction: 'left', isTamed: false, isRidden: false },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer = new MockPlayer();
    mockLevelMap = new MockLevelMap();
    exploration = new ExplorationMode();
    exploration.setPlayer(mockPlayer as any);
    exploration.setLevelMap(mockLevelMap as any);
    exploration.setLevel('test_level');
    // Мокаем confirm
    global.confirm = jest.fn(() => true);
  });

  test('should activate exploration mode', () => {
    const result = exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    expect(result).toBe(true);
    expect(exploration.isActive()).toBe(true);
    expect(exploration.wasUsed()).toBe(true);
    expect(mockPlayer.setGhostMode).toHaveBeenCalledWith(true);
    expect(mockLevelMap.setExplorationMode).toHaveBeenCalledWith(true);
    expect(gameEvents.emit).toHaveBeenCalledWith('EXPLORATION_TOGGLED', { enabled: true, penaltyWarningShown: true });
  });

  test('should show warning only once per level', () => {
    exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    exploration.deactivate();
    exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    expect(global.confirm).toHaveBeenCalledTimes(1);
  });

  test('should cancel activation if user declines warning', () => {
    (global.confirm as jest.Mock).mockReturnValueOnce(false);
    const result = exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    expect(result).toBe(false);
    expect(exploration.isActive()).toBe(false);
    expect(mockPlayer.setGhostMode).not.toHaveBeenCalled();
  });

  test('should deactivate and return snapshot with explorationUsed flag', () => {
    exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    const result = exploration.deactivate();
    expect(result).not.toBeNull();
    expect(result?.snapshot.playerPos).toEqual(mockPos);
    expect(result?.snapshot.playerDir).toBe(mockDir);
    expect(result?.snapshot.inventory).toEqual(mockInventory);
    expect(result?.snapshot.monsters).toHaveLength(1);
    expect(result?.explorationUsed).toBe(true);
    expect(exploration.isActive()).toBe(false);
    expect(mockPlayer.setGhostMode).toHaveBeenCalledWith(false);
    expect(mockLevelMap.setExplorationMode).toHaveBeenCalledWith(false);
    expect(gameEvents.emit).toHaveBeenCalledWith('EXPLORATION_TOGGLED', { enabled: false, penaltyWarningShown: false });
  });

  test('should force disable', () => {
    exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    exploration.forceDisable();
    expect(exploration.isActive()).toBe(false);
    expect(mockPlayer.setGhostMode).toHaveBeenCalledWith(false);
  });

  test('should handle toggle callback', () => {
    const callback = jest.fn();
    exploration.onToggle(callback);
    exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    expect(callback).toHaveBeenCalledWith(true);
    exploration.deactivate();
    expect(callback).toHaveBeenCalledWith(false);
  });

  test('should reset level-specific state on setLevel', () => {
    exploration.activate(mockPos, mockDir, mockInventory, mockMonsters);
    exploration.setLevel('new_level');
    expect((exploration as any).warningShown).toBe(false);
    expect((exploration as any).wasUsedDuringLevel).toBe(false);
  });
});
