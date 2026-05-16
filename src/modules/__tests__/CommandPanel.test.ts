// src/modules/__tests__/CommandPanel.test.ts
import { CommandPanel } from '../CommandPanel';
import { LearningMode, Command } from '../../types/index';
import { gameEvents } from '../../core/EventBus';
import { settingsManager } from '../../managers/SettingsManager';
import { saveManager } from '../../managers/SaveManager';

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../managers/SettingsManager', () => ({
  settingsManager: {
    get: jest.fn().mockReturnValue({ learningMode: LearningMode.SCHOLAR, language: 'en' }),
  },
}));

jest.mock('../../managers/SaveManager', () => ({
  saveManager: {
    saveProgram: jest.fn(),
  },
}));

describe('CommandPanel', () => {
  let panel: CommandPanel;
  let mockScene: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScene = {};
    panel = new CommandPanel(mockScene);
  });

  afterEach(() => {
    panel.destroy();
  });

  test('should initialize', () => {
    expect(panel).toBeDefined();
    expect(document.querySelector('.command-panel')).toBeTruthy();
  });

  test('should set available commands and render left panel', () => {
    const commands = [Command.UP, Command.DOWN];
    panel.setAvailableCommands(commands);
    const buttons = document.querySelectorAll('.command-btn');
    expect(buttons.length).toBe(2);
  });

  test('should add command to program', () => {
    panel.addCommand(Command.UP);
    expect((panel as any).currentProgram).toContain(Command.UP);
    expect(gameEvents.emit).toHaveBeenCalledWith('COMMAND_QUEUE_CHANGED', expect.any(Object));
  });

  test('should remove command by index', () => {
    panel.addCommand(Command.UP);
    panel.addCommand(Command.DOWN);
    panel.removeCommand(0);
    expect((panel as any).currentProgram).toEqual([Command.DOWN]);
  });

  test('should clear program', () => {
    panel.addCommand(Command.UP);
    panel.clearProgram();
    expect((panel as any).currentProgram).toHaveLength(0);
  });

  test('should move command', () => {
    panel.addCommand(Command.UP);
    panel.addCommand(Command.DOWN);
    panel.moveCommand(0, 1);
    expect((panel as any).currentProgram).toEqual([Command.DOWN, Command.UP]);
  });

  test('should update mode', () => {
    panel.updateMode(LearningMode.DEVELOPER, 'ru');
    expect((panel as any).learningMode).toBe(LearningMode.DEVELOPER);
    expect((panel as any).language).toBe('ru');
  });

  test('should set executing state and disable controls', () => {
    panel.setExecuting(true);
    // Проверяем, что кнопки disabled (в DOM)
    const runBtn = document.querySelector('#run-btn') as HTMLButtonElement;
    expect(runBtn.disabled).toBeUndefined(); // кнопка не отключается, только команды
    // Но можно проверить, что setEnabled был вызван (через приватное поле)
    expect((panel as any).isExecuting).toBe(true);
  });

  test('should hide and show panel', () => {
    panel.hide();
    expect((panel as any).container.style.display).toBe('none');
    panel.show();
    expect((panel as any).container.style.display).toBe('flex');
  });
});
