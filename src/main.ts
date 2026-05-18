// src/main.ts
// Точка входа в игру CyberKid

import { Game, Types } from 'phaser';
import { Preload } from './scenes/Preload';
import { MainMenu } from './scenes/MainMenu';
import { WorldMap } from './scenes/WorldMap';
import { LevelSelect } from './scenes/LevelSelect';
import { GameScene } from './scenes/GameScene';
import { VictoryScreen } from './scenes/VictoryScreen';
import { Settings } from './scenes/Settings';
import { Stats } from './scenes/Stats';
import { Paywall } from './scenes/Paywall';
import { SandboxScene } from './scenes/SandboxScene';
import { ArcadeBrowser } from './scenes/ArcadeBrowser';

const config: Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a2a',
  parent: 'game-container',
  scene: [
    Preload,
    MainMenu,
    WorldMap,
    LevelSelect,
    GameScene,
    VictoryScreen,
    Settings,
    Stats,
    Paywall,
    SandboxScene,
    ArcadeBrowser,
  ],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
  roundPixels: true,
};

window.addEventListener('load', () => {
  const game = new Game(config);
});
