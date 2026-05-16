import { MainMenu } from '../MainMenu';
import { progressManager } from '../../managers/ProgressManager';
import { settingsManager } from '../../managers/SettingsManager';
import { saveManager } from '../../managers/SaveManager';

jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/SettingsManager');
jest.mock('../../managers/SaveManager');

describe('MainMenu Scene', () => {
  let mainMenu: MainMenu;

  beforeEach(() => {
    mainMenu = new MainMenu();
    mainMenu.scene = { start: jest.fn() } as any;
    mainMenu.cameras = { main: { width: 800, height: 600 } } as any;
    mainMenu.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      circle: jest.fn().mockReturnValue({}),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setColor: jest.fn(), setText: jest.fn() }),
      rectangle: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn() }),
    } as any;
    mainMenu.tweens = { add: jest.fn() } as any;
    mainMenu.time = { delayedCall: jest.fn() } as any;
    mainMenu.sound = { get: jest.fn().mockReturnValue({ play: jest.fn() }) } as any;
  });

  test('should create menu', () => {
    expect(() => mainMenu.create()).not.toThrow();
  });

  test('continue game loads session and extracts level number', () => {
    (saveManager.loadSessionState as jest.Mock).mockReturnValue({ currentWorldId: 'ocean', currentLevelId: 'ocean_101' });
    mainMenu.continueGame();
    expect(mainMenu.scene.start).toHaveBeenCalledWith('LevelSelect', { worldId: 'ocean', levelNum: 101 });
  });

  test('continue game fallback to meadow if no session', () => {
    (saveManager.loadSessionState as jest.Mock).mockReturnValue(null);
    mainMenu.continueGame();
    expect(mainMenu.scene.start).toHaveBeenCalledWith('LevelSelect', { worldId: 'meadow', levelNum: 1 });
  });

  test('new game resets progress', () => {
    global.confirm = jest.fn(() => true);
    mainMenu.newGame();
    expect(progressManager.resetAll).toHaveBeenCalled();
    expect(saveManager.resetAllData).toHaveBeenCalled();
    expect(mainMenu.scene.start).toHaveBeenCalledWith('LevelSelect', { worldId: 'meadow', levelNum: 1 });
  });

  test('new game cancels if declined', () => {
    global.confirm = jest.fn(() => false);
    mainMenu.newGame();
    expect(progressManager.resetAll).not.toHaveBeenCalled();
  });

  test('version click enables developer mode', () => {
    mainMenu['versionText'] = { setText: jest.fn(), setColor: jest.fn() } as any;
    for (let i = 0; i < 5; i++) mainMenu['onVersionClick']();
    expect(settingsManager.set).toHaveBeenCalledWith('developerMode', true);
  });
});
