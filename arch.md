# 🏛️ CyberKid — Complete File Architecture

## 📁 Project Structure Overview

cyberkid/
├── index.html # Entry point
├── package.json # Dependencies & scripts
├── tsconfig.json # TypeScript configuration
├── vite.config.ts # Vite build configuration
├── capacitor.config.ts # Mobile build configuration (Capacitor)
├── manifest.json # PWA manifest
├── sw.js # Service Worker
├── docker-compose.yml # Docker composition
├── nginx.conf # Nginx configuration
│
├── tools/generator/ # Level generation tools (offline)
│ ├── index.ts # CLI entry point
│ ├── levelGenerator.ts # Generate single level
│ ├── pathfinder.ts # BFS with all mechanics
│ ├── config.ts # Difficulty weights
│ ├── fileUtils.ts # Save/load JSON
│ └── preview.html # Visual level preview
│
├── arcade-service/ # Backend microservice (post-MVP)
│ └── src/
│ ├── index.ts # Express server
│ ├── generator.ts # Server-side level pack generator
│ ├── validator.ts # Heavy BFS validation
│ ├── ranking.ts # Level ranking logic
│ └── cron.ts # Daily pack generation
│
├── public/
│ ├── icons/ # PWA icons (72–512px)
│ └── assets/ # Sprites, sounds, fonts (optional)
│
└── src/
├── main.ts # Phaser game entry point
│
├── types/
│ └── index.ts # ALL type definitions (45+ mechanics)
│
├── core/
│ └── EventBus.ts # Central event communication
│
├── data/
│ ├── worlds.json # World configurations
│ └── syntax.json # Command → Python/JS mappings
│
├── managers/
│ ├── SettingsManager.ts # User preferences (lang, sound, mode)
│ ├── ProgressManager.ts # Player progress (stars, levels)
│ ├── LevelManager.ts # Dynamic level loading
│ ├── SaveManager.ts # Program persistence (multiple slots)
│ └── UnlockManager.ts # Purchases & world unlocks
│
├── modules/
│ ├── Pathfinder.ts # BFS pathfinding engine
│ ├── ExecutionEngine.ts # Command execution state machine
│ ├── CommandPanel.ts # Drag-drop command builder UI
│ ├── ExplorationMode.ts # Free roam (P key) with star penalty
│ ├── HintSystem.ts # Auto hints for stuck players
│ ├── SandboxMaker.ts # Visual level editor
│ ├── LevelMap.ts # Tile grid rendering
│ └── Player.ts # Character movement & inventory
│
└── scenes/
├── Preload.ts # Asset loading with progress bar
├── MainMenu.ts # Entry point
├── WorldMap.ts # World selection (circular layout)
├── LevelSelect.ts # Level grid selection
├── GameScene.ts # Main gameplay (integrates all modules)
├── VictoryScreen.ts # Post-level stats & achievements
├── Settings.ts # All game settings
├── Stats.ts # Player statistics
├── Paywall.ts # Premium world purchase
├── SandboxScene.ts # Level editor host
└── ArcadeBrowser.ts # Community levels browser
text


## 📄 FILE-BY-FILE DESCRIPTIONS

### 🟢 ROOT FILES

#### `index.html`
- Entry point for the game
- Mounts Phaser canvas in `<div id="game-container">`
- Meta tags for mobile (viewport, theme-color)
- PWA manifest link
- Global styles for loading and toasts

#### `package.json`
- Dependencies: Phaser 3.80+, Capacitor 6, Vite 5, TypeScript 5, Jest, Workbox, seedrandom
- Scripts: `dev`, `build`, `generate:levels`, `test`, `capacitor:*`
- Jest configuration with coverage thresholds (70%)

#### `tsconfig.json`
- Strict mode enabled
- Module resolution: bundler (Vite)
- Path alias `@/*` → `src/*`
- Target: ES2020

#### `vite.config.ts`
- Vite configuration with aliases
- PWA plugin with Workbox runtime caching
- Base path './' for Capacitor compatibility

