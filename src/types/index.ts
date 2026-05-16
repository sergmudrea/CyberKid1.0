// src/types/index.ts
// Эйдо: Ядро типов CyberKid. Никакой циклической зависимости, только чистые интерфейсы.

export type Command =
  | 'move_up'
  | 'move_down'
  | 'move_left'
  | 'move_right'
  | 'jump'
  | 'wait'
  | 'turn_clockwise'
  | 'turn_counterclockwise'
  | 'repeat_start'
  | 'repeat_end'
  | 'function_call'
  | 'function_define';

// Перечисление типов тайлов (TileType) для генерации карты и логики
export const TileType = {
  EMPTY: 0,
  WALL: 1,
  GOAL: 2,
  START: 3,
  KEY: 4,
  DOOR: 5,
  TELEPORT_IN: 6,
  TELEPORT_OUT: 7,
  MONSTER_STATIC: 8,
  MONSTER_PATROL: 9,
  LAVA: 10,
  WATER: 11,
  BUTTON: 12,
  BRIDGE: 13,
} as const;

export type TileTypeValue = typeof TileType[keyof typeof TileType];

// Интерфейс для точки на сетке
export interface Point {
  x: number;
  y: number;
}

// Интерфейс для телепорта (связь входа и выхода)
export interface TeleportPair {
  entry: Point;
  exit: Point;
}

// Игровой объект, размещаемый динамически (ключи, монстры, кнопки)
export interface DynamicEntity {
  id: string;
  type: 'key' | 'door' | 'monster' | 'button' | 'bridge';
  position: Point;
  state?: any; // для монстров: направление, патруль и т.п.
}

// Данные одного уровня (хранятся в JSON, загружаются из CDN или локально)
export interface LevelData {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  grid: TileTypeValue[][];          // основная сетка (статичные тайлы)
  entities: DynamicEntity[];        // динамические сущности поверх сетки
  teleports: TeleportPair[];
  requiredCommands?: Command[];      // обязательные команды для выполнения (опционально)
  maxCommandCount?: number;          // ограничение на количество команд (для задач)
  isTutorial: boolean;
  initialCode?: Command[];           // стартовый код для обучения
}

// Состояние игрока на уровне (прогресс, собранные предметы, открытые двери)
export interface LevelState {
  levelId: string;
  robotPosition: Point;
  robotDirection: 'up' | 'down' | 'left' | 'right';
  collectedKeys: string[];           // id собранных ключей
  openedDoors: string[];             // id открытых дверей
  activeBridges: string[];           // id активированных мостов
  isCompleted: boolean;
  starEarned: boolean;               // звезда за оптимальность
  commandsExecuted: number;
  executionLog: string[];            // лог выполнения для отладки
}

// Профиль пользователя (сохраняется в localStorage/IndexedDB)
export interface UserProfile {
  uid: string;
  displayName: string;
  experience: number;                // опыт за пройденные уровни
  starsTotal: number;
  levelsCompleted: string[];
  currentLevelId: string;
  lastPlayed: number;                // timestamp
  settings: UserSettings;
  inventory: InventoryItem[];
}

export interface UserSettings {
  soundEnabled: boolean;
  musicVolume: number;               // 0..1
  sfxVolume: number;
  vibrationEnabled: boolean;         // для Android
  kidMode: boolean;                  // режим "Kiddo" — упрощённый интерфейс
  developerMode: boolean;            // режим "Developer" — метрики, консоль
}

export interface InventoryItem {
  type: 'key' | 'star' | 'boost';
  id: string;
  acquiredAt: number;
}

// Структура для монетизации (Google Play Billing / адаптивные подписки)
export interface Product {
  sku: string;
  type: 'consumable' | 'non_consumable' | 'subscription';
  price: string;                     // локализованная цена
  title: string;
  description: string;
}

export interface PurchaseData {
  sku: string;
  purchaseToken: string;
  signature: string;
  originalJson: string;
  isAcknowledged: boolean;
}

// Конфигурация игры (статические настройки)
export interface GameConfig {
  version: string;
  gridSize: number;                  // размер тайла в px (например, 48)
  defaultZoom: number;
  maxUndoSteps: number;
  autoSaveIntervalMs: number;
  levelPacks: LevelPack[];
}

export interface LevelPack {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  levels: string[];                  // id уровней
  isPremium: boolean;
  priceSku?: string;                 // если платный
}

// Результат валидации пути (от Pathfinder)
export interface PathResult {
  path: Point[];
  isValid: boolean;
  errorMessage?: string;
  stepsCount: number;
  collectedItems: string[];
  killedMonsters: boolean;           // если робот наступил на монстра -> проигрыш
  fellIntoLava: boolean;
}

// Статус выполнения всей программы (ExecutionEngine)
export interface ExecutionStatus {
  state: 'idle' | 'running' | 'paused' | 'finished' | 'error';
  currentCommandIndex: number;
  totalCommands: number;
  cycleCount: number;
  lastError?: string;
}

// Типы для событий EventBus (слабосвязанная коммуникация между модулями)
export type GameEvent =
  | { type: 'LEVEL_LOADED'; payload: { levelId: string } }
  | { type: 'LEVEL_COMPLETED'; payload: { levelId: string; stars: number } }
  | { type: 'COMMAND_QUEUE_CHANGED'; payload: { commands: Command[] } }
  | { type: 'EXECUTION_START' }
  | { type: 'EXECUTION_STEP'; payload: { robotPos: Point } }
  | { type: 'EXECUTION_FINISHED'; payload: { success: boolean } }
  | { type: 'PROFILE_UPDATED'; payload: UserProfile }
  | { type: 'PURCHASE_COMPLETED'; payload: { sku: string } }
  | { type: 'SETTINGS_CHANGED'; payload: UserSettings };
