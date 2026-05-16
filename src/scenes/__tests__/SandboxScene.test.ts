import { SandboxScene } from '../SandboxScene';
import { SandboxMaker } from '../../modules/SandboxMaker';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../modules/SandboxMaker');
jest.mock('../../core/EventBus');

describe('SandboxScene', () => {
  let sandboxScene: SandboxScene;

  beforeEach(() => {
    sandboxScene = new SandboxScene();
    sandboxScene.scene = { start: jest.fn() } as any;
    sandboxScene.cameras = { main: { width: 800, height: 600 } } as any;
    sandboxScene.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setInteractive: jest.fn(), on: jest.fn(), setColor: jest.fn() }),
    } as any;
    sandboxScene.create();
  });

  test('should create sandbox scene', () => {
    expect(sandboxScene).toBeDefined();
    expect(SandboxMaker).toHaveBeenCalled();
  });

  test('should start test mode on SANDBOX_LEVEL_SAVED', () => {
    const mockLevel = { id: 'test', name: 'Test' };
    const callback = (gameEvents.on as jest.Mock).mock.calls.find(call => call[0] === 'SANDBOX_LEVEL_SAVED')?.[1];
    if (callback) callback({ levelData: mockLevel });
    expect(sessionStorage.getItem('test_level')).toBe(JSON.stringify(mockLevel));
    expect(sandboxScene.scene.start).toHaveBeenCalledWith('GameScene', { levelId: 'test_level' });
  });
});
