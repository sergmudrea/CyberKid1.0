# Changelog

All notable changes to CyberKid will be documented in this file.

## [1.0.0-beta] - Q3 2026 (planned)

### Added
- Full 6 worlds (Meadow, Ocean, Clouds, Fairytale, Volcano, Bonus)
- Arcade with user-generated content
- Sandbox Maker level editor
- Backend microservice for level sharing (arcade-service)
- Multiplayer co-op mode (planned)

### Changed
- Performance optimizations for BFS
- Improved asset loading with placeholders

### Fixed
- Pathfinder teleport validation
- ExecutionEngine loop handling

## [0.5.0-alpha] - Q1 2026

### Added
- All worlds (Meadow through Bonus) with 500+ levels each
- Level generator CLI with BFS validation
- Exploration Mode (P key)
- Hint System (5 tiers)
- Save slots (multiple profiles)
- Export/import progress
- Developer Mode (syntax view, event debug)

### Changed
- Refactored CommandPanel to use native DOM (Capacitor compatibility)
- Improved Pathfinder state space (supports 45+ mechanics)

### Fixed
- Memory leak in LevelMap
- Double event emission in SettingsManager

## [0.1.0-alpha] - Q3 2025

### Added
- Initial prototype (Meadow world only)
- Core mechanics: movement, pits, bricks, coins
- CommandPanel with drag-and-drop
- ExecutionEngine (basic commands)
- Pathfinder (BFS with walls, holes)
- ProgressManager (stars, completion)
- SaveManager (single slot)

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)
