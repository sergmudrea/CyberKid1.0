// tests/integration/level-flow.test.ts
// ПРОМЕТЕЙ: Полный интеграционный тест, проверяющий сценарий прохождения уровня
// от загрузки через LevelManager до сохранения прогресса через ProgressManager.
// Использует реальную GameScene с замоканными зависимостями.

import { LevelManager } from '../../src/managers/LevelManager';
import { ProgressManager } from '../../src/managers/ProgressManager';
import { SaveManager } from '../../src/managers/SaveManager';
import { SettingsManager } from '../../src/managers/SettingsManager';
import { GameScene } from '../../src/scenes/GameScene';
import { LevelData, Command, TileType } from '../../src/types/index';
import { gameEvents } from '../../src/core/EventBus';

// Мокаем всех менеджеров и EventBus
jest.mock('../../src/managers/LevelManager');
jest.mock('../../src/managers/ProgressManager');
jest.mock('../../src/managers/SaveManager');
jest.mock('../../src/managers/SettingsManager');
jest.mock('../../src/core/EventBus');

// Мокаем Phaser (минимально, чтобы GameScene могла создаваться)
jest.mock('phaser', () => {
  const actual = jest.requireActual('phaser');
  return {
    ...actual,
    Scene: class MockScene {
      add = {
        graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
        text: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
        sprite: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setDisplaySize: jest.fn() }),
        rectangle: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
        container: jest.fn().mockReturnValue({ add: jest.fn() }),
      };
      cameras = { main: { width: 800, height: 600 } };
      tweens = { add: jest.fn() };
      time = { delayedCall: jest.fn() };
      scene = { start: jest.fn(), restart: jest.fn() };
      sound = { get: jest.fn().mockReturnValue({ play: jest.fn() }) };
      events = { once: jest.fn(), off: jest.fn() };
      input = { keyboard: { on: jest.fn() } };
    },
  };
});

