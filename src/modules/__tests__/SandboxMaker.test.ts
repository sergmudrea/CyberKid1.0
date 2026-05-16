import { SandboxMaker } from '../SandboxMaker';

describe('SandboxMaker', () => {
  let sandbox: SandboxMaker;

  beforeEach(() => {
    sandbox = new SandboxMaker();
    sandbox.show();
  });

  afterEach(() => {
    sandbox.destroy();
  });

  test('should create DOM elements', () => {
    expect(document.querySelector('.sandbox-maker')).toBeTruthy();
  });

  test('should resize grid and adjust start/coin', () => {
    const widthInput = document.querySelector('#level-width') as HTMLInputElement;
    const heightInput = document.querySelector('#level-height') as HTMLInputElement;
    widthInput.value = '15';
    heightInput.value = '12';
    const resizeBtn = document.querySelector('#resize-btn') as HTMLButtonElement;
    resizeBtn.click();
    expect((sandbox as any).state.level.width).toBe(15);
    expect((sandbox as any).state.level.height).toBe(12);
    const start = (sandbox as any).state.level.startPos;
    const coin = (sandbox as any).state.level.coinPos;
    expect(start.col).toBeLessThan(15);
    expect(start.row).toBeLessThan(12);
    expect(coin.col).toBeLessThan(15);
    expect(coin.row).toBeLessThan(12);
  });

  test('should export level', () => {
    const exportBtn = document.querySelector('#export-btn') as HTMLButtonElement;
    const mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const mockRevoke = jest.spyOn(URL, 'revokeObjectURL');
    exportBtn.click();
    expect(mockCreateObjectURL).toHaveBeenCalled();
    mockRevoke.mockRestore();
  });

  test('should save to local storage', () => {
    const saveBtn = document.querySelector('#save-btn') as HTMLButtonElement;
    const setItemSpy = jest.spyOn(localStorage, 'setItem');
    saveBtn.click();
    expect(setItemSpy).toHaveBeenCalled();
  });

  test('should publish level', () => {
    const publishBtn = document.querySelector('#publish-btn') as HTMLButtonElement;
    const setItemSpy = jest.spyOn(localStorage, 'setItem');
    publishBtn.click();
    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining('arcade_'), expect.any(String));
  });

  test('should clear level', () => {
    const clearBtn = document.querySelector('#clear-level-btn') as HTMLButtonElement;
    window.confirm = jest.fn(() => true);
    clearBtn.click();
    const level = (sandbox as any).state.level;
    expect(level.map.every(row => row.every(cell => cell === 0))).toBe(true);
  });
});
