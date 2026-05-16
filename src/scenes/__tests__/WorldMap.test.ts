import { WorldMap } from '../WorldMap';
import { progressManager } from '../../managers/ProgressManager';
import { levelManager } from '../../managers/LevelManager';
import { unlockManager } from '../../managers/UnlockManager';
import { settingsManager } from '../../managers/SettingsManager';

jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/LevelManager');
jest.mock('../../managers/UnlockManager');
jest.mock('../../managers/SettingsManager');

describe('WorldMap Scene', () => {
  let worldMap: WorldMap;

  beforeEach(() => {
    (levelManager.getLevelIdsForWorld as jest.Mock).mockReturnValue(['meadow_001', 'meadow_002']);
    (progressManager.get as jest.Mock).mockReturnValue({
      levelStats: {
        meadow_001: { stars: 3 },
        meadow_002: { stars: 2 },
      },
    });
    (settingsManager.get as jest.Mock).mockReturnValue({ language: 'en', musicEnabled: false });

    worldMap = new WorldMap();
    worldMap.scene = { start: jest.fn() } as any;
    worldMap.cameras = { main: { width: 800, height: 600 } } as any;
    worldMap.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn(), clear: jest.fn(), lineStyle: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), strokePath: jest.fn() }),
      circle: jest.fn().mockReturnValue({ setStrokeStyle: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setScale: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setText: jest.fn() }),
      container: jest.fn().mockReturnValue({ add: jest.fn() }),
      rectangle: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setStrokeStyle: jest.fn() }),
      group: jest.fn().mockReturnValue({ add: jest.fn() }),
    } as any;
    worldMap.tweens = { add: jest.fn() } as any;
    worldMap.sound = { get: jest.fn().mockReturnValue({ play: jest.fn() }) } as any;
    worldMap.time = { delayedCall: jest.fn() } as any;
  });

  test('should create world map', () => {
    expect(() => worldMap.create()).not.toThrow();
  });

  test('should compute stars for world correctly', () => {
    const stars = worldMap['computeStarsForWorld']('meadow');
    expect(stars).toBe(5);
  });

  test('should start world when unlocked', () => {
    worldMap['startWorld']('meadow');
    expect(worldMap.scene.start).toHaveBeenCalledWith('LevelSelect', { worldId: 'meadow', levelNum: 1 });
  });

  test('should open paywall for locked world', () => {
    const world = { id: 'ocean', isLocked: true, priceSku: 'world_ocean', name: 'Ocean', icon: '🌊', color: 0x3a6ea5, starsEarned: 0, starsTotal: 1500, x: 100, y: 100, angle: 0, levelsCount: 500 };
    worldMap['selectWorld'](world);
    expect(worldMap.scene.start).toHaveBeenCalledWith('Paywall', { worldId: 'ocean', sku: 'world_ocean' });
  });

  test('should update world stars on progress update', () => {
    worldMap['updateWorldStars'] = jest.fn();
    worldMap['setupEventListeners']();
    // Вызываем событие вручную (имитация)
    const callback = (eventBus.on as jest.Mock).mock.calls.find(call => call[0] === 'PROGRESS_UPDATED')?.[1];
    if (callback) callback();
    expect(worldMap['updateWorldStars']).toHaveBeenCalled();
  });
});
