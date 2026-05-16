import { VictoryScreen } from '../VictoryScreen';
import { progressManager } from '../../managers/ProgressManager';
import { levelManager } from '../../managers/LevelManager';
import { settingsManager } from '../../managers/SettingsManager';

jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/LevelManager');
jest.mock('../../managers/SettingsManager');

describe('VictoryScreen', () => {
  let victoryScreen: VictoryScreen;

  beforeEach(() => {
    victoryScreen = new VictoryScreen();
    victoryScreen.scene = { start: jest.fn() } as any;
    victoryScreen.cameras = { main: { width: 800, height: 600 } } as any;
    victoryScreen.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn() }),
      rectangle: jest.fn().mockReturnValue({}),
    } as any;
    victoryScreen.tweens = { add: jest.fn() } as any;
    victoryScreen.time = { delayedCall: jest.fn() } as any;
    victoryScreen.sound = { get: jest.fn().mockReturnValue({ play: jest.fn() }) } as any;
    victoryScreen.events = { once: jest.fn() } as any;
    (settingsManager.get as jest.Mock).mockReturnValue({ language: 'en', musicEnabled: true, musicVolume: 0.5 });
  });

  test('should create victory screen', () => {
    victoryScreen.init({ levelId: 'meadow_001', stars: 3, blackStar: false, stepsUsed: 5, optimalSteps: 5, explorationUsed: false });
    victoryScreen.create();
    expect(victoryScreen).toBeDefined();
  });

  test('should show black star', () => {
    victoryScreen.init({ levelId: 'meadow_001', stars: 2, blackStar: true, stepsUsed: 8, optimalSteps: 5, explorationUsed: false });
    victoryScreen.create();
    expect(victoryScreen['blackStar']).toBe(true);
  });

  test('should handle next level', () => {
    (levelManager.getNextLevelId as jest.Mock).mockReturnValue('meadow_002');
    victoryScreen.init({ levelId: 'meadow_001', stars: 3, blackStar: false, stepsUsed: 5, optimalSteps: 5, explorationUsed: false });
    victoryScreen.create();
    victoryScreen['goToNextLevel']('meadow_002');
    expect(victoryScreen.scene.start).toHaveBeenCalledWith('GameScene', { levelId: 'meadow_002' });
  });

  test('should replay level', () => {
    victoryScreen.init({ levelId: 'meadow_001', stars: 3, blackStar: false, stepsUsed: 5, optimalSteps: 5, explorationUsed: false });
    victoryScreen['replayLevel']();
    expect(victoryScreen.scene.start).toHaveBeenCalledWith('GameScene', { levelId: 'meadow_001' });
  });

  test('should go to main menu', () => {
    victoryScreen['goToMainMenu']();
    expect(victoryScreen.scene.start).toHaveBeenCalledWith('MainMenu');
  });
});
