// src/__mocks__/phaser.ts
// ПРОМЕТЕЙ: Полный мок для Phaser, используемый в тестах.
// Имитирует основные классы и методы, чтобы Jest не падал на импортах.

export const Scene = class {
  add: any = {};
  cameras: any = { main: { width: 800, height: 600 } };
  tweens: any = { add: jest.fn() };
  time: any = { delayedCall: jest.fn() };
  scene: any = { start: jest.fn(), restart: jest.fn() };
  sound: any = { get: jest.fn().mockReturnValue({ play: jest.fn() }) };
  events: any = { once: jest.fn(), off: jest.fn() };
  input: any = { keyboard: { on: jest.fn() } };
  load: any = {
    on: jest.fn(),
    image: jest.fn(),
    spritesheet: jest.fn(),
    audio: jest.fn(),
  };
  textures: any = { exists: jest.fn().mockReturnValue(false), addImage: jest.fn() };
  anims: any = { exists: jest.fn().mockReturnValue(false), create: jest.fn(), generateFrameNumbers: jest.fn() };
};

export const Game = class {};

export const GameObjects = {
  Container: class {},
  Graphics: class {
    fillGradientStyle = jest.fn().mockReturnThis();
    fillRect = jest.fn().mockReturnThis();
    clear = jest.fn().mockReturnThis();
    lineStyle = jest.fn().mockReturnThis();
    moveTo = jest.fn().mockReturnThis();
    lineTo = jest.fn().mockReturnThis();
    strokePath = jest.fn().mockReturnThis();
    destroy = jest.fn();
  },
  Sprite: class {
    setOrigin = jest.fn().mockReturnThis();
    setDisplaySize = jest.fn().mockReturnThis();
    setPosition = jest.fn().mockReturnThis();
    setVisible = jest.fn().mockReturnThis();
    setAlpha = jest.fn().mockReturnThis();
    setTint = jest.fn().mockReturnThis();
    clearTint = jest.fn().mockReturnThis();
    destroy = jest.fn();
  },
  Text: class {
    setOrigin = jest.fn().mockReturnThis();
    setInteractive = jest.fn().mockReturnThis();
    on = jest.fn().mockReturnThis();
    setColor = jest.fn().mockReturnThis();
    setBackgroundColor = jest.fn().mockReturnThis();
    setText = jest.fn().mockReturnThis();
    destroy = jest.fn();
  },
  Rectangle: class {
    setOrigin = jest.fn().mockReturnThis();
    setStrokeStyle = jest.fn().mockReturnThis();
    setInteractive = jest.fn().mockReturnThis();
    on = jest.fn().mockReturnThis();
    destroy = jest.fn();
  },
  Container: class {
    add = jest.fn().mockReturnThis();
    removeAll = jest.fn().mockReturnThis();
    destroy = jest.fn();
    setMask = jest.fn();
  },
};

export default { Scene, Game, GameObjects };
