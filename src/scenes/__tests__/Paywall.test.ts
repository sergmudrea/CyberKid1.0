import { Paywall } from '../Paywall';
import { unlockManager } from '../../managers/UnlockManager';
import { progressManager } from '../../managers/ProgressManager';
import { settingsManager } from '../../managers/SettingsManager';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../managers/UnlockManager');
jest.mock('../../managers/ProgressManager');
jest.mock('../../managers/SettingsManager');
jest.mock('../../core/EventBus');

describe('Paywall Scene', () => {
  let paywall: Paywall;

  beforeEach(() => {
    paywall = new Paywall();
    paywall.scene = { start: jest.fn() } as any;
    paywall.cameras = { main: { width: 800, height: 600 } } as any;
    paywall.add = {
      graphics: jest.fn().mockReturnValue({ fillGradientStyle: jest.fn(), fillRect: jest.fn() }),
      text: jest.fn().mockReturnValue({
        setOrigin: jest.fn(),
        setInteractive: jest.fn(),
        on: jest.fn(),
        setColor: jest.fn(),
        setBackgroundColor: jest.fn(),
        disableInteractive: jest.fn(),
      }),
      container: jest.fn().mockReturnValue({ add: jest.fn() }),
    } as any;
    (settingsManager.get as jest.Mock).mockReturnValue({ language: 'en' });
    (unlockManager.getProduct as jest.Mock).mockReturnValue({ sku: 'world_ocean', title: 'Ocean', description: 'Ocean world', price: '$2.99' });
    paywall.events = { once: jest.fn() };
    paywall.init({ worldId: 'ocean', sku: 'world_ocean' });
    paywall.create();
  });

  test('should create paywall screen', () => {
    expect(paywall).toBeDefined();
  });

  test('should attempt purchase', async () => {
    (unlockManager.purchase as jest.Mock).mockResolvedValue(true);
    await paywall['purchase']();
    expect(unlockManager.purchase).toHaveBeenCalledWith('world_ocean');
    expect(progressManager.unlockWorld).toHaveBeenCalledWith('ocean');
    expect(paywall.scene.start).toHaveBeenCalledWith('WorldMap');
  });

  test('should handle purchase failure', async () => {
    (unlockManager.purchase as jest.Mock).mockResolvedValue(false);
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    await paywall['purchase']();
    expect(unlockManager.purchase).toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Purchase failed'));
    alertMock.mockRestore();
  });

  test('should restore purchases', async () => {
    (unlockManager.restorePurchases as jest.Mock).mockResolvedValue(undefined);
    (progressManager.isWorldUnlocked as jest.Mock).mockReturnValue(true);
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    await paywall['restorePurchases']();
    expect(unlockManager.restorePurchases).toHaveBeenCalled();
    expect(paywall.scene.start).toHaveBeenCalledWith('WorldMap');
    alertMock.mockRestore();
  });

  test('should not show success alert if world already unlocked during restore', async () => {
    (unlockManager.restorePurchases as jest.Mock).mockResolvedValue(undefined);
    (progressManager.isWorldUnlocked as jest.Mock).mockReturnValue(false);
    (unlockManager.isWorldUnlocked as jest.Mock).mockReturnValue(false);
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    await paywall['restorePurchases']();
    expect(unlockManager.restorePurchases).toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('No purchases found'));
    alertMock.mockRestore();
  });
});
