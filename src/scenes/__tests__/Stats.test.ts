import { Stats } from '../Stats';
import { progressManager } from '../../managers/ProgressManager';
import { levelManager } from '../../managers/LevelManager';
import { settingsManager } from '../../managers/SettingsManager';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/LevelManager');
jest.mock('../../managers/SettingsManager');
jest.mock('../../core/EventBus');

describe('Stats Scene', () => {
  let statsScene: Stats;

  beforeEach(() => {
    statsScene = new Stats();
    statsScene.scene = { start: jest.fn() } as any;
    statsScene.cameras = { main: { width: 800, height: 600 } } as any;
    statsScene.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setColor: jest.fn(), setBackgroundColor: jest.fn(), setText: jest.fn() }),
      container: jest.fn().mockReturnValue({ removeAll: jest.fn(), add: jest.fn() }),
    } as any;
    (settingsManager.get as jest.Mock).mockReturnValue({ language: 'en' });
    (progressManager.get as jest.Mock).mockReturnValue({
      totalStars: 42,
      totalBlackStars: 3,
      levelsCompleted: ['a', 'b'],
      perfectLevels: ['a'],
      totalAttempts: 100,
      totalDeaths: 10,
      explorationUsedCount: 2,
      backdoorsFound: 1,
      totalPlayTimeSec: 3600,
      achievements: [],
    });
    (levelManager.getLevelIdsForWorld as jest.Mock).mockReturnValue(['meadow_001']);
    statsScene.events = { once: jest.fn() };
    statsScene.create();
  });

  test('should create stats screen', () => {
    expect(statsScene).toBeDefined();
  });

  test('should switch tabs', () => {
    const worldsTab = statsScene['tabButtons'].get('worlds');
    worldsTab?.emit('pointerdown');
    expect(statsScene['currentTab']).toBe('worlds');
  });

  test('should share stats (copy fallback)', () => {
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText }, share: undefined });
    statsScene['shareStats']();
    expect(mockWriteText).toHaveBeenCalled();
  });
});