describe('Integration: Full Level Flow (GameScene + ExecutionEngine + ProgressManager)', () => {
  let mockLevel: LevelData;
  let levelManagerMock: jest.Mocked<LevelManager>;
  let progressManagerMock: jest.Mocked<ProgressManager>;
  let saveManagerMock: jest.Mocked<SaveManager>;
  let settingsManagerMock: jest.Mocked<SettingsManager>;
  let gameScene: GameScene;

  beforeAll(() => {
    // Создаём тестовый уровень 5x5
    const width = 5, height = 5;
    const map: TileType[][] = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
    map[0][0] = TileType.START;
    map[4][4] = TileType.GOAL;
    mockLevel = {
      id: 'meadow_001',
      name: 'Test Level',
      description: '',
      worldId: 'meadow',
      levelNumber: 1,
      width,
      height,
      map,
      objects: {
        holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
        springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
        corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
        clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
      },
      startPos: { col: 0, row: 0 },
      coinPos: { col: 4, row: 4 },
      optimalSteps: 8,
      solutions: {
        easy: { steps: 12, commands: [] },
        mid: { steps: 10, commands: [] },
        hard: { steps: 8, commands: [] },
        backdoor: null,
      },
      isTutorial: true,
      explorationPenalty: false,
    };
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Настраиваем моки менеджеров
    levelManagerMock = LevelManager.getInstance() as jest.Mocked<LevelManager>;
    progressManagerMock = ProgressManager.getInstance() as jest.Mocked<ProgressManager>;
    saveManagerMock = SaveManager.getInstance() as jest.Mocked<SaveManager>;
    settingsManagerMock = SettingsManager.getInstance() as jest.Mocked<SettingsManager>;

    levelManagerMock.loadLevel.mockResolvedValue(mockLevel);
    levelManagerMock.getLevelIdsForWorld.mockReturnValue(['meadow_001']);
    progressManagerMock.getLevelStats.mockReturnValue(undefined);
    saveManagerMock.loadProgram.mockReturnValue(null);
    saveManagerMock.hasSavedProgram.mockReturnValue(false);
    settingsManagerMock.get.mockReturnValue({
      learningMode: 'scholar' as any,
      language: 'en',
      soundEnabled: true,
      musicEnabled: true,
      soundVolume: 0.7,
      musicVolume: 0.5,
      vibrationEnabled: true,
      showTutorials: true,
      autoHints: false,
      developerMode: false,
    });

    // Создаём экземпляр GameScene и инициализируем
    gameScene = new GameScene();
    // Мокаем методы Phaser-сцены
    (gameScene as any).scene = { start: jest.fn(), restart: jest.fn() };
    (gameScene as any).cameras = { main: { width: 800, height: 600 } };
    (gameScene as any).add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
      sprite: jest.fn().mockReturnValue({ setOrigin: jest.fn(), setDisplaySize: jest.fn() }),
      rectangle: jest.fn().mockReturnValue({ setOrigin: jest.fn() }),
      container: jest.fn().mockReturnValue({ add: jest.fn() }),
    };
    (gameScene as any).tweens = { add: jest.fn() };
    (gameScene as any).time = { delayedCall: jest.fn() };
    (gameScene as any).sound = { get: jest.fn().mockReturnValue({ play: jest.fn() }) };
    (gameScene as any).events = { once: jest.fn(), off: jest.fn() };
    (gameScene as any).input = { keyboard: { on: jest.fn() } };

    await gameScene.init({ levelId: 'meadow_001' });
    await gameScene.create();
  });

  test('Full cycle: complete level optimally -> progress saved with 3 stars', async () => {
    // Устанавливаем программу (4 вправо, 4 вниз)
    const optimalProgram: Command[] = [
      Command.RIGHT, Command.RIGHT, Command.RIGHT, Command.RIGHT,
      Command.DOWN, Command.DOWN, Command.DOWN, Command.DOWN,
    ];
    (gameScene as any).currentProgram = optimalProgram;
    (gameScene as any).commandPanel?.loadProgram('meadow_001', optimalProgram);

    // Запускаем выполнение (имитируем нажатие кнопки Run)
    await (gameScene as any).executionEngine.loadProgram(optimalProgram);
    await (gameScene as any).executionEngine.start();

    // Проверяем, что обработчик победы вызвал completeLevel с правильными параметрами
    expect(progressManagerMock.completeLevel).toHaveBeenCalledTimes(1);
    expect(progressManagerMock.completeLevel).toHaveBeenCalledWith(
      'meadow_001',
      3,      // stars
      false,  // blackStar
      8,      // stepsUsed
      false,  // explorationUsed
      false,  // backdoorUsed
      8       // optimalSteps
    );

    // Проверяем, что VictoryScreen запущена
    expect(gameScene.scene.start).toHaveBeenCalledWith(
      'VictoryScreen',
      expect.objectContaining({
        levelId: 'meadow_001',
        stars: 3,
        stepsUsed: 8,
      })
    );
  });

  test('Full cycle: use Exploration Mode -> max 2 stars', async () => {
    // Активируем Exploration Mode через GameScene (имитируем нажатие P)
    const exploration = (gameScene as any).explorationMode;
    exploration?.activate(
      (gameScene as any).player.getPosition(),
      (gameScene as any).player.getDirection(),
      (gameScene as any).player.getInventory(),
      mockLevel.objects.monsters
    );

    const program: Command[] = [
      Command.RIGHT, Command.RIGHT, Command.RIGHT, Command.RIGHT,
      Command.DOWN, Command.DOWN, Command.DOWN, Command.DOWN,
    ];
    (gameScene as any).currentProgram = program;
    await (gameScene as any).executionEngine.loadProgram(program);
    await (gameScene as any).executionEngine.start();

    expect(progressManagerMock.completeLevel).toHaveBeenCalledWith(
      'meadow_001',
      2,      // stars (ограничено из-за Exploration Mode)
      false,
      8,
      true,   // explorationUsed
      false,
      8
    );
  });

  test('Full cycle: player dies -> defeat, no progress saved, level restarts', async () => {
    // Устанавливаем яму на пути
    mockLevel.map[1][0] = TileType.HOLE;
    // Перезагружаем сцену с изменённым уровнем (упрощённо – меняем напрямую)
    (gameScene as any).level = mockLevel;
    (gameScene as any).levelMap?.rebuild(mockLevel);

    const program: Command[] = [Command.DOWN];
    (gameScene as any).currentProgram = program;
    await (gameScene as any).executionEngine.loadProgram(program);
    await (gameScene as any).executionEngine.start();

    // Прогресс не должен быть сохранён
    expect(progressManagerMock.completeLevel).not.toHaveBeenCalled();
    // Должен быть вызван recordDeath
    expect(progressManagerMock.recordDeath).toHaveBeenCalledWith('meadow_001', 'enemy');
    // Сцена должна быть перезапущена (или показано сообщение, затем рестарт)
    expect(gameScene.scene.restart).toHaveBeenCalledWith({ levelId: 'meadow_001' });
  });

  test('Full cycle: use drill backdoor -> black star', async () => {
    // Ставим стену на пути и даём дрель
    mockLevel.map[0][1] = TileType.WALL;
    (gameScene as any).level = mockLevel;
    (gameScene as any).levelMap?.rebuild(mockLevel);

    const player = (gameScene as any).player;
    player.addTool('drill');

    const program: Command[] = [Command.DRILL, Command.RIGHT];
    (gameScene as any).currentProgram = program;
    await (gameScene as any).executionEngine.loadProgram(program);
    await (gameScene as any).executionEngine.start();

    expect(progressManagerMock.completeLevel).toHaveBeenCalledWith(
      'meadow_001',
      3,      // звёзды (при оптимальном пути через стену)
      true,   // blackStar
      2,      // шаги: DRILL + RIGHT
      false,
      true,   // backdoorUsed
      8
    );
  });
});
