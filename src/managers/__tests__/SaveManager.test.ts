// src/managers/__tests__/SaveManager.test.ts
import { SaveManager, SaveSlotMeta, ProgramSaveData } from '../SaveManager';
import { Command } from '../../types/index';
import { gameEvents } from '../../core/EventBus';

// Мокаем localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    length: 0,
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

describe('SaveManager', () => {
  let saveManager: SaveManager;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    SaveManager.resetInstance();
    saveManager = SaveManager.getInstance();
  });

  afterEach(() => {
    saveManager.resetAllData();
    SaveManager.resetInstance();
  });

  test('should create a new slot', () => {
    const slot = saveManager.createSlot('Test Slot', 'test_slot_1');
    expect(slot.id).toBe('test_slot_1');
    expect(slot.name).toBe('Test Slot');
    const slots = saveManager.getAllSlots();
    expect(slots).toHaveLength(2); // default + new
    expect(slots.find(s => s.id === 'test_slot_1')).toBeDefined();
  });

  test('should set current slot', () => {
    saveManager.createSlot('Another', 'another_slot');
    const result = saveManager.setCurrentSlot('another_slot');
    expect(result).toBe(true);
    const current = saveManager.getCurrentSlot();
    expect(current?.id).toBe('another_slot');
  });

  test('should delete slot and its programs', () => {
    saveManager.createSlot('ToDelete', 'to_del');
    saveManager.setCurrentSlot('to_del');
    saveManager.saveProgram('level_1', [Command.UP, Command.DOWN]);
    expect(saveManager.hasSavedProgram('level_1')).toBe(true);
    const result = saveManager.deleteSlot('to_del');
    expect(result).toBe(true);
    expect(saveManager.hasSavedProgram('level_1')).toBe(false);
    expect(saveManager.getCurrentSlot()?.id).not.toBe('to_del');
  });

  test('should save and load program', () => {
    saveManager.createSlot('Programmer', 'prog_slot');
    saveManager.setCurrentSlot('prog_slot');
    const commands: Command[] = [Command.LEFT, Command.RIGHT, Command.FOR_N];
    saveManager.saveProgram('meadow_001', commands);
    const loaded = saveManager.loadProgram('meadow_001');
    expect(loaded).toEqual(commands);
    expect(saveManager.hasSavedProgram('meadow_001')).toBe(true);
  });

  test('should delete program', () => {
    saveManager.createSlot('Deleter', 'del_slot');
    saveManager.setCurrentSlot('del_slot');
    saveManager.saveProgram('level_x', [Command.UP]);
    expect(saveManager.hasSavedProgram('level_x')).toBe(true);
    saveManager.deleteProgram('level_x');
    expect(saveManager.hasSavedProgram('level_x')).toBe(false);
  });

  test('should save and load session state', () => {
    saveManager.createSlot('SessionUser', 'session_slot');
    saveManager.setCurrentSlot('session_slot');
    saveManager.saveSessionState('volcano', 'volcano_042', [Command.WAIT, Command.CLONE]);
    const session = saveManager.loadSessionState();
    expect(session?.currentWorldId).toBe('volcano');
    expect(session?.currentLevelId).toBe('volcano_042');
    expect(session?.commandQueue).toEqual([Command.WAIT, Command.CLONE]);
    // Проверяем, что метаданные слота обновились
    const slot = saveManager.getCurrentSlot();
    expect(slot?.lastWorldId).toBe('volcano');
    expect(slot?.lastLevelId).toBe('volcano_042');
  });

  test('should update current level and world', () => {
    saveManager.createSlot('Updater', 'upd_slot');
    saveManager.setCurrentSlot('upd_slot');
    saveManager.updateCurrentLevel('clouds_100', 'clouds');
    const slot = saveManager.getCurrentSlot();
    expect(slot?.lastLevelId).toBe('clouds_100');
    expect(slot?.lastWorldId).toBe('clouds');
  });

  test('should export and import all data', () => {
    saveManager.createSlot('ExportSlot', 'exp_slot');
    saveManager.setCurrentSlot('exp_slot');
    saveManager.saveProgram('export_level', [Command.DRILL, Command.HOOK]);
    const exported = saveManager.exportAllData();
    saveManager.resetAllData();
    expect(saveManager.hasSavedProgram('export_level')).toBe(false);
    const result = saveManager.importAllData(exported);
    expect(result).toBe(true);
    const slots = saveManager.getAllSlots();
    expect(slots.some(s => s.id === 'exp_slot')).toBe(true);
    saveManager.setCurrentSlot('exp_slot');
    const loaded = saveManager.loadProgram('export_level');
    expect(loaded).toEqual([Command.DRILL, Command.HOOK]);
  });

  test('should reset all data', () => {
    saveManager.createSlot('ResetMe', 'reset_slot');
    saveManager.setCurrentSlot('reset_slot');
    saveManager.saveProgram('any', [Command.WING]);
    expect(saveManager.getAllSlots().length).toBeGreaterThan(1);
    saveManager.resetAllData();
    expect(saveManager.getAllSlots()).toHaveLength(1);
    expect(saveManager.getCurrentSlot()?.id).toBe('slot_default');
    expect(saveManager.hasSavedProgram('any')).toBe(false);
  });
});
