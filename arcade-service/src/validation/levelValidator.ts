// arcade-service/src/validation/levelValidator.ts
// ПРОМЕТЕЙ: Серверная валидация уровня (BFS) перед публикацией.
// Переиспользует логику, аналогичную клиентскому Pathfinder, но в Node.js окружении.
// Проверяет, что уровень имеет решение с учётом базовых механик (движение, стены, ямы, ключи/двери).
// Дополнительно проверяет корректность JSON-схемы.

import { LevelData, TileType, Point, Inventory, Monster, MonsterType } from '../../../src/types/index';

// Интерфейс состояния для BFS (упрощённый, без сложных механик функций/ООП, так как они не влияют на solvability уровня)
interface ValidationState {
  pos: Point;
  inv: Inventory;
  doorsOpened: Set<string>;
  steps: number;
}

function hashState(state: ValidationState): string {
  return `${state.pos.col},${state.pos.row}|inv:${state.inv.keys.sort().join(',')}|doors:${Array.from(state.doorsOpened).sort().join(',')}`;
}

export async function validateLevel(levelData: LevelData): Promise<{ valid: boolean; error?: string }> {
  // 1. Базовая валидация структуры
  if (!levelData.id || !levelData.name || !levelData.width || !levelData.height) {
    return { valid: false, error: 'Missing required fields: id, name, width, height' };
  }
  if (!levelData.map || !Array.isArray(levelData.map)) {
    return { valid: false, error: 'Invalid or missing map' };
  }
  if (levelData.map.length !== levelData.height || levelData.map[0]?.length !== levelData.width) {
    return { valid: false, error: 'Map dimensions do not match width/height' };
  }
  if (!levelData.startPos || typeof levelData.startPos.col !== 'number' || typeof levelData.startPos.row !== 'number') {
    return { valid: false, error: 'Invalid start position' };
  }
  if (!levelData.coinPos || typeof levelData.coinPos.col !== 'number' || typeof levelData.coinPos.row !== 'number') {
    return { valid: false, error: 'Invalid coin position' };
  }
  // Проверка, что start и coin находятся в пределах карты
  if (levelData.startPos.col < 0 || levelData.startPos.col >= levelData.width ||
      levelData.startPos.row < 0 || levelData.startPos.row >= levelData.height) {
    return { valid: false, error: 'Start position out of bounds' };
  }
  if (levelData.coinPos.col < 0 || levelData.coinPos.col >= levelData.width ||
      levelData.coinPos.row < 0 || levelData.coinPos.row >= levelData.height) {
    return { valid: false, error: 'Coin position out of bounds' };
  }

  // 2. BFS для проверки решаемости (упрощённый, без конвейеров, пружин, телепортов – для MVP достаточно)
  const startState: ValidationState = {
    pos: { ...levelData.startPos },
    inv: { keys: [], corn: 0, cores: 0, hasDrill: false, hasHook: false, hasWing: false, hasBait: false, tools: [] },
    doorsOpened: new Set(),
    steps: 0,
  };

  const queue: ValidationState[] = [startState];
  const visited = new Set<string>();
  visited.add(hashState(startState));

  const maxSteps = 5000; // ограничение на случай бесконечных циклов

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.steps > maxSteps) break;

    // Проверка достижения монеты
    if (current.pos.col === levelData.coinPos.col && current.pos.row === levelData.coinPos.row) {
      return { valid: true };
    }

    // Генерация соседей (4 направления)
    const dirs = [
      { col: 0, row: -1 }, // up
      { col: 0, row: 1 },  // down
      { col: -1, row: 0 }, // left
      { col: 1, row: 0 },  // right
    ];
    for (const delta of dirs) {
      const newPos = { col: current.pos.col + delta.col, row: current.pos.row + delta.row };
      if (newPos.col < 0 || newPos.col >= levelData.width || newPos.row < 0 || newPos.row >= levelData.height) continue;

      const tile = levelData.map[newPos.row][newPos.col];
      // Стены
      if (tile === TileType.WALL || tile === TileType.FAKE_WALL) continue;
      // Ямы (без крыльев – непроходимы)
      if (tile === TileType.HOLE && !current.inv.hasWing) continue;
      // Лава/вода
      if ((tile === TileType.LAVA || tile === TileType.WATER)) continue;
      // Двери
      if (tile === TileType.DOOR_LOCKED) {
        const door = levelData.objects.doors.find(d => d.position.col === newPos.col && d.position.row === newPos.row);
        if (door && !current.doorsOpened.has(door.id) && !current.inv.keys.includes(door.keyId || '')) {
          continue;
        }
      }
      // Монстры (неприрученные – непроходимы)
      const monsterHere = levelData.objects.monsters.find(m => m.position.col === newPos.col && m.position.row === newPos.row);
      if (monsterHere && monsterHere.type !== MonsterType.TAMEABLE && !monsterHere.isTamed) continue;

      // Копируем состояние
      const newInv = { ...current.inv, keys: [...current.inv.keys] };
      const newDoors = new Set(current.doorsOpened);
      // Сбор предметов
      if (tile === TileType.KEY) {
        const keyId = `key_${newPos.col}_${newPos.row}`;
        if (!newInv.keys.includes(keyId)) newInv.keys.push(keyId);
      }
      if (tile === TileType.TOOL_WING) newInv.hasWing = true;
      if (tile === TileType.TOOL_DRILL) newInv.hasDrill = true;
      if (tile === TileType.CORN) newInv.corn++;
      // Открытие двери при наличии ключа
      if (tile === TileType.DOOR_LOCKED) {
        const door = levelData.objects.doors.find(d => d.position.col === newPos.col && d.position.row === newPos.row);
        if (door && newInv.keys.includes(door.keyId || '')) {
          newInv.keys = newInv.keys.filter(k => k !== door.keyId);
          newDoors.add(door.id);
        }
      }
      // Приручение монстра (если клетка содержит tameable монстра и есть кукуруза)
      if (monsterHere && monsterHere.type === MonsterType.TAMEABLE && newInv.corn > 0) {
        newInv.corn--;
        // В BFS не обязательно отслеживать состояние монстра, так как он становится проходимым
      }

      const nextState: ValidationState = {
        pos: newPos,
        inv: newInv,
        doorsOpened: newDoors,
        steps: current.steps + 1,
      };
      const hash = hashState(nextState);
      if (!visited.has(hash)) {
        visited.add(hash);
        queue.push(nextState);
      }
    }
  }

  return { valid: false, error: 'Level has no valid solution (BFS could not find path to coin)' };
}
