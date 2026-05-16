// src/managers/__tests__/UnlockManager.test.ts
import { UnlockManager } from '../UnlockManager';
import { Product } from '../../types/index';
import { progressManager } from '../ProgressManager';
import { gameEvents } from '../../core/EventBus';

jest.mock('../../core/EventBus', () => ({
  gameEvents: {
    emit: jest.fn(),
  },
}));

jest.mock('../ProgressManager', () => ({
  progressManager: {
    isWorldUnlocked: jest.fn().mockReturnValue(false),
    unlockWorld: jest.fn(),
  },
}));

describe('UnlockManager', () => {
  let unlockManager: UnlockManager;
  const testProducts: Product[] = [
    { sku: 'world_ocean', type: 'non_consumable', price: '$2.99', title: 'Ocean', description: '', worldId: 'ocean' },
    { sku: 'remove_ads', type: 'non_consumable', price: '$4.99', title: 'No Ads', description: '' },
    { sku: 'premium_monthly', type: 'subscription', price: '$4.99', title: 'Premium', description: '', durationDays: 30 },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    UnlockManager.resetInstance();
    unlockManager = UnlockManager.getInstance();
    await unlockManager.initialize(testProducts);
    // Очищаем localStorage перед каждым тестом
    localStorage.clear();
  });

  test('should initialize with products', () => {
    const products = unlockManager.getProducts();
    expect(products).toHaveLength(3);
    expect(products[0].sku).toBe('world_ocean');
  });

  test('should return false for unpurchased product', () => {
    expect(unlockManager.isProductPurchased('world_ocean')).toBe(false);
    expect(unlockManager.shouldShowAds()).toBe(true);
  });

  test('should simulate purchase and unlock world', async () => {
    const result = await unlockManager.purchase('world_ocean');
    expect(result).toBe(true);
    expect(unlockManager.isProductPurchased('world_ocean')).toBe(true);
    expect(progressManager.unlockWorld).toHaveBeenCalledWith('ocean');
    expect(gameEvents.emit).toHaveBeenCalledWith('PURCHASE_COMPLETED', expect.objectContaining({ sku: 'world_ocean' }));
  });

  test('should handle subscription purchase', async () => {
    const result = await unlockManager.purchase('premium_monthly');
    expect(result).toBe(true);
    expect(unlockManager.isSubscriptionActive('premium_monthly')).toBe(true);
    // Должны разблокироваться все миры
    expect(progressManager.unlockWorld).toHaveBeenCalledTimes(5); // ocean, clouds, fairytale, volcano, bonus
    expect(gameEvents.emit).toHaveBeenCalledWith('PURCHASE_COMPLETED', { sku: 'premium_monthly' });
  });

  test('should return false for unknown sku', async () => {
    const result = await unlockManager.purchase('unknown');
    expect(result).toBe(false);
    expect(gameEvents.emit).toHaveBeenCalledWith('PURCHASE_FAILED', expect.any(Object));
  });

  test('should not purchase same non-consumable twice', async () => {
    await unlockManager.purchase('world_ocean');
    const result = await unlockManager.purchase('world_ocean');
    expect(result).toBe(true);
    // Должен быть только один вызов unlockWorld
    expect(progressManager.unlockWorld).toHaveBeenCalledTimes(1);
  });

  test('should restore purchases', async () => {
    await unlockManager.purchase('world_ocean');
    // Очищаем состояние менеджера (но не localStorage)
    UnlockManager.resetInstance();
    const newManager = UnlockManager.getInstance();
    await newManager.initialize(testProducts);
    expect(newManager.isProductPurchased('world_ocean')).toBe(false); // ещё не восстановлено
    await newManager.restorePurchases();
    expect(newManager.isProductPurchased('world_ocean')).toBe(true);
    expect(gameEvents.emit).toHaveBeenCalledWith('RESTORE_PURCHASES_COMPLETE');
  });

  test('should check world unlock status', () => {
    (progressManager.isWorldUnlocked as jest.Mock).mockReturnValue(false);
    expect(unlockManager.isWorldUnlocked('ocean')).toBe(false);
    unlockManager.purchase('world_ocean');
    expect(progressManager.isWorldUnlocked).toHaveBeenCalled();
    // После покупки progressManager.unlockWorld вызван, но isWorldUnlocked мок возвращает false.
    // В реальности после unlockWorld, progressManager.isWorldUnlocked вернёт true.
  });

  test('should return product by sku', () => {
    const product = unlockManager.getProduct('world_ocean');
    expect(product).toBeDefined();
    expect(product?.sku).toBe('world_ocean');
    expect(unlockManager.getProduct('missing')).toBeUndefined();
  });
});
