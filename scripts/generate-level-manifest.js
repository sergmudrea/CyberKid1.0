// scripts/generate-level-manifest.js
// ПРОМЕТЕЙ: Генератор манифеста уровней для production-сборки.
// Сканирует директорию src/levels/**/*.json, извлекает метаданные и создаёт
// public/levels-manifest.json, который используется LevelManager для загрузки уровней.
// Запуск: node scripts/generate-level-manifest.js

const fs = require('fs');
const path = require('path');

// Конфигурация
const LEVELS_SRC_DIR = path.join(__dirname, '../src/levels');
const OUTPUT_MANIFEST_PATH = path.join(__dirname, '../public/levels-manifest.json');

// Поддерживаемые миры (порядок важен для сортировки)
const WORLDS_ORDER = ['meadow', 'ocean', 'clouds', 'fairytale', 'volcano', 'arcade', 'bonus'];

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getAllLevelFiles(baseDir, relativePath = '') {
  let results = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    const relPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllLevelFiles(fullPath, relPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
    }
  }
  return results;
}

function extractLevelMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return {
      id: data.id,
      worldId: data.worldId,
      levelNumber: data.levelNumber,
      name: data.name,
      isTutorial: data.isTutorial || false,
      optimalSteps: data.optimalSteps,
    };
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err.message);
    return null;
  }
}

function generateManifest() {
  console.log('Scanning levels in:', LEVELS_SRC_DIR);
  if (!fs.existsSync(LEVELS_SRC_DIR)) {
    console.error(`Directory not found: ${LEVELS_SRC_DIR}`);
    process.exit(1);
  }

  const levelFiles = getAllLevelFiles(LEVELS_SRC_DIR);
  console.log(`Found ${levelFiles.length} JSON files.`);

  const levels = [];
  const worldsMap = new Map(); // worldId -> list of level ids

  for (const { fullPath, relPath } of levelFiles) {
    const meta = extractLevelMetadata(fullPath);
    if (!meta) continue;

    // Определяем путь для fetch (относительно корня сайта)
    const fetchPath = `/levels/${relPath}`;

    const entry = {
      id: meta.id,
      worldId: meta.worldId,
      levelNumber: meta.levelNumber,
      name: meta.name,
      isTutorial: meta.isTutorial,
      optimalSteps: meta.optimalSteps,
      path: fetchPath,
    };
    levels.push(entry);

    if (!worldsMap.has(meta.worldId)) {
      worldsMap.set(meta.worldId, []);
    }
    worldsMap.get(meta.worldId).push(meta.id);
  }

  // Сортировка уровней в каждом мире по levelNumber
  for (const [worldId, ids] of worldsMap.entries()) {
    ids.sort((a, b) => {
      const aNum = levels.find(l => l.id === a)?.levelNumber ?? 0;
      const bNum = levels.find(l => l.id === b)?.levelNumber ?? 0;
      return aNum - bNum;
    });
  }

  // Сортировка миров по порядку (meadow, ocean, ...)
  const worldsSorted = {};
  for (const worldId of WORLDS_ORDER) {
    if (worldsMap.has(worldId)) {
      worldsSorted[worldId] = worldsMap.get(worldId);
    }
  }
  // Добавляем оставшиеся миры, которые не в порядке (на всякий случай)
  for (const [worldId, ids] of worldsMap.entries()) {
    if (!worldsSorted[worldId]) {
      worldsSorted[worldId] = ids;
    }
  }

  const manifest = {
    version: '1.0',
    levels: levels,
    worlds: worldsSorted,
  };

  ensureDirectoryExists(path.dirname(OUTPUT_MANIFEST_PATH));
  fs.writeFileSync(OUTPUT_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to ${OUTPUT_MANIFEST_PATH}`);
  console.log(`Total levels: ${levels.length}`);
  console.log(`Worlds: ${Object.keys(worldsSorted).join(', ')}`);
}

// Запуск
generateManifest();
