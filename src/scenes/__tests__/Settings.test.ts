import { Settings } from '../Settings';
import { settingsManager } from '../../managers/SettingsManager';
import { progressManager } from '../../managers/ProgressManager';
import { saveManager } from '../../managers/SaveManager';
import { levelManager } from '../../managers/LevelManager';
import { LearningMode } from '../../types/index';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../managers/SettingsManager');
jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/SaveManager');
jest.mock('../../managers/LevelManager');
jest.mock('../../core/EventBus');

describe('Settings Scene', () => {
  let settingsScene: Settings;

  beforeEach(() => {
    settingsScene = new Settings();
    settingsScene.scene = { start: jest.fn() } as any;
    settingsScene.cameras = { main: { width: 800, height: 600 } } as any;
    settingsScene.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setColor: jest.fn(), setBackgroundColor: jest.fn(), setText: jest.fn() }),
      container: jest.fn().mockReturnValue({ removeAll: jest.fn(), add: jest.fn() }),
    } as any;
    (settingsManager.get as jest.Mock).mockReturnValue({
      language: 'en',
      learningMode: LearningMode.SCHOLAR,
      soundEnabled: true,
      soundVolume: 0.7,
      musicEnabled: true,
      musicVolume: 0.5,
      showTutorials: true,
      autoHints: true,
      vibrationEnabled: true,
      developerMode: false,
    });
    settingsScene.events = { once: jest.fn() };
    settingsScene.create();
  });

  test('should create settings screen', () => {
    expect(settingsScene).toBeDefined();
  });

  test('should switch tabs', () => {
    const gameTab = settingsScene['tabButtons'].get('audio');
    gameTab?.emit('pointerdown');
    expect(settingsScene['currentTab']).toBe('audio');
  });

  test('should export progress', () => {
    (progressManager.exportProgress as jest.Mock).mockReturnValue('{}');
    const mockClick = jest.fn();
    const mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const mockRevoke = jest.spyOn(URL, 'revokeObjectURL');
    settingsScene['exportProgress']();
    expect(mockCreateObjectURL).toHaveBeenCalled();
    mockRevoke.mockRestore();
  });

  test('should reset all data', () => {
    global.confirm = jest.fn(() => true);
    settingsScene['resetAllData']();
    expect(progressManager.resetAll).toHaveBeenCalled();
    expect(saveManager.resetAllData).toHaveBeenCalled();
    expect(settingsManager.reset).toHaveBeenCalled();
    expect(levelManager.clearCache).toHaveBeenCalled();
    expect(settingsScene.scene.start).toHaveBeenCalledWith('MainMenu');
  });

  test('should clear level cache', () => {
    settingsScene['clearLevelCache']();
    expect(levelManager.clearCache).toHaveBeenCalled();
  });

  test('should enable event debug only in dev mode', () => {
    (settingsManager.get as jest.Mock).mockReturnValue({ developerMode: true });
    settingsScene['enableEventDebug']();
    expect(gameEvents.setDebug).toHaveBeenCalledWith(true);
  });
});
