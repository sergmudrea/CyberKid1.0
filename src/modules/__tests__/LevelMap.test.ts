// src/modules/__tests__/LevelMap.test.ts
import { LevelMap } from '../LevelMap';
import { LevelData, TileType, MonsterType, Point } from '../../types/index';
import { gameEvents } from '../../core/EventBus';

// Уникальный идентификатор для спрайтов, чтобы отслеживать создание
let spriteCounter = 0;

// Мокаем Phaser.Scene и необходимые компоненты
const mockScene = {
  add: {
    container: jest.fn().mockReturnValue({
      add: jest.fn(),
      removeAll: jest.fn(),
      destroy: jest.fn(),
    }),
    sprite: jest.fn().mockImplementation(() => ({
      id: spriteCounter++,
      setOrigin: jest.fn(),
      setDisplaySize: jest.fn(),
      setPosition: jest.fn(),
      setVisible: jest.fn(),
      setAlpha: jest.fn(),
      setTint: jest.fn(),
      clearTint: jest.fn(),
      destroy: jest.fn(),
    })),
    rectangle: jest.fn().mockReturnValue({
      setAlpha: jest.fn(),
      setOrigin: jest.fn(),
      destroy: jest.fn(),
    }),
    graphics: jest.fn().mockReturnValue({
      clear: jest.fn(),
      lineStyle: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      strokePath: jest.fn(),
      destroy: jest.fn(),
    }),
  },
  tweens: {
    killTweensOf: jest.fn(),
    add: jest.fn(),
  },
  time: {
    delayedCall: jest.fn((delay, callback) => callback()),
  },
};

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    on: jest.fn(),
    off: jest.fn(),
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
      holes: [], walls: [], bricks: [], keys: [{ col: 1, row: 1 }], doors: [], monsters: [
        { id: 'm1', type: MonsterType.PATROL, position: { col: 2, row: 2 }, direction: 'right', isTamed: false, isRidden: false }
      ], teleports: [], conveyors: [], springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
      corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [], clonePoints: [], ridePoints: [],
      bridges: [], lava: [], water: [], fakeWalls: [],
    },
    startPos: { col: 0, row: 0 },
    coinPos: { col: 4, row: 4 },
    optimalSteps: 8,
    solutions: { easy: { steps: 10, commands: [] }, mid: { steps: 8, commands: [] }, hard: { steps: 8, commands: [] }, backdoor: null },
    isTutorial: false,
    explorationPenalty: false,
  };
}

describe('LevelMap', () => {
  let levelMap: LevelMap;
  let level: LevelData;

  beforeEach(() => {
    jest.clearAllMocks();
    spriteCounter = 0;
    level = createMockLevel();
    levelMap = new LevelMap(mockScene as any, level, 32);
  });

  test('should initialize and render correct number of sprites', () => {
    const expectedTiles = level.width * level.height; // 25
    const expectedObjects = Object.values(level.objects).flat().length; // key (1) + monster (1) = 2
    const expectedPlayer = 1;
    const expectedTotal = expectedTiles + expectedObjects + expectedPlayer; // 28
    expect(mockScene.add.sprite).toHaveBeenCalledTimes(expectedTotal);
    expect(levelMap).toBeDefined();
  });

  test('should update player position with tween', () => {
    const pos: Point = { col: 2, row: 2 };
    levelMap.updatePlayerPosition(pos);
    expect(mockScene.tweens.killTweensOf).toHaveBeenCalled();
    expect(mockScene.tweens.add).toHaveBeenCalled();
  });

  test('should flash death', () => {
    levelMap.flashDeath();
    expect(mockScene.tweens.add).toHaveBeenCalled();
  });

  test('should teleport effect', () => {
    const from: Point = { col: 0, row: 0 };
    const to: Point = { col: 3, row: 3 };
    levelMap.teleportEffect(from, to);
    expect(mockScene.tweens.add).toHaveBeenCalled();
    expect(mockScene.time.delayedCall).toHaveBeenCalled();
  });

  test('should update monster position', () => {
    const monster = { id: 'm1', type: MonsterType.PATROL, position: { col: 4, row: 4 }, direction: 'right', isTamed: true, isRidden: false };
    levelMap.updateMonster(monster);
    expect(mockScene.tweens.killTweensOf).toHaveBeenCalled();
    expect(mockScene.tweens.add).toHaveBeenCalled();
  });

  test('should remove object', () => {
    const id = 'key_1_1';
    // Проверяем, что объект существует (через приватное поле, допустимо для теста)
    expect((levelMap as any).objectSprites.has(id)).toBe(true);
    levelMap.removeObject(id);
    expect((levelMap as any).objectSprites.has(id)).toBe(false);
  });

  test('should highlight cell', () => {
    levelMap.highlightCell({ col: 1, row: 1 });
    expect(mockScene.add.rectangle).toHaveBeenCalled();
    expect(mockScene.time.delayedCall).toHaveBeenCalled();
  });

  test('should toggle grid', () => {
    levelMap.toggleGrid(true);
    expect(mockScene.add.graphics).toHaveBeenCalled();
    levelMap.toggleGrid(false);
    expect((levelMap as any).gridGraphics).toBeNull();
  });

  test('should set exploration mode and change monsters alpha', () => {
    // Сначала убедимся, что монстры есть
    expect((levelMap as any).monsterSprites.size).toBe(1);
    const monsterSprite = (levelMap as any).monsterSprites.get('m1');
    monsterSprite.setAlpha = jest.fn();

    levelMap.setExplorationMode(true);
    expect(monsterSprite.setAlpha).toHaveBeenCalledWith(0.6);
    expect((levelMap as any).explorationMode).toBe(true);

    levelMap.setExplorationMode(false);
    expect(monsterSprite.setAlpha).toHaveBeenCalledWith(1);
    expect((levelMap as any).explorationMode).toBe(false);
  });

  test('should rebuild level and clean old sprites', () => {
    const newLevel = createMockLevel();
    newLevel.id = 'new';
    const container = (levelMap as any).container;
    container.removeAll = jest.fn();

    levelMap.rebuild(newLevel);
    expect(container.removeAll).toHaveBeenCalledWith(true);
    // Проверяем, что сетка пересоздаётся, если была включена
    levelMap.toggleGrid(true);
    const graphicsDestroy = jest.fn();
    if ((levelMap as any).gridGraphics) (levelMap as any).gridGraphics.destroy = graphicsDestroy;
    levelMap.rebuild(newLevel);
    expect(graphicsDestroy).toHaveBeenCalled();
  });

  test('should destroy and remove event listeners', () => {
    levelMap.destroy();
    expect(gameEvents.off).toHaveBeenCalledTimes(6);
  });
});
