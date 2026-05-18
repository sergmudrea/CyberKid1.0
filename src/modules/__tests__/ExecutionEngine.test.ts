// src/modules/__tests__/ExecutionEngine.test.ts (расширенный)
// ПРОМЕТЕЙ: Полные тесты для ExecutionEngine, включая функции, ООП, клоны, циклы, условия, взаимодействия.

import { ExecutionEngine } from '../ExecutionEngine';
import { LevelData, TileType, Command, MonsterType, Point } from '../../types/index';
import { Player } from '../Player';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
  },
}));

function createMockLevel(): LevelData {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    worldId: 'meadow',
    levelNumber: 1,
    width: 7,
    height: 7,
    map: Array(7).fill(null).map(() => Array(7).fill(TileType.PLATFORM)),
    objects: {
      holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
      springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
      corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
      clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
    },
    startPos: { col: 0, row: 0 },
    coinPos: { col: 6, row: 6 },
    optimalSteps: 12,
    solutions: { easy: { steps: 20, commands: [] }, mid: { steps: 15, commands: [] }, hard: { steps: 12, commands: [] }, backdoor: null },
    isTutorial: false,
    explorationPenalty: false,
  };
}

function mockTileGetter(col: number, row: number): number {
  return 0;
}

describe('ExecutionEngine (расширенный)', () => {
  let level: LevelData;
  let player: Player;
  let engine: ExecutionEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    level = createMockLevel();
    player = new Player(level.startPos, 'right', level.width, level.height, mockTileGetter);
    engine = new ExecutionEngine(level, player);
  });

  // 1. Движение и победа
  test('should move and detect victory', async () => {
    level.coinPos = { col: 2, row: 0 };
    const commands = [Command.RIGHT, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition()).toEqual({ col: 2, row: 0 });
    expect(gameEvents.emit).toHaveBeenCalledWith('EXECUTION_FINISHED', expect.objectContaining({ success: true }));
  });

  // 2. Стена блокирует
  test('should not die when hitting a wall', async () => {
    level.map[0][1] = TileType.WALL;
    const commands = [Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.isPlayerAlive()).toBe(true);
    expect(player.getPosition()).toEqual({ col: 0, row: 0 });
  });

  // 3. Смерть в яме
  test('should die when stepping into a hole', async () => {
    level.map[0][1] = TileType.HOLE;
    const commands = [Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.isPlayerAlive()).toBe(false);
    expect(gameEvents.emit).toHaveBeenCalledWith('EXECUTION_FINISHED', expect.objectContaining({ success: false }));
  });

  // 4. WAIT команда
  test('should handle WAIT command', async () => {
    jest.useFakeTimers();
    const commands = [Command.WAIT, Command.RIGHT];
    engine.loadProgram(commands);
    const promise = engine.start();
    jest.advanceTimersByTime(1000);
    await promise;
    expect(player.getPosition().col).toBe(1);
    jest.useRealTimers();
  });

  // 5. Цикл FOR_N (с числом)
  test('should handle FOR_N loop with parameter', async () => {
    // В плоском списке: FOR_N, 3, RIGHT, RIGHT, RIGHT, END
    const commands = [Command.FOR_N, 3 as unknown as Command, Command.RIGHT, Command.RIGHT, Command.RIGHT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(3);
  });

  // 6. Цикл FOR_LOOP (от A до B)
  test('should handle FOR_LOOP from 0 to 4', async () => {
    const commands = [Command.FOR_LOOP, 0 as unknown as Command, 4 as unknown as Command, Command.RIGHT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(4);
  });

  // 7. WHILE_WALL цикл
  test('should handle WHILE_WALL loop', async () => {
    level.map[0][3] = TileType.WALL;
    const commands = [Command.WHILE_WALL, Command.RIGHT, Command.END, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(2);
  });

  // 8. IF_KEY / ELSE
  test('should handle IF_KEY and ELSE', async () => {
    player.addKey('test_key');
    const commands = [Command.IF_KEY, Command.RIGHT, Command.ELSE, Command.LEFT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
  });

  // 9. IF_NO_KEY
  test('should handle IF_NO_KEY', async () => {
    const commands = [Command.IF_NO_KEY, Command.RIGHT, Command.END];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
  });

  // 10. Функции: определение и вызов
  test('should define and call a function', async () => {
    const commands: Command[] = [
      Command.DEF, 'move_right' as unknown as Command,
      Command.PARAM, 'steps' as unknown as Command,
      Command.RIGHT, Command.RIGHT,
      Command.END,
      Command.CALL, 'move_right' as unknown as Command, 2 as unknown as Command,
    ];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(2);
  });

  // 11. ООП: класс, создание объекта, вызов метода
  test('should define class, create object and call method', async () => {
    const commands: Command[] = [
      Command.CLASS, 'Walker' as unknown as Command,
      Command.DEF, 'walk' as unknown as Command,
      Command.PARAM, 'distance' as unknown as Command,
      Command.RIGHT,
      Command.END,
      Command.END,
      Command.NEW, 'Walker' as unknown as Command,
      Command.METHOD, 'obj_1' as unknown as Command, 'walk' as unknown as Command, 2 as unknown as Command,
    ];
    // Имитируем, что createObject вернёт 'obj_1'
    engine.loadProgram(commands);
    await engine.start();
    // Ожидаем, что объект создан и метод вызван (движение вправо на 2 шага)
    // В реальном движке нужно, чтобы метод выполнял команды; здесь проверяем хотя бы отсутствие ошибок
    expect(player.getPosition().col).toBe(2);
  });

  // 12. Клонирование и объединение
  test('should handle CLONE and JOIN', async () => {
    const commands = [Command.CLONE, Command.RIGHT, Command.JOIN];
    engine.loadProgram(commands);
    await engine.start();
    // Клон создан, но не выполняет команды в этом тесте (stepClones не вызывается)
    // Проверяем, что клон появился и потом исчез
    expect(player.getClones().length).toBe(0);
    expect(gameEvents.emit).toHaveBeenCalledWith('CLONE_CREATED', expect.any(Object));
  });

  // 13. Дрель (бэкдор)
  test('should handle DRILL and detect backdoor', async () => {
    level.map[0][1] = TileType.WALL;
    player.addTool('drill');
    const commands = [Command.DRILL, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
    // Проверяем, что backdoor обнаружен (через PathResult, но в тесте можем проверить флаг)
    let resultBackdoor = false;
    const listener = (payload: any) => { if (payload.result) resultBackdoor = payload.result.backdoorFound; };
    gameEvents.on('EXECUTION_FINISHED', listener);
    await engine.start();
    gameEvents.off('EXECUTION_FINISHED', listener);
    expect(resultBackdoor).toBe(true);
  });

  // 14. Крюк (притягивание)
  test('should handle HOOK to pull to wall', async () => {
    level.map[0][3] = TileType.WALL;
    player.addTool('hook');
    const commands = [Command.HOOK];
    engine.loadProgram(commands);
    await engine.start();
    // Должен притянуться к стене на расстоянии 3? Логика: до стены 3 клетки, крюк притягивает на позицию стены
    expect(player.getPosition().col).toBe(3);
  });

  // 15. Приманка (игнорирование монстров)
  test('should handle BAIT to bypass monsters', async () => {
    const monster = { id: 'm1', type: MonsterType.PATROL, position: { col: 1, row: 0 }, direction: 'right', isTamed: false, isRidden: false };
    level.objects.monsters.push(monster);
    player.addTool('bait');
    const commands = [Command.BAIT, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
  });

  // 16. Крылья (перелёт через яму)
  test('should use WING to fly over hole', async () => {
    level.map[0][1] = TileType.HOLE;
    player.addTool('wing');
    const commands = [Command.WING, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getPosition().col).toBe(1);
  });

  // 17. Верховая езда (RIDE) на tameable монстре
  test('should ride a tamed monster', async () => {
    const monster = { id: 'm1', type: MonsterType.TAMEABLE, position: { col: 1, row: 0 }, direction: 'right', isTamed: true, isRidden: false };
    level.objects.monsters.push(monster);
    const commands = [Command.RIDE, Command.RIGHT];
    engine.loadProgram(commands);
    await engine.start();
    // При езде позиция игрока должна стать позицией монстра, потом движение монстра
    expect(player.getPosition().col).toBe(2);
  });

  // 18. Подбор предметов (PICKUP)
  test('should pickup key', async () => {
    level.map[0][1] = TileType.KEY;
    level.objects.keys.push({ col: 1, row: 0 });
    const commands = [Command.RIGHT, Command.PICKUP];
    engine.loadProgram(commands);
    await engine.start();
    expect(player.getInventory().keys).toContain('key_1_0');
  });

  // 19. Использование ключа (USE_KEY) на двери
  test('should use key to open door', async () => {
    level.map[0][2] = TileType.DOOR_LOCKED;
    level.objects.doors.push({ id: 'door1', position: { col: 2, row: 0 }, isLocked: true, keyId: 'key1' });
    player.addKey('key1');
    const commands = [Command.RIGHT, Command.RIGHT, Command.USE_KEY];
    engine.loadProgram(commands);
    await engine.start();
    expect(level.map[0][2]).toBe(TileType.DOOR_UNLOCKED);
  });

  // 20. Максимальное количество шагов
  test('should stop after max steps', async () => {
    const infiniteLoop = [Command.WHILE_WALL, Command.RIGHT, Command.END];
    engine.loadProgram(infiniteLoop);
    await engine.start();
    expect(gameEvents.emit).toHaveBeenCalledWith('EXECUTION_FINISHED', expect.objectContaining({ success: false }));
  });
});
