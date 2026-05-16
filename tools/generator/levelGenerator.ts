import { LevelData, TileType, Point, MonsterType, Command } from '../../src/types/index';
import { Pathfinder } from './pathfinder';
import { WorldConfig, getWorldConfig } from './config';
import { saveLevelToFile } from './fileUtils';
import seedrandom from 'seedrandom';

// Глобальный генератор случайных чисел для детерминированности
let rng: () => number;

function setSeed(seed: string): void {
  rng = seedrandom(seed);
}

function random(): number {
  if (!rng) rng = seedrandom(Date.now().toString());
  return rng();
}

export async function generateLevels(
  worldId: string,
  startNum: number,
  count: number,
  outputDir: string
): Promise<void> {
  const config = getWorldConfig(worldId);
  // Устанавливаем seed для воспроизводимости (опционально)
  setSeed(`${worldId}_${startNum}`);
  
  for (let i = 0; i < count; i++) {
    const levelNum = startNum + i;
    let level: LevelData | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts && !level) {
      const candidate = generateSingleLevel(config, levelNum);
      const validator = new Pathfinder(candidate);
      if (validator.isSolvable()) {
        level = candidate;
        break;
      }
      attempts++;
    }
    
    if (!level) {
      // Финальная попытка: создаём уровень с гарантированным решением (удаляем все стены на пути)
      level = generateFallbackLevel(config, levelNum);
      console.warn(`Level ${levelNum} unsolvable after ${maxAttempts} attempts, using fallback`);
    }
    
    saveLevelToFile(level, worldId, levelNum, outputDir);
    if ((i + 1) % 100 === 0) {
      console.log(`Generated ${i + 1} levels for ${worldId}`);
    }
  }
}

function generateSingleLevel(config: WorldConfig, levelNum: number, forceSolvable = false): LevelData {
  const difficulty = calculateDifficulty(config, levelNum);
  const size = calculateGridSize(config, levelNum);
  const map = generateTilemap(size.width, size.height, config, difficulty);
  const objects = generateObjects(map, config, difficulty, levelNum);
  const startPos = findValidStart(map);
  const coinPos = findValidCoin(map, startPos);
  // Гарантируем, что старт и монета не перезаписаны
  map[startPos.row][startPos.col] = TileType.START;
  map[coinPos.row][coinPos.col] = TileType.GOAL;
  const optimalSteps = estimateOptimalSteps(startPos, coinPos);
  return {
    id: `${config.worldId}_${levelNum.toString().padStart(3, '0')}`,
    name: `Level ${levelNum}`,
    description: config.description,
    worldId: config.worldId,
    levelNumber: levelNum,
    width: size.width,
    height: size.height,
    map,
    objects,
    startPos,
    coinPos,
    optimalSteps,
    solutions: {
      easy: { steps: optimalSteps * 2, commands: [] },
      mid: { steps: Math.floor(optimalSteps * 1.5), commands: [] },
      hard: { steps: optimalSteps, commands: [] },
      backdoor: null,
    },
    isTutorial: levelNum <= 10,
    explorationPenalty: true,
  };
}

function generateFallbackLevel(config: WorldConfig, levelNum: number): LevelData {
  const size = calculateGridSize(config, levelNum);
  const map: TileType[][] = Array(size.height).fill(null).map(() => Array(size.width).fill(TileType.PLATFORM));
  const startPos: Point = { col: 0, row: 0 };
  const coinPos: Point = { col: size.width - 1, row: size.height - 1 };
  map[startPos.row][startPos.col] = TileType.START;
  map[coinPos.row][coinPos.col] = TileType.GOAL;
  const objects = generateEmptyObjects();
  const optimalSteps = estimateOptimalSteps(startPos, coinPos);
  return {
    id: `${config.worldId}_${levelNum.toString().padStart(3, '0')}`,
    name: `Level ${levelNum}`,
    description: config.description,
    worldId: config.worldId,
    levelNumber: levelNum,
    width: size.width,
    height: size.height,
    map,
    objects,
    startPos,
    coinPos,
    optimalSteps,
    solutions: {
      easy: { steps: optimalSteps * 2, commands: [] },
      mid: { steps: Math.floor(optimalSteps * 1.5), commands: [] },
      hard: { steps: optimalSteps, commands: [] },
      backdoor: null,
    },
    isTutorial: levelNum <= 10,
    explorationPenalty: true,
  };
}

