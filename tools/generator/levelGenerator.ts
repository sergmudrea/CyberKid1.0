import { LevelData, TileType, Point, MonsterType, Command } from '../../src/types/index';
import { Pathfinder } from './pathfinder';
import { WorldConfig, getWorldConfig } from './config';
import { saveLevelToFile } from './fileUtils';

export async function generateLevels(
  worldId: string,
  startNum: number,
  count: number,
  outputDir: string
): Promise<void> {
  const config = getWorldConfig(worldId);
  for (let i = 0; i < count; i++) {
    const levelNum = startNum + i;
    const level = generateSingleLevel(config, levelNum);
    const pathfinder = new Pathfinder(level);
    if (!pathfinder.isSolvable()) {
      console.warn(`Level ${levelNum} unsolvable, regenerating...`);
      // Простая регенерация (в реальности нужно улучшить)
      const newLevel = generateSingleLevel(config, levelNum, true);
      saveLevelToFile(newLevel, worldId, levelNum, outputDir);
    } else {
      saveLevelToFile(level, worldId, levelNum, outputDir);
    }
    if ((i + 1) % 50 === 0) {
      console.log(`Generated ${i + 1} levels for ${worldId}`);
    }
  }
}

function generateSingleLevel(config: WorldConfig, levelNum: number, forceSolvable = false): LevelData {
  const difficulty = calculateDifficulty(config, levelNum);
  const size = calculateGridSize(config, levelNum);
  const map = generateTilemap(size.width, size.height, config, difficulty);
  const objects = generateObjects(map, config, difficulty);
  const startPos = findStartPosition(map);
  const coinPos = findCoinPosition(map);
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
  const width = Math.floor(config.gridSize[0] + progress * (config.gridSize[1] - config.gridSize[0]));
  const height = Math.floor(config.gridSize[0] + progress * (config.gridSize[1] - config.gridSize[0]));
  return { width, height };
}

function generateTilemap(width: number, height: number, config: WorldConfig, difficulty: number): TileType[][] {
  const map: TileType[][] = Array(height).fill(null).map(() => Array(width).fill(TileType.PLATFORM));
  // Добавление стен, ям, кирпичей в зависимости от сложности
  const wallDensity = 0.05 + difficulty * 0.1;
  const holeDensity = 0.02 + difficulty * 0.05;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (Math.random() < wallDensity && !isEdge(col, row, width, height)) {
        map[row][col] = TileType.WALL;
      } else if (Math.random() < holeDensity && !isEdge(col, row, width, height)) {
        map[row][col] = TileType.HOLE;
      }
    }
  }
  return map;
}

function isEdge(col: number, row: number, width: number, height: number): boolean {
  return col === 0 || row === 0 || col === width - 1 || row === height - 1;
}

function generateObjects(map: TileType[][], config: WorldConfig, difficulty: number): any {
  // Упрощённая генерация объектов
  return {
    holes: [], walls: [], bricks: [], keys: [], doors: [], monsters: [], teleports: [], conveyors: [],
    springs: [], blackBoxes: [], sorters: [], buttons: [], levers: [], sensors: [], timers: [],
    corn: [], cores: [], drills: [], hooks: [], wings: [], baits: [], rockets: [], mirrors: [],
    clonePoints: [], ridePoints: [], bridges: [], lava: [], water: [], fakeWalls: [],
  };
}

function findStartPosition(map: TileType[][]): Point {
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[0].length; col++) {
      if (map[row][col] === TileType.PLATFORM) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}

function findCoinPosition(map: TileType[][]): Point {
  for (let row = map.length - 1; row >= 0; row--) {
    for (let col = map[0].length - 1; col >= 0; col--) {
      if (map[row][col] === TileType.PLATFORM) return { col, row };
    }
  }
  return { col: map[0].length - 1, row: map.length - 1 };
}

function estimateOptimalSteps(start: Point, coin: Point): number {
  return Math.abs(start.col - coin.col) + Math.abs(start.row - coin.row);
}
