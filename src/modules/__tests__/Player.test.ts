// src/modules/__tests__/Player.test.ts
import { Player } from '../Player';
import { Point, Inventory, MonsterType } from '../../types/index';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
  },
}));

function mockTileGetter(col: number, row: number): number {
  // Все клетки проходимы, кроме стены (4) в позиции (2,2) и ямы (2) в (3,3)
  if (col === 2 && row === 2) return 4;
  if (col === 3 && row === 3) return 2;
  return 0; // PLATFORM
}

describe('Player', () => {
  let player: Player;
  const startPos: Point = { col: 0, row: 0 };
  const levelWidth = 5;
  const levelHeight = 5;

  beforeEach(() => {
    jest.clearAllMocks();
    player = new Player(startPos, 'right', levelWidth, levelHeight, mockTileGetter);
  });

  test('should initialize correctly', () => {
    expect(player.getPosition()).toEqual(startPos);
    expect(player.getDirection()).toBe('right');
    expect(player.isPlayerAlive()).toBe(true);
    expect(player.isGhost()).toBe(false);
    expect(player.getInventory().keys).toHaveLength(0);
  });

  test('should move in direction', () => {
    const result = player.move('right');
    expect(result).toBe(true);
    expect(player.getPosition()).toEqual({ col: 1, row: 0 });
    expect(gameEvents.emit).toHaveBeenCalledWith('PLAYER_MOVED', { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } });
  });

  test('should not move into wall', () => {
    const player2 = new Player({ col: 1, row: 2 }, 'right', levelWidth, levelHeight, mockTileGetter);
    const result = player2.move('right');
    expect(result).toBe(false);
    expect(player2.getPosition()).toEqual({ col: 1, row: 2 });
  });

  test('should handle ghost mode', () => {
    player.setGhostMode(true);
    expect(player.isGhost()).toBe(true);
    expect(gameEvents.emit).toHaveBeenCalledWith('EXPLORATION_TOGGLED', { enabled: true, penaltyWarningShown: true });
  });

  test('should not die in ghost mode', () => {
    player.setGhostMode(true);
    player.kill('monster');
    expect(player.isPlayerAlive()).toBe(true);
  });

  test('should kill player', () => {
    player.kill('hole');
    expect(player.isPlayerAlive()).toBe(false);
    expect(gameEvents.emit).toHaveBeenCalledWith('PLAYER_DIED', { cause: 'hole' });
  });

  test('should revive player', () => {
    player.kill('hole');
    player.revive({ col: 0, row: 0 }, 'up');
    expect(player.isPlayerAlive()).toBe(true);
    expect(player.getPosition()).toEqual({ col: 0, row: 0 });
    expect(player.getDirection()).toBe('up');
    expect(player.getClones()).toHaveLength(0);
  });

  test('should manage inventory', () => {
    player.addKey('door1');
    expect(player.getInventory().keys).toContain('door1');
    player.useKey('door1');
    expect(player.getInventory().keys).not.toContain('door1');

    player.addCorn(3);
    expect(player.getInventory().corn).toBe(3);
    player.useCorn();
    expect(player.getInventory().corn).toBe(2);

    player.addTool('drill');
    expect(player.getInventory().hasDrill).toBe(true);
    player.useTool('drill');
    expect(player.getInventory().hasDrill).toBe(false);
  });

  test('should create and manage clones', () => {
    player.createClone('clone1', { col: 1, row: 1 }, []);
    expect(player.getClones()).toHaveLength(1);
    const clone = player.getClone('clone1');
    expect(clone).toBeDefined();
    expect(clone?.id).toBe('clone1');
    expect(gameEvents.emit).toHaveBeenCalledWith('CLONE_CREATED', { cloneId: 'clone1', pos: { col: 1, row: 1 } });

    player.updateClonePosition('clone1', { col: 2, row: 2 });
    expect(player.getClone('clone1')?.position).toEqual({ col: 2, row: 2 });

    player.removeClone('clone1');
    expect(player.getClones()).toHaveLength(0);
  });

  test('should join clones and merge inventory', () => {
    player.addKey('master_key');
    player.addCorn(1);
    player.createClone('cloneA', { col: 1, row: 1 }, []);
    const clone = player.getClone('cloneA')!;
    clone.inventory.keys.push('clone_key');
    clone.inventory.corn = 2;
    clone.inventory.hasDrill = true;
    player.joinClones();
    expect(player.getClones()).toHaveLength(0);
    const inv = player.getInventory();
    expect(inv.keys).toContain('master_key');
    expect(inv.keys).toContain('clone_key');
    expect(inv.corn).toBe(3);
    expect(inv.hasDrill).toBe(true);
  });

  test('should ride and dismount monster', () => {
    const monster = { id: 'monster1', type: MonsterType.TAMEABLE, position: { col: 0, row: 0 }, direction: 'right' as const, isTamed: false, isRidden: false };
    player.rideMonster(monster);
    expect(player.isRiding()).toBe(true);
    expect(player.getRiddenMonster()).not.toBeNull();
    expect(player.getPosition()).toEqual(monster.position);
    expect(gameEvents.emit).toHaveBeenCalledWith('MONSTER_TAMED', { monsterId: 'monster1' });
    player.dismountMonster();
    expect(player.isRiding()).toBe(false);
  });

  test('should apply conveyor with correct event emission', () => {
    // Создаём игрока на позиции (0,0). Конвейер вправо должен переместить на (1,0)
    const result = player.applyConveyor('right');
    expect(result).toBe(true);
    expect(player.getPosition()).toEqual({ col: 1, row: 0 });
    expect(gameEvents.emit).toHaveBeenCalledWith('PLAYER_MOVED', { from: { col: 0, row: 0 }, to: { col: 1, row: 0 } });
  });

  test('should not apply conveyor when dead', () => {
    player.kill('hole');
    const result = player.applyConveyor('right');
    expect(result).toBe(false);
    expect(player.getPosition()).toEqual({ col: 0, row: 0 });
  });

  test('should apply spring with correct event emission', () => {
    // Пружина вверх на 3 клетки (с 0,0 до 0,-3 — за пределами? В bounds 5x5, row -3 недопустимо. Лучше начать с (2,2))
    const springPlayer = new Player({ col: 2, row: 4 }, 'right', 5, 5, mockTileGetter);
    const result = springPlayer.applySpring('up', 2);
    expect(result).toBe(true);
    expect(springPlayer.getPosition()).toEqual({ col: 2, row: 2 }); // поднялся на 2 вверх
    expect(gameEvents.emit).toHaveBeenCalledWith('PLAYER_MOVED', { from: { col: 2, row: 4 }, to: { col: 2, row: 2 } });
  });

  test('should not apply spring when dead', () => {
    player.kill('hole');
    const result = player.applySpring('up', 1);
    expect(result).toBe(false);
    expect(player.getPosition()).toEqual({ col: 0, row: 0 });
  });
});
