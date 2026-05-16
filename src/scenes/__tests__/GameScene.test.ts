import { GameScene } from '../GameScene';
import { levelManager } from '../../managers/LevelManager';
import { saveManager } from '../../managers/SaveManager';
import { progressManager } from '../../managers/ProgressManager';
import { settingsManager } from '../../managers/SettingsManager';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../managers/LevelManager');
jest.mock('../../managers/SaveManager');
jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/SettingsManager');
jest.mock('../../core/EventBus');

describe('GameScene', () => {
  let gameScene: GameScene;

  beforeEach(() => {
    gameScene = new GameScene();
    gameScene.scene = { start: jest.fn(), restart: jest.fn() } as any;
    gameScene.cameras = { main: { width: 800, height: 600 } } as any;
    gameScene.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
      container: jest.fn().mockReturnValue({ add: jest.fn() }),
    } as any;
    gameScene.tweens = { add: jest.fn() } as any;
    gameScene.time = { delayedCall: jest.fn() } as any;
    gameScene.sound = { get: jest.fn() } as any;
    gameScene.events = { once: jest.fn() } as any;
  });

  test('should initialize and load level', async () => {
    const mockLevel = { id: 'test', name: 'Test', width: 5, height: 5, map: [], objects: { monsters: [] }, optimalSteps: 8 } as any;
    (levelManager.loadLevel as jest.Mock).mockResolvedValue(mockLevel);
    (saveManager.loadProgram as jest.Mock).mockReturnValue([]);
    (settingsManager.get as jest.Mock).mockReturnValue({ language: 'en' });
    await gameScene.init({ levelId: 'test_001' });
    await gameScene.create();
    expect(levelManager.loadLevel).toHaveBeenCalledWith('test_001');
    expect(gameScene['level']).toBe(mockLevel);
  });

  test('should handle victory', async () => {
    const mockResult = { starsEarned: 3, backdoorFound: true, stepsCount: 5 };
    gameScene['levelId'] = 'test_001';
    gameScene['level'] = { optimalSteps: 8 } as any;
    gameScene['victoryPending'] = false;
    gameScene['executionEngine'] = { stop: jest.fn() } as any;
    await gameScene['handleVictory'](mockResult as any);
    expect(progressManager.completeLevel).toHaveBeenCalledWith(
      'test_001', 3, true, 5, false, true, 8
    );
    expect(progressManager.recordBackdoorFound).toHaveBeenCalledWith('test_001', 'backdoor');
    expect(gameScene.scene.start).toHaveBeenCalledWith('VictoryScreen', expect.objectContaining({ stars: 3, blackStar: true }));
  });

  test('should handle defeat and reset', () => {
    gameScene['levelId'] = 'test_001';
    gameScene['currentProgram'] = [Command.UP];
    gameScene['handleDefeat']();
    expect(progressManager.recordDeath).toHaveBeenCalledWith('test_001', 'enemy');
    expect(saveManager.saveProgram).toHaveBeenCalledWith('test_001', [Command.UP], false);
    expect(gameScene.scene.restart).toHaveBeenCalledWith({ levelId: 'test_001' });
  });
});