function calculateDifficulty(config: WorldConfig, levelNum: number): number {
  const progress = (levelNum - 1) / config.totalLevels;
  return config.difficultyRange[0] + progress * (config.difficultyRange[1] - config.difficultyRange[0]);
}

function calculateGridSize(config: WorldConfig, levelNum: number): { width: number; height: number } {
  const progress = (levelNum - 1) / config.totalLevels;
  const min = config.gridSize[0];
  const max = config.gridSize[1];
  const width = Math.floor(min + progress * (max - min));
  const height = Math.floor(min + progress * (max - min));
  return { width, height };
}

function generateTilemap(width: number, height: number, config: WorldConfig, difficulty: number): TileType[][] {
  const map: TileType[][] = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
  // Оставляем рамку из платформ, внутренность заполняем препятствиями
  const wallDensity = 0.05 + difficulty * 0.15;
  const holeDensity = 0.02 + difficulty * 0.08;
  const brickDensity = 0.02 + difficulty * 0.05;
  
  for (let row = 1; row < height - 1; row++) {
    for (let col = 1; col < width - 1; col++) {
      const r = random();
      if (r < wallDensity) {
        map[row][col] = TileType.WALL;
      } else if (r < wallDensity + holeDensity) {
        map[row][col] = TileType.HOLE;
      } else if (r < wallDensity + holeDensity + brickDensity) {
        map[row][col] = TileType.BRICK;
      }
    }
  }
  return map;
}

function generateObjects(map: TileType[][], config: WorldConfig, difficulty: number, levelNum: number): any {
  const objects = generateEmptyObjects();
  const width = map[0].length;
  const height = map.length;
  
  // Добавляем объекты в зависимости от мира и сложности
  if (config.worldId === 'ocean') {
    // Конвейеры
    const conveyorCount = Math.floor(difficulty / 10) + 1;
    for (let i = 0; i < conveyorCount; i++) {
      const pos = findFreeCell(map, objects);
      if (pos) {
        const dirs = ['up', 'down', 'left', 'right'];
        const dir = dirs[Math.floor(random() * dirs.length)];
        let tileType = TileType.CONVEYOR_UP;
        if (dir === 'up') tileType = TileType.CONVEYOR_UP;
        else if (dir === 'down') tileType = TileType.CONVEYOR_DOWN;
        else if (dir === 'left') tileType = TileType.CONVEYOR_LEFT;
        else tileType = TileType.CONVEYOR_RIGHT;
        map[pos.row][pos.col] = tileType;
        objects.conveyors.push({ id: `conv_${pos.col}_${pos.row}`, position: pos, direction: dir as any });
      }
    }
    // Пружины
    const springCount = Math.floor(difficulty / 15);
    for (let i = 0; i < springCount; i++) {
      const pos = findFreeCell(map, objects);
      if (pos) {
        map[pos.row][pos.col] = TileType.SPRING;
        objects.springs.push({ id: `spring_${pos.col}_${pos.row}`, position: pos, launchDirection: 'up', force: 3 });
      }
    }
  } else if (config.worldId === 'clouds') {
    // Телепорты
    const teleportCount = Math.floor(difficulty / 20) + 1;
    const teleports: { entry: Point; exit: Point }[] = [];
    for (let i = 0; i < teleportCount; i++) {
      const entry = findFreeCell(map, objects);
      const exit = findFreeCell(map, objects);
      if (entry && exit) {
        map[entry.row][entry.col] = TileType.TELEPORT_IN;
        map[exit.row][exit.col] = TileType.TELEPORT_OUT;
        objects.teleports.push({ id: `tp_${i}`, entry, exit });
      }
    }
    // Крылья (инструмент)
    const wingsCount = Math.floor(difficulty / 25);
    for (let i = 0; i < wingsCount; i++) {
      const pos = findFreeCell(map, objects);
      if (pos) {
        map[pos.row][pos.col] = TileType.TOOL_WING;
        objects.wings.push(pos);
      }
    }
  } else if (config.worldId === 'fairytale') {
    // Ключи и двери
    const pairCount = Math.floor(difficulty / 15) + 1;
    for (let i = 0; i < pairCount; i++) {
      const keyPos = findFreeCell(map, objects);
      const doorPos = findFreeCell(map, objects);
      if (keyPos && doorPos) {
        const keyId = `key_${i}`;
        map[keyPos.row][keyPos.col] = TileType.KEY;
        objects.keys.push(keyPos);
        map[doorPos.row][doorPos.col] = TileType.DOOR_LOCKED;
        objects.doors.push({ id: `door_${i}`, position: doorPos, isLocked: true, keyId });
      }
    }
  } else if (config.worldId === 'volcano') {
    // Монстры
    const monsterCount = Math.floor(difficulty / 20) + 1;
    const monsterTypes = [MonsterType.PATROL, MonsterType.CHASE, MonsterType.TAMEABLE];
    for (let i = 0; i < monsterCount; i++) {
      const pos = findFreeCell(map, objects);
      if (pos) {
        const type = monsterTypes[Math.floor(random() * monsterTypes.length)];
        objects.monsters.push({
          id: `monster_${i}`,
          type,
          position: pos,
          direction: 'right',
          isTamed: false,
          isRidden: false,
        });
      }
    }
    // Кукуруза для приручения
    const cornCount = Math.floor(difficulty / 10);
    for (let i = 0; i < cornCount; i++) {
      const pos = findFreeCell(map, objects);
      if (pos) {
        map[pos.row][pos.col] = TileType.CORN;
        objects.corn.push(pos);
      }
    }
  } else if (config.worldId === 'bonus') {
    // Сложные механики: чёрные ящики, сортировщики, зеркала
    const boxCount = Math.floor(difficulty / 30) + 1;
    for (let i = 0; i < boxCount; i++) {
      const pos = findFreeCell(map, objects);
      if (pos) {
        map[pos.row][pos.col] = TileType.BLACK_BOX;
        objects.blackBoxes.push({ id: `box_${i}`, position: pos, inputCount: 1, outputCount: 1, mapping: 'identity' });
      }
    }
  }
  
  return objects;
}

