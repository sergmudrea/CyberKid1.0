// tests/integration/level-flow.test.ts (исправленный, полный)
import { LevelManager } from '../../src/managers/LevelManager';
import { ProgressManager } from '../../src/managers/ProgressManager';
import { SaveManager } from '../../src/managers/SaveManager';
import { SettingsManager } from '../../src/managers/SettingsManager';
import { GameScene } from '../../src/scenes/GameScene';
import { LevelData, Command, TileType } from '../../src/types/index';
import { gameEvents } from '../../src/core/EventBus';

jest.mock('../../src/managers/LevelManager');
jest.mock('../../src/managers/ProgressManager');
jest.mock('../../src/managers/SaveManager');
jest.mock('../../src/managers/SettingsManager');
jest.mock('../../src/core/EventBus');
jest.mock('phaser', () => ({
  Scene: class MockScene {},
  GameObjects: { Container: class {} },
}));

describe('Integration: Full Level Flow (GameScene + ExecutionEngine + ProgressManager)', () => {
  let mockLevel: LevelData;
  let gameScene: GameScene;
  let progressManagerMock: jest.Mocked<ProgressManager>;

  beforeEach(async () => {
    // Создаём тестовый уровень
    mockLevel = { /* ... как в предыдущем тесте ... */ };
    (LevelManager.getInstance().loadLevel as jest.Mock).mockResolvedValue(mockLevel);
    progressManagerMock = ProgressManager.getInstance() as jest.Mocked<ProgressManager>;
    (SaveManager.getInstance().loadProgram as jest.Mock).mockReturnValue(null);
    (SettingsManager.getInstance().get as jest.Mock).mockReturnValue({ language: 'en', autoHints: false });

    // Создаём GameScene с минимальными моками
    gameScene = new GameScene();
    gameScene.scene = { start: jest.fn(), restart: jest.fn() } as any;
    gameScene.cameras = { main: { width: 800, height: 600 } } as any;
    gameScene.add = { graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }) } as any;
    gameScene.tweens = { add: jest.fn() } as any;
    gameScene.time = { delayedCall: jest.fn() } as any;

    await gameScene.init({ levelId: 'meadow_001' });
    await gameScene.create();
  });

  test('Full cycle: complete level -> progress saved with 3 stars', async () => {
    // Устанавливаем программу через CommandPanel (упрощённо – напрямую поле)
    (gameScene as any).currentProgram = [
      Command.RIGHT, Command.RIGHT, Command.RIGHT, Command.RIGHT,
      Command.DOWN, Command.DOWN, Command.DOWN, Command.DOWN,
    ];
    // Запускаем выполнение
    (gameScene as any).executionEngine.loadProgram((gameScene as any).currentProgram);
    await (gameScene as any).executionEngine.start();

    // После победы GameScene вызывает handleVictory, а та – progressManager.completeLevel
    expect(progressManagerMock.completeLevel).toHaveBeenCalledWith(
      'meadow_001',
      3,      // stars
      false,  // blackStar
      8,      // stepsUsed
      false,  // explorationUsed
      false,  // backdoorUsed
      8       // optimalSteps
    );
  });
});