#### `capacitor.config.ts`
- App ID: `com.cyberkid.game`
- Web directory: `dist`
- Plugins: SplashScreen, Haptics
- Android: allow mixed content

#### `manifest.json`
- PWA manifest with icons (72–512px)
- Display: standalone
- Theme color: `#0a0a2a`

#### `sw.js`
- Service Worker with cache-first strategy
- Caches core assets and levels
- Automatic cleanup of old caches

#### `docker-compose.yml`
- Production container with Nginx
- Port mapping 8080:80

#### `nginx.conf`
- SPA routing (try_files fallback to index.html)
- Gzip compression
- Cache headers for static assets

### 🛠️ TOOLS/GENERATOR/

#### `index.ts`
- CLI entry point using `commander`
- Example: `npx tsx generator --world meadow --start 1 --count 500`

#### `levelGenerator.ts`
- Core generation pipeline
- Uses seedrandom for deterministic output
- BFS validation with fallback generation

#### `pathfinder.ts`
- Standalone BFS (same as game version)
- Supports walls, holes, keys, doors, monsters, tools

#### `config.ts`
- World-specific configs: grid sizes, difficulty ranges, total levels

#### `fileUtils.ts`
- Ensures output directory exists
- Saves levels as JSON files

#### `preview.html`
- Standalone level viewer (drag-and-drop JSON)
- Does not require Phaser

### 🚀 ARCADE-SERVICE/ (POST-MVP)

*(Structure only; implementation planned for future)*

- **index.ts** – Express server with REST API (publish, featured, popular, search)
- **generator.ts** – Daily pack generator (selects top levels)
- **validator.ts** – Server-side BFS validation for user-submitted levels
- **ranking.ts** – Elo-based ranking for levels
- **cron.ts** – Daily cron job for featured packs

### 🎮 SRC/ — CORE GAME

#### `src/main.ts`

**Purpose:** Phaser game entry point.

**Key responsibilities:**
- Configure Phaser game instance (CANVAS renderer, adaptive sizing)
- Register all scenes (order matters for dependencies)
- Start the game with Preload scene