function findFreeCell(map: TileType[][], objects: any): Point | null {
  const width = map[0].length;
  const height = map.length;
  // Проходим по случайным клеткам, ищем пустую платформу без объектов
  for (let attempt = 0; attempt < 100; attempt++) {
    const col = Math.floor(random() * width);
    const row = Math.floor(random() * height);
    if (map[row][col] === TileType.PLATFORM) {
      // Проверим, нет ли уже объекта в этой позиции
      let occupied = false;
      const checkPos = (pos: Point) => pos.col === col && pos.row === row;
      if (objects.keys.some(checkPos) ||
          objects.doors.some((d: any) => d.position.col === col && d.position.row === row) ||
          objects.monsters.some((m: any) => m.position.col === col && m.position.row === row) ||
          objects.conveyors.some((c: any) => c.position.col === col && c.position.row === row) ||
          objects.springs.some((s: any) => s.position.col === col && s.position.row === row) ||
          objects.teleports.some((t: any) => t.entry.col === col && t.entry.row === row) ||
          objects.wings.some(checkPos) ||
          objects.corn.some(checkPos)) {
        occupied = true;
      }
      if (!occupied) return { col, row };
    }
  }
  return null;
}

function findValidStart(map: TileType[][]): Point {
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[0].length; col++) {
      if (map[row][col] === TileType.PLATFORM) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

function findValidCoin(map: TileType[][], start: Point): Point {
  // Ищем клетку, удалённую от старта
  let bestDist = 0;
  let bestPos = { col: map[0].length - 1, row: map.length - 1 };
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[0].length; col++) {
      if (map[row][col] === TileType.PLATFORM) {
        const dist = Math.abs(col - start.col) + Math.abs(row - start.row);
        if (dist > bestDist) {
          bestDist = dist;
          bestPos = { col, row };
        }
      }
    }
  }
  return bestPos;
}

function estimateOptimalSteps(start: Point, coin: Point): number {
  return Math.abs(start.col - coin.col) + Math.abs(start.row - coin.row);
}

function generateEmptyObjects(): any {
  return {
    holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
    springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
    corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
    clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
  };
}
