export interface WorldConfig {
  worldId: string;
  totalLevels: number;
  difficultyRange: [number, number];
  gridSize: [number, number];
  description: string;
}

export function getWorldConfig(worldId: string): WorldConfig {
  const configs: Record<string, WorldConfig> = {
    meadow: {
      worldId: 'meadow',
      totalLevels: 500,
      difficultyRange: [0, 15],
      gridSize: [5, 8],
      description: 'Learn basic movement',
    },
    ocean: {
      worldId: 'ocean',
      totalLevels: 500,
      difficultyRange: [15, 30],
      gridSize: [6, 10],
      description: 'Walls and conveyors',
    },
    clouds: {
      worldId: 'clouds',
      totalLevels: 500,
      difficultyRange: [30, 50],
      gridSize: [7, 12],
      description: 'Wings and teleports',
    },
    fairytale: {
      worldId: 'fairytale',
      totalLevels: 500,
      difficultyRange: [50, 70],
      gridSize: [8, 14],
      description: 'Keys and riddles',
    },
    volcano: {
      worldId: 'volcano',
      totalLevels: 500,
      difficultyRange: [70, 90],
      gridSize: [10, 18],
      description: 'Monsters and OOP',
    },
    bonus: {
      worldId: 'bonus',
      totalLevels: 3000,
      difficultyRange: [90, 100],
      gridSize: [10, 20],
      description: 'Hidden challenges',
    },
  };
  return configs[worldId];
}

