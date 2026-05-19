// scripts/generate-assets.js
// Генератор временных ассетов (изображения и аудио) для разработки.
// Запуск: node scripts/generate-assets.js

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../public/assets');

// Структура папок и файлов
const folders = [
    'tiles',
    'monsters',
    'player',
    'ui',
    'sounds',
    'music'
];

// Тайлы (32x32)
const tiles = [
    'platform', 'sky', 'hole', 'brick', 'wall', 'fake_wall',
    'goal', 'key', 'door_locked', 'door_unlocked',
    'conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right',
    'spring', 'teleport_in', 'teleport_out', 'lava', 'water'
];

// Монстры (32x32)
const monsters = [
    'patrol', 'chase', 'tameable', 'phased', 'zombie', 'boss'
];

// UI (64x64)
const ui = [
    'run', 'clear', 'save', 'load'
];

// Функция создания простого PNG с цветом и текстом
function generateSimplePNG(filePath, width, height, bgColor, text, textColor = '#ffffff') {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    if (text) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.floor(height * 0.6)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, width/2, height/2);
    }
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
}

// Функция создания пустого WAV (тишина)
function generateSilentWAV(filePath, durationSec = 1) {
    // Создаём пустой PCM WAV (8-bit, моно, 8000Hz)
    const sampleRate = 8000;
    const numSamples = sampleRate * durationSec;
    const buffer = Buffer.alloc(44 + numSamples);
    // RIFF chunk
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples, 4);
    buffer.write('WAVE', 8);
    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1 size
    buffer.writeUInt16LE(1, 20); // Audio format (PCM)
    buffer.writeUInt16LE(1, 22); // Num channels (mono)
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate, 28); // Byte rate
    buffer.writeUInt16LE(1, 32); // Block align
    buffer.writeUInt16LE(8, 34); // Bits per sample
    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples, 40);
    // Fill with zeros (silence)
    for (let i = 44; i < buffer.length; i++) buffer[i] = 128;
    fs.writeFileSync(filePath, buffer);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Цвета для тайлов
const tileColors = {
    platform: '#8B5A2B', sky: '#87CEEB', hole: '#000000', brick: '#A52A2A',
    wall: '#555555', fake_wall: '#888888', goal: '#FFD700', key: '#FFD700',
    door_locked: '#8B4513', door_unlocked: '#8B4513', conveyor_up: '#666666',
    conveyor_down: '#666666', conveyor_left: '#666666', conveyor_right: '#666666',
    spring: '#FFA500', teleport_in: '#9370DB', teleport_out: '#9370DB',
    lava: '#FF4500', water: '#1E90FF'
};
const tileSymbols = {
    platform: '□', sky: '○', hole: '●', brick: '■', wall: '█', fake_wall: '?',
    goal: '$', key: '🔑', door_locked: '🔒', door_unlocked: '🔓',
    conveyor_up: '↑', conveyor_down: '↓', conveyor_left: '←', conveyor_right: '→',
    spring: '⤴', teleport_in: '⨀', teleport_out: '⊙', lava: '🔥', water: '💧'
};

// Цвета монстров
const monsterColors = {
    patrol: '#8B008B', chase: '#DC143C', tameable: '#228B22',
    phased: '#C0C0C0', zombie: '#006400', boss: '#8B0000'
};

// Генерация
async function main() {
    console.log('Generating temporary assets...');
    // Проверяем наличие canvas (если не установлен, предложим установить)
    try {
        require('canvas');
    } catch (e) {
        console.error('❌ Node canvas module not found. Please install it: npm install canvas');
        console.error('If you cannot install canvas, you can still use the game because Phaser will generate placeholders at runtime.');
        console.error('But for clean assets, install canvas and run this script again.');
        process.exit(1);
    }

    for (const folder of folders) {
        ensureDir(path.join(ASSETS_DIR, folder));
    }

    // Тайлы
    for (const tile of tiles) {
        const bg = tileColors[tile] || '#CCCCCC';
        const sym = tileSymbols[tile] || tile[0].toUpperCase();
        const filePath = path.join(ASSETS_DIR, 'tiles', `${tile}.png`);
        generateSimplePNG(filePath, 32, 32, bg, sym);
        console.log(`Generated tile: ${tile}.png`);
    }

    // Монстры
    for (const mon of monsters) {
        const bg = monsterColors[mon] || '#CCCCCC';
        const sym = mon[0].toUpperCase();
        const filePath = path.join(ASSETS_DIR, 'monsters', `${mon}.png`);
        generateSimplePNG(filePath, 32, 32, bg, sym);
        console.log(`Generated monster: ${mon}.png`);
    }

    // Игрок (спрайт-лист)
    const playerDir = path.join(ASSETS_DIR, 'player');
    ensureDir(playerDir);
    const playerSpritePath = path.join(playerDir, 'robot.png');
    // Генерация спрайт-листа 12x32x32
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(32*12, 32);
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 12; i++) {
        const x = i * 32;
        let color = '#00BFFF';
        if (i >= 4 && i < 8) color = '#1E90FF';
        if (i >= 8) color = '#FF4500';
        ctx.fillStyle = color;
        ctx.fillRect(x, 0, 32, 32);
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(x + 8, 8, 16, 16);
    }
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(playerSpritePath, buffer);
    console.log('Generated player sprite sheet.');

    // UI кнопки
    for (const btn of ui) {
        const filePath = path.join(ASSETS_DIR, 'ui', `${btn}.png`);
        generateSimplePNG(filePath, 64, 64, '#2a2a4a', btn.toUpperCase(), '#ffffff');
        console.log(`Generated ui: ${btn}.png`);
    }

    // Звуки (пустые WAV)
    const sounds = ['move', 'coin', 'victory', 'death', 'click'];
    for (const snd of sounds) {
        const filePath = path.join(ASSETS_DIR, 'sounds', `${snd}.mp3`);
        generateSilentWAV(filePath, 0.5);
        console.log(`Generated sound: ${snd}.wav as mp3 (placeholder)`);
    }
    // Музыка (тишина)
    const music = ['menu', 'meadow', 'ocean', 'clouds', 'fairytale', 'volcano'];
    for (const m of music) {
        const filePath = path.join(ASSETS_DIR, 'music', `${m}.mp3`);
        generateSilentWAV(filePath, 10);
        console.log(`Generated music: ${m}.wav as mp3 (placeholder)`);
    }

    console.log('✅ All temporary assets generated successfully.');
}

main().catch(console.error);
