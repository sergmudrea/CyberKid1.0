// src/types/index.ts
// ПРОМЕТЕЙ: Полное ядро типов CyberKid согласно ТЗ и arch.txt.
// Содержит 45+ команд, 40+ тайлов, интерфейсы для механик, поддержку функций, классов, клонов.

// ------------------------------ 1. КОМАНДЫ (45+) ------------------------------
export enum Command {
  // Движение (4)
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',

  // Циклы (6)
  FOR_N = 'FOR_N',
  FOR_LOOP = 'FOR_LOOP',
  WHILE_MONSTER = 'WHILE_MONSTER',
  WHILE_WALL = 'WHILE_WALL',
  WHILE_HOLE = 'WHILE_HOLE',
  REPEAT = 'REPEAT',

  // Условия (7)
  IF_WALL = 'IF_WALL',
  IF_HOLE = 'IF_HOLE',
  IF_MONSTER = 'IF_MONSTER',
  IF_COIN = 'IF_COIN',
  IF_KEY = 'IF_KEY',
  IF_NO_KEY = 'IF_NO_KEY',
  ELSE = 'ELSE',

  // Функции (4)
  CALL = 'CALL',
  DEF = 'DEF',
  RETURN = 'RETURN',
  PARAM = 'PARAM',

  // ООП (3)
  CLASS = 'CLASS',
  NEW = 'NEW',
  METHOD = 'METHOD',

  // Параллелизм (2)
  CLONE = 'CLONE',
  JOIN = 'JOIN',

  // Взаимодействие (7)
  PUSH = 'PUSH',
  THROW = 'THROW',
  FEED = 'FEED',
  HOOK = 'HOOK',
  DRILL = 'DRILL',
  BAIT = 'BAIT',
  SCAN = 'SCAN',

  // Инвентарь (3)
  PICKUP = 'PICKUP',
  DROP = 'DROP',
  USE_KEY = 'USE_KEY',

  // Время (2)
  TIME_SLOW = 'TIME_SLOW',
  TIME_FAST = 'TIME_FAST',

  // Дополнительные (3)
  WING = 'WING',
  RIDE = 'RIDE',
  WAIT = 'WAIT',

  // Технические (2)
  START = 'START',
  END = 'END'
}

// ------------------------------ 2. ТИПЫ ТАЙЛОВ (40+) ------------------------------
export enum TileType {
  PLATFORM = 0,
  SKY = 1,
  HOLE = 2,
  BRICK = 3,
  WALL = 4,
  FAKE_WALL = 5,
  LADDER = 6,
  GOAL = 7,
  START = 8,
  KEY = 10,
  DOOR_LOCKED = 11,
  DOOR_UNLOCKED = 12,
  CORN = 13,
  CORE = 14,
  TOOL_DRILL = 15,
  TOOL_HOOK = 16,
  TOOL_WING = 17,
  TOOL_BAIT = 18,
  CONVEYOR_UP = 19,
  CONVEYOR_DOWN = 20,
  CONVEYOR_LEFT = 21,
  CONVEYOR_RIGHT = 22,
  SPRING = 23,
  TELEPORT_IN = 24,
  TELEPORT_OUT = 25,
  BLACK_BOX = 26,
  SENSOR = 27,
  LEVER = 28,
  BUTTON = 29,
  TIMER = 30,
  SORTER = 31,
  LAVA = 32,
  WATER = 33,
  BRIDGE = 34,
  BRIDGE_ACTIVE = 35,
  ROCKET = 36,
  MIRROR = 37,
  CLONE_POINT = 38,
  RIDE_POINT = 39,
  NEURO_STAB = 40
}

// ------------------------------ 3. ИНТЕРФЕЙСЫ ДЛЯ УРОВНЕЙ И ОБЪЕКТОВ ------------------------------
export interface Point {
  col: number;
  row: number;
}

export enum MonsterType {
  PATROL = 'patrol',
  CHASE = 'chase',
  TAMEABLE = 'tameable',
  PHASED = 'phased',
  ZOMBIE = 'zombie',
  BOSS = 'boss'
}

export interface Monster {
  id: string;
  type: MonsterType;
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
  patrolPath?: Point[];
  patrolIndex?: number;
  isTamed: boolean;
  isRidden: boolean;
  health?: number;
}

export interface TeleportPair {
  id: string;
  entry: Point;
  exit: Point;
}