**Code snippet:**
```typescript
import { Game, Types } from 'phaser';
import { Preload } from './scenes/Preload';
import { MainMenu } from './scenes/MainMenu';
// ... other scenes

const config: Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a2a',
  scene: [Preload, MainMenu, WorldMap, LevelSelect, GameScene, VictoryScreen, Settings, Stats, Paywall, SandboxScene, ArcadeBrowser],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

src/types/index.ts

Purpose: THE FOUNDATION. Every other file imports from here.

Contains (abbreviated):

    enum Command – 45+ commands (movement, loops, conditions, functions, OOP, parallelism, interactions, inventory, time)

    enum TileType – 40+ tile types (platform, sky, hole, brick, wall, conveyor, teleport, key, door, etc.)

    enum MonsterType – patrol, chase, tameable, phased, zombie, boss

    enum LearningMode – kiddo, scholar, dev_student, developer

    interface Inventory – keys, corn, cores, tools

    interface LevelData – complete level JSON schema

    interface PlayerProgress – stars, black stars, level stats, achievements

    interface UserSettings – learning mode, language, sound, vibration

    interface PathResult – BFS result with path, inventory, stars

    interface ExecutionStatus – state machine data

    type GameEvent – all EventBus events

src/core/EventBus.ts

Purpose: Central communication hub. No direct dependencies between modules.

Key features:

    Singleton Phaser EventEmitter wrapper

    emit(event) – dispatch typed events

    on(type, callback) – subscribe

    off(type, callback) – unsubscribe

    once(type, callback) – one-time subscription

    Debug logging (toggleable via setDebug())

Example:
typescript

eventBus.on('LEVEL_COMPLETED', (payload) => {
  console.log(`Level ${payload.levelId} completed with ${payload.stars} stars`);
});

src/data/worlds.json

Purpose: Static world configuration.

Contains per world:

    id, name, nameEn, description, icon

    order, platformColor, skyColor

    levelsCount (500 for main worlds, 3000 for bonus)

    isLocked, priceSku (for paywall)

    difficultyRange, defaultGridSize

Worlds: Meadow, Ocean, Clouds, Fairytale, Volcano, Arcade, Bonus
src/data/syntax.json

Purpose: Maps visual commands to Python/JavaScript syntax for Developer mode.

Contains:

    commands object with icon, labelRu, labelEn, python, js

    learningModeConfig – UI visibility rules per mode

📋 MANAGERS
src/managers/SettingsManager.ts

Purpose: User preferences persistence.

Manages:

    learningMode (kiddo/scholar/dev_student/developer)

    language (ru/en)

    soundEnabled, soundVolume

    musicEnabled, musicVolume

    showTutorials, autoHints, vibrationEnabled

    developerMode

Features:

    Singleton with localStorage persistence

    Type-safe getters/setters (get(), set(key, value), update())

    Observer pattern (subscribe(callback))

    Vibration API wrapper (vibrateShort(), vibrateLong())

    EventBus integration (emits SETTINGS_CHANGED)

src/managers/ProgressManager.ts

Purpose: Track player progress.

Tracks per level:

    Stars (1–3) and black stars

    Attempts, deaths, best steps

    Completion status

    Exploration usage flag

Global tracking:

    Total stars, total black stars

    Worlds unlocked

    Achievements unlocked

    Total play time (seconds)

    Deaths by type (statistics)

Features:

    Singleton with localStorage

    Auto-unlock next world when current completed

    Export/import progress as JSON

    Reset functionality

    EventBus integration (PROGRESS_UPDATED, LEVEL_COMPLETED, WORLD_UNLOCKED, ACHIEVEMENT_UNLOCKED)

src/managers/LevelManager.ts

Purpose: Dynamic level loading.

Features:

    Uses Vite import.meta.glob to scan all JSON files (dev mode)

    Fallback to fetch + manifest for production

    Builds metadata index without loading full levels

    Lazy loads levels on demand

    Caches loaded levels in memory

    Navigation helpers (getNextLevelId, getPreviousLevelId)

    Singleton pattern

src/managers/SaveManager.ts

Purpose: Save/load player programs (command sequences).

Features:

    Multiple save slots (profiles for siblings)

    Save/load per level

    Session state tracking (current world, level, command queue)

    Auto-save (handled by GameScene)

    Export/import all saves as JSON

    Reset all data

    EventBus integration (PROGRAM_SAVED, PROGRAM_LOADED)

src/managers/UnlockManager.ts

Purpose: Handle purchases and world unlocks.

Manages:

    Product catalog (worlds, star packs, remove ads, subscriptions)

    Purchase flow (simulated — ready for real IAP integration)

    Purchase validation

    Subscription management (monthly/yearly with expiry)

    Restore purchases

    Ad control (shouldShowAds())

Features:

    Singleton with localStorage

    EventBus integration (PURCHASE_COMPLETED, PURCHASE_FAILED, RESTORE_PURCHASES_COMPLETE)

🧩 MODULES
src/modules/Pathfinder.ts

Purpose: BFS pathfinding engine.

Key methods:

    findOptimalPath() – returns minimal steps path

    isSolvable() – check if level has any solution

    getOptimalSteps() – for star calculation

    calculateStars() – based on steps, exploration

    getHint() – next move suggestion

Supports: All 45+ mechanics (walls, holes, bricks, conveyors, teleports, monsters, keys/doors, tools, inventory)
src/modules/ExecutionEngine.ts

Purpose: State machine that executes player commands.

States: IDLE → RUNNING → PAUSED → WAITING → FINISHED → FAILED

Executes:

    Movement (with collision detection)

    Control flow (FOR_N, FOR_LOOP, WHILE, IF/ELSE)

    Functions (CALL, DEF, RETURN with call stack)

    OOP (CLASS, NEW, METHOD)

    Parallelism (CLONE, JOIN)

    Interactions (PUSH, THROW, FEED, HOOK, DRILL, BAIT, SCAN)

    Inventory (PICKUP, DROP, USE_KEY)

    Time control (TIME_SLOW, TIME_FAST)

    WAIT

src/modules/CommandPanel.ts

Purpose: Visual command builder UI.

Features:

    Left panel: available command buttons (filtered by level/world)

    Right panel: script area (drag-drop command sequence)

    Drag & drop (add, reorder, delete)

    Four learning modes (Kiddo: icons only → Developer: syntax only)

    Tooltips with explanations

    Highlight currently executing command

    Disabled during execution

src/modules/ExplorationMode.ts

Purpose: Free roam mode (Press P).

Features:

    Ghost mode (player cannot die)

    Monster stasis (frozen, patrol paths visible)

    Item inspection (examine without collecting)

    Star penalty warning (max 2 stars if used)

    Visual indicator

    State restoration on exit

src/modules/HintSystem.ts

Purpose: Auto-hints for stuck players.

Tiered hints (increasing urgency):

    15s: Restless hint (nervous animation trigger)

    30s: Direction hint (which way to move)

    60s: Text hint (mechanic explanation)

    90s: Mechanic hint (level-specific)

    120s: Solution hint (first 3 optimal moves)

Contextual analysis:

    Detect nearby hazards (pits, walls)

    Detect nearby monsters (suggest feed or avoid)

    Check inventory (suggest using items)

    Get next move from Pathfinder

src/modules/SandboxMaker.ts

Purpose: Visual level editor.

Features:

    Tile palette (40+ tile types)

    Object palette (monsters, items, tools)

    Canvas rendering with real-time feedback

    Click/drag painting

    Right-click erase

    Keyboard shortcuts (S=set start, C=set coin)

    Resize grid (5x5 to 20x20)

    Clear level confirmation

    Save to localStorage

    Publish (mark as ready for Arcade)

    Test level (send to SandboxScene)

    Export/Import JSON

src/modules/LevelMap.ts

Purpose: Render tile grid and objects.

Renders:

    40+ tile types (platforms, holes, bricks, walls, conveyors, etc.)

    Objects (keys, doors, teleports, monsters, items)

    Player character (with animations)

    Monster patrol paths (dashed lines, waypoints)

    Ghost mode (semi-transparent monsters)

    Grid overlay

src/modules/Player.ts

Purpose: Player character.

Features:

    Position tracking (col, row)

    Smooth movement animation

    Teleportation with visual effects

    Death flash animation

    Ghost mode (no collision)

    Inventory management (keys, corn, cores, tools)

    Clone management (create, remove, list clones)

    Riding (mount tamed monsters)

🎬 SCENES
src/scenes/Preload.ts

    Asset loading (sprites, sounds, music)

    Placeholder generation (canvas fallbacks)

    CSS injection for UI components

    Manager initialization (async)

    Progress bar, rotating tips, blinking logo

src/scenes/MainMenu.ts

    Animated gradient background + stars

    Floating code elements ({ }, < />, for, if, while, class)

    Logo with blinking robot eyes

    Menu buttons: New Game, Continue, Statistics, Settings, Credits

    Continue with last played level

    Developer mode (5 clicks on version text)

src/scenes/WorldMap.ts

    Circular world layout (7 worlds)

    World nodes with icons, names, stars

    Lock icons + price tags for premium worlds

    Floating animation on nodes

    Hover/tap info panel

    Purchase dialog (Paywall integration)

    Play button (opens LevelSelect)

src/scenes/LevelSelect.ts

    Scrollable grid of level buttons (5×4 = 20 per page)

    Stars display (earned/max)

    Black stars (backdoor achievements)

    Lock system (sequential unlock)

    Saved program indicator (💾)

    Reset world progress button

    Info panel with level stats

src/scenes/GameScene.ts

    Main gameplay — integrates all modules

    Loads level (by ID or direct LevelData)

    Loads saved program

    Runs program, handles victory/defeat

    Manages Exploration Mode

    Saves progress on completion

src/scenes/VictoryScreen.ts

    Stars animation (earned stars pulse)

    Black star display

    Statistics (steps used vs optimal, efficiency)

    New achievements toast

    World unlock notification

    Buttons: Next Level, Replay, Main Menu

src/scenes/Settings.ts

    Tabs: Game, Audio, Data, Developer

    Game: learning mode, language, tutorials, auto-hints, vibration

    Audio: sound toggle/volume, music toggle/volume

    Data: export progress, import progress, reset all data

    Dev: developer mode toggle, clear level cache, event debug

src/scenes/Stats.ts

    Overview tab: total stars, black stars, levels completed, attempts, deaths, etc.

    Worlds tab: per-world progress bars, stars, completion percentage

    Achievements tab: list of all achievements with locked/unlocked status

    Share statistics (copy to clipboard / Web Share API)

src/scenes/Paywall.ts

    Premium world purchase screen

    Displays world info (icon, name, description, price)

    Purchase button (integrates UnlockManager)

    Restore purchases button

    Loading overlay during purchase

src/scenes/SandboxScene.ts

    Hosts SandboxMaker editor

    Handles test mode (starts GameScene with test level)

src/scenes/ArcadeBrowser.ts

    Tabs: Featured, New, Top Rated, My Levels

    Search by title, filter by difficulty

    Level cards with title, author, stars, likes, plays, difficulty

    Pagination (6 levels per page)

    Play button (passes LevelData to GameScene)

📊 DEPENDENCY MAP
text

GameScene
├── LevelManager (loads level)
├── SaveManager (loads program)
├── ProgressManager (saves progress)
├── LevelMap (rendering)
├── Player (character)
├── CommandPanel (UI)
├── ExecutionEngine (runs commands)
├── Pathfinder (star calculation)
├── HintSystem (auto-hints)
└── ExplorationMode (free roam)

CommandPanel
├── SettingsManager (learning mode, language)
├── EventBus (program changes)
├── syntax.json (icons, translations)

ExecutionEngine
├── LevelMap (tile data)
├── Player (movement)
└── EventBus (events)

Pathfinder
├── LevelData (map, objects)
└── BFS algorithm

SettingsManager / ProgressManager / SaveManager / UnlockManager
├── localStorage (persistence)
└── EventBus (events)

MainMenu / WorldMap / LevelSelect / VictoryScreen / Settings / Stats / Paywall / SandboxScene / ArcadeBrowser
├── Scene transitions
└── EventBus (language changes, progress updates)

🧪 TESTING STRATEGY
Unit Tests (Jest)

    Managers: all public methods, localStorage mocking

    Modules: Pathfinder BFS, ExecutionEngine commands, Player movement, LevelMap rendering

    Scenes: scene creation, navigation, event handlers

Coverage Thresholds (≥70%)

    Branches: 70%

    Functions: 70%

    Lines: 70%

    Statements: 70%

Test Files Location

    src/**/__tests__/*.test.ts

🔧 CONFIGURATION FILES SPECIFICATIONS
Level JSON Schema
json

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "worldId", "levelNumber", "width", "height", "map", "objects", "startPos", "coinPos"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z]+_[0-9]{3}$" },
    "name": { "type": "string" },
    "worldId": { "type": "string", "enum": ["meadow", "ocean", "clouds", "fairytale", "volcano", "arcade", "bonus"] },
    "levelNumber": { "type": "integer", "minimum": 1 },
    "width": { "type": "integer", "minimum": 5, "maximum": 20 },
    "height": { "type": "integer", "minimum": 5, "maximum": 20 },
    "map": { "type": "array", "items": { "type": "array", "items": { "type": "integer" } } },
    "startPos": { "$ref": "#/definitions/point" },
    "coinPos": { "$ref": "#/definitions/point" },
    "optimalSteps": { "type": "integer" },
    "solutions": { "$ref": "#/definitions/solutions" }
  }
}

✅ COMPLETE FILE COUNT
Category	Count
Root config files	9
Tools (generator)	6
Arcade service	5 (post-MVP)
Core	2
Data	2
Managers	5
Modules	8
Scenes	11
TOTAL	48 files

This architecture document reflects the complete implementation of CyberKid as specified in the technical requirements and README.
