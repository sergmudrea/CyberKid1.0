import { ArcadeBrowser } from '../ArcadeBrowser';
import { settingsManager } from '../../managers/SettingsManager';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../managers/SettingsManager');
jest.mock('../../core/EventBus');

describe('ArcadeBrowser', () => {
  let browser: ArcadeBrowser;

  beforeEach(() => {
    browser = new ArcadeBrowser();
    browser.scene = { start: jest.fn() } as any;
    browser.cameras = { main: { width: 800, height: 600 } } as any;
    browser.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setColor: jest.fn(), setBackgroundColor: jest.fn() }),
      rectangle: jest.fn().mockReturnValue({ setStrokeStyle: jest.fn() }),
      container: jest.fn().mockReturnValue({ add: jest.fn() }),
    } as any;
    (settingsManager.get as jest.Mock).mockReturnValue({ language: 'en' });
    browser.input = { keyboard: { on: jest.fn() } } as any;
    browser.events = { once: jest.fn() };
    browser.create();
  });

  test('should create arcade browser', () => {
    expect(browser).toBeDefined();
  });

  test('should switch tabs', () => {
    const newTab = browser['tabButtons'].get('top');
    newTab?.emit('pointerdown');
    expect(browser['currentTab']).toBe('top');
  });

  test('should play level', () => {
    const mockLevel = { id: 'test', title: 'Test', levelData: { id: 'test' } } as any;
    browser['playLevel'](mockLevel);
    expect(sessionStorage.getItem('arcade_level')).toBe(JSON.stringify(mockLevel.levelData));
    expect(browser.scene.start).toHaveBeenCalledWith('GameScene', { levelId: 'arcade_test' });
  });
});