export interface Conveyor {
  id: string;
  position: Point;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface Spring {
  id: string;
  position: Point;
  launchDirection: 'up' | 'down' | 'left' | 'right';
  force: number;
}

export interface BlackBox {
  id: string;
  position: Point;
  inputCount: number;
  outputCount: number;
  mapping: string;
}

export interface Sorter {
  id: string;
  position: Point;
  order: 'asc' | 'desc' | 'fifo' | 'lifo';
}

export interface Bridge {
  id: string;
  position: Point;
  active: boolean;
  buttonId?: string;
}

export interface Door {
  id: string;
  position: Point;
  isLocked: boolean;
  keyId?: string;
}

export interface Lever {
  id: string;
  position: Point;
  state: boolean;
}

export interface Sensor {
  position: Point;
  range: number;
}

export interface Timer {
  position: Point;
  delay: number;
  active: boolean;
}

export interface Rocket {
  entry: Point;
  exit: Point;
}

export interface LevelObjects {
  holes: Point[];
  walls: Point[];
  bricks: Point[];
  keys: Point[];
  doors: Door[];
  monsters: Monster[];
  teleports: TeleportPair[];
  conveyors: Conveyor[];
  springs: Spring[];
  blackBoxes: BlackBox[];
  sorters: Sorter[];
  buttons: Point[];
  levers: Lever[];
  sensors: Sensor[];
  timers: Timer[];
  corn: Point[];
  cores: Point[];
  drills: Point[];
  hooks: Point[];
  wings: Point[];
  baits: Point[];
  rockets: Rocket[];
  mirrors: Point[];
  clonePoints: Point[];
  ridePoints: Point[];
  bridges: Bridge[];
  lava: Point[];
  water: Point[];
  fakeWalls: Point[];
}

// ------------------------------ 4. СТРУКТУРА УРОВНЯ (LevelData) ------------------------------
export interface LevelData {
  id: string;
  name: string;
  description: string;
  worldId: string;
  levelNumber: number;
  width: number;
  height: number;
  map: TileType[][];
  objects: LevelObjects;
  startPos: Point;
  coinPos: Point;
  optimalSteps: number;
  solutions: {
    easy: { steps: number; commands: Command[] };
    mid: { steps: number; commands: Command[] };
    hard: { steps: number; commands: Command[] };
    backdoor: { steps: number; commands: Command[] } | null;
  };
  isTutorial: boolean;
  requiredCommands?: Command[];
  maxCommandCount?: number;
  initialCode?: Command[];
  explorationPenalty: boolean;
  backdoorHint?: string;
}

// ------------------------------ 5. ИНВЕНТАРЬ ------------------------------
export interface Inventory {
  keys: string[];
  corn: number;
  cores: number;
  hasDrill: boolean;
  hasHook: boolean;
  hasWing: boolean;
  hasBait: boolean;
  tools: string[];
}

// ------------------------------ 6. ПРОГРЕСС ИГРОКА ------------------------------
export interface LevelStats {
  stars: number;
  blackStar: boolean;
  attempts: number;
  bestSteps: number;
  completed: boolean;
  explorationUsed: boolean;
  backdoorUsed: boolean;
  lastPlayed: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
}

export interface PlayerProgress {
  totalStars: number;
  totalBlackStars: number;
  levelsCompleted: string[];
  perfectLevels: string[];
  levelStats: Record<string, LevelStats>;
  totalAttempts: number;
  totalDeaths: number;
  deathsByType: Record<string, number>;
  totalPlayTimeSec: number;
  explorationUsedCount: number;
  backdoorsFound: number;
  unlockedWorlds: string[];
  lastPlayedWorld: string;
  lastPlayedLevelId: string;
  achievements: Achievement[];
  settings: UserSettings;
}

// ------------------------------ 7. НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ ------------------------------
export enum LearningMode {
  KIDDO = 'kiddo',
  SCHOLAR = 'scholar',
  DEV_STUDENT = 'dev_student',
  DEVELOPER = 'developer'
}

export interface UserSettings {
  learningMode: LearningMode;
  language: 'ru' | 'en';
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  vibrationEnabled: boolean;
  showTutorials: boolean;
  autoHints: boolean;
  developerMode: boolean;
}

// ------------------------------ 8. РЕЗУЛЬТАТЫ BFS (Pathfinder) ------------------------------
export interface PathResult {
  isValid: boolean;
  path: Point[];
  stepsCount: number;
  errorMessage?: string;
  finalInventory: Inventory;
  monstersState: Monster[];
  visitedCells: number;
  optimalStepsReference: number;
  starsEarned: number;
  killedByMonster: boolean;
  fellIntoHole: boolean;
  fellIntoLava: boolean;
  drowned: boolean;
  explorationUsed: boolean;
  backdoorFound: boolean;
}

// ------------------------------ 9. СТАТУС ВЫПОЛНЕНИЯ (ExecutionEngine) ------------------------------
export interface CallFrame {
  functionName: string;
  returnAddress: number;
  localVars: Map<string, any>;
}

export interface CloneInfo {
  id: string;
  position: Point;
  inventory: Inventory;
  commands: Command[];
  currentIndex: number;
}

export interface ExecutionStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'error' | 'waiting';
  currentCommandIndex: number;
  totalCommands: number;
  cycleCount: number;
  lastError?: string;
  callStack: CallFrame[];
  clones: CloneInfo[];
}

