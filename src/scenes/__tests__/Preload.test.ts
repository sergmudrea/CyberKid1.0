import { Preload } from '../Preload';

// Мокаем Phaser сцену и менеджеры
jest.mock('phaser', () => {
  const actual = jest.requireActual('phaser');
  return {
    ...actual,
    Scene: class MockScene {
      add = {
        graphics: jest.fn().mockReturnValue({ fillStyle: jest.fn(), fillRect: jest.fn(), clear: jest.fn() }),
        text: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
        rectangle: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
      };
      cameras = { main: { width: 800, height: 600 } };
      time = { delayedCall: jest.fn() };
      tweens = { add: jest.fn() };
      load = {
        on: jest.fn(),
        image: jest.fn(),
        spritesheet: jest.fn(),
        audio: jest.fn(),
        script: jest.fn(),
      };
      textures = { exists: jest.fn().mockReturnValue(false), addImage: jest.fn() };
      sound = { add: jest.fn() };
      anims = { exists: jest.fn().mockReturnValue(false), create: jest.fn(), generateFrameNumbers: jest.fn() };
      scene = { start: jest.fn() };
    },
  };
});

jest.mock('../../managers/SettingsManager', () => ({
  settingsManager: { get: jest.fn().mockReturnValue({ language: 'en' }) },
}));
jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/SaveManager');
jest.mock('../../managers/LevelManager', () => ({
  levelManager: { initialize: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../managers/UnlockManager', () => ({
  unlockManager: { initialize: jest.fn().mockResolvedValue(undefined) },
}));

describe('Preload Scene', () => {
  let preload: Preload;

  beforeEach(() => {
    preload = new Preload();
    preload.init = jest.fn();
    preload.preload = jest.fn();
    preload.create = jest.fn();
  });

  test('should initialize', () => {
    expect(preload).toBeDefined();
  });

  test('should inject CSS', () => {
    preload['injectCSS']();
    expect(document.getElementById('cyberkid-styles')).toBeTruthy();
  });

  test('should load tips', () => {
    preload['loadTips']();
    expect(preload['tips'].length).toBeGreaterThan(0);
  });
});