// ------------------------------ 10. МИРЫ И КОНФИГУРАЦИЯ ------------------------------
export interface World {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  thumbnailUrl?: string;
  order: number;
  platformColor: string;
  skyColor: string;
  levelsCount: number;
  isLocked: boolean;
  priceSku?: string;
  availableCommands: Command[];
  newMechanics: string[];
  difficultyRange: [number, number];
  defaultGridSize: number;
}

export interface GameConfig {
  version: string;
  gridSizePx: number;
  defaultZoom: number;
  maxUndoSteps: number;
  autoSaveIntervalMs: number;
  worlds: World[];
  products: Product[];
}

export interface Product {
  sku: string;
  type: 'consumable' | 'non_consumable' | 'subscription';
  price: string;
  title: string;
  description: string;
  worldId?: string;
  durationDays?: number;
}

export interface Subscription {
  sku: string;
  expiryDate: number;
  isActive: boolean;
}

export interface PurchaseData {
  sku: string;
  purchaseToken: string;
  signature: string;
  originalJson: string;
  isAcknowledged: boolean;
}

// ------------------------------ 11. СОБЫТИЯ EVENTBUS ------------------------------
export type GameEvent =
  | { type: 'LEVEL_LOAD_REQUEST'; payload: { levelId: string } }
  | { type: 'LEVEL_LOADED'; payload: { level: LevelData } }
  | { type: 'LEVEL_COMPLETED'; payload: { levelId: string; stars: number; blackStar: boolean; stepsUsed: number } }
  | { type: 'LEVEL_FAILED'; payload: { reason: string } }
  | { type: 'EXECUTION_START' }
  | { type: 'EXECUTION_STEP'; payload: { stepIndex: number; command: Command; pos: Point } }
  | { type: 'EXECUTION_FINISHED'; payload: { success: boolean; result: PathResult } }
  | { type: 'EXECUTION_PAUSED' }
  | { type: 'EXECUTION_RESUMED' }
  | { type: 'COMMAND_QUEUE_CHANGED'; payload: { commands: Command[] } }
  | { type: 'PROGRAM_SAVED'; payload: { levelId: string; slot: number } }
  | { type: 'PROGRAM_LOADED'; payload: { commands: Command[] } }
  | { type: 'EXPLORATION_TOGGLED'; payload: { enabled: boolean; penaltyWarningShown: boolean } }
  | { type: 'PLAYER_MOVED'; payload: { from: Point; to: Point } }
  | { type: 'PLAYER_DIED'; payload: { cause: string } }
  | { type: 'INVENTORY_CHANGED'; payload: { inventory: Inventory } }
  | { type: 'MONSTER_TAMED'; payload: { monsterId: string } }
  | { type: 'CLONE_CREATED'; payload: { cloneId: string; pos: Point } }
  | { type: 'CLONE_MOVED'; payload: { cloneId: string; pos: Point } }
  | { type: 'CLONES_JOINED' }
  | { type: 'OBJECT_CREATED'; payload: { className: string; objectId: string } }
  | { type: 'OBJECT_COLLECTED'; payload: { objectId: string } }
  | { type: 'OBJECT_DROPPED'; payload: { objectId: string; pos: Point } }
  | { type: 'HINT_SHOWN'; payload: { hintText: string; tier: number } }
  | { type: 'SETTINGS_CHANGED'; payload: UserSettings }
  | { type: 'PROGRESS_UPDATED'; payload: PlayerProgress }
  | { type: 'WORLD_UNLOCKED'; payload: { worldId: string } }
  | { type: 'ACHIEVEMENT_UNLOCKED'; payload: { achievementId: string } }
  | { type: 'BACKDOOR_FOUND'; payload: { levelId: string; backdoorType: string } }
  | { type: 'PURCHASE_COMPLETED'; payload: { sku: string; worldId?: string } }
  | { type: 'PURCHASE_FAILED'; payload: { error: string } }
  | { type: 'RESTORE_PURCHASES_COMPLETE' }
  | { type: 'SANDBOX_LEVEL_SAVED'; payload: { levelData: LevelData } }
  | { type: 'ARCADE_LEVEL_PUBLISH'; payload: { levelData: LevelData } };

// ------------------------------ 12. ВСПОМОГАТЕЛЬНЫЕ ТИПЫ ------------------------------
export interface LevelMetadata {
  id: string;
  name: string;
  worldId: string;
  levelNumber: number;
  isCompleted: boolean;
  starsEarned: number;
  isLocked: boolean;
  optimalSteps: number;
  difficulty?: number;
  backdoorAvailable?: boolean;
}

export interface Hint {
  text: string;
  tier: number;
  commandHint?: Command;
  targetPosition?: Point;
  type?: 'move' | 'mechanic' | 'encouragement';
}

export interface Backdoor {
  type: 'drill' | 'hook' | 'bait' | 'wing' | 'sequence';
  description: string;
  steps: Command[];
  starPenalty: number;
}
