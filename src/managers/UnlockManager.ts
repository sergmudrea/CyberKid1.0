// src/managers/UnlockManager.ts
// ПРОМЕТЕЙ: Упрощённая версия с симуляцией для локальной разработки.
// Импорт реального плагина закомментирован, так как он не установлен.
// Для production нужно установить @cap-js/billing и раскомментировать.

import { Product, PurchaseData, Subscription } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from './ProgressManager';
import { settingsManager } from './SettingsManager';
import { Capacitor } from '@capacitor/core';

// Реальный плагин пока отключён для локальной разработки
// import { Billing } from '@cap-js/billing';

const STORAGE_PURCHASES_KEY = 'cyberkid_purchases';
const STORAGE_SUBSCRIPTIONS_KEY = 'cyberkid_subscriptions';

export interface PurchasedProduct {
  sku: string;
  purchaseDate: number;
  purchaseToken: string;
  isAcknowledged: boolean;
  transactionId?: string;
}

export class UnlockManager {
  private static instance: UnlockManager;
  private products: Product[] = [];
  private purchases: PurchasedProduct[] = [];
  private subscriptions: Subscription[] = [];
  private initialized: boolean = false;
  private useSimulation: boolean = true; // Пока всегда симуляция

  private constructor() {}

  public static getInstance(): UnlockManager {
    if (!UnlockManager.instance) {
      UnlockManager.instance = new UnlockManager();
    }
    return UnlockManager.instance;
  }

  public static resetInstance(): void {
    UnlockManager.instance = undefined as any;
  }

  public async initialize(products?: Product[], forceSimulation?: boolean): Promise<void> {
    if (this.initialized) return;
    if (products) this.products = products;
    else this.products = this.getDefaultProducts();

    // Для локальной разработки всегда симуляция
    this.useSimulation = true;
    this.loadPurchasesFromStorage();
    this.loadSubscriptionsFromStorage();
    this.initialized = true;
  }

  public getProducts(): Product[] {
    return [...this.products];
  }

  public getProduct(sku: string): Product | undefined {
    return this.products.find(p => p.sku === sku);
  }

  public isProductPurchased(sku: string): boolean {
    return this.purchases.some(p => p.sku === sku);
  }

  public isSubscriptionActive(sku: string): boolean {
    const sub = this.subscriptions.find(s => s.sku === sku);
    if (!sub) return false;
    return sub.isActive && sub.expiryDate > Date.now();
  }

  public shouldShowAds(): boolean {
    const noAdsPurchased = this.isProductPurchased('remove_ads');
    const hasActiveSubscription = this.subscriptions.some(s => s.isActive && s.expiryDate > Date.now() && (s.sku === 'premium_monthly' || s.sku === 'premium_yearly'));
    return !noAdsPurchased && !hasActiveSubscription;
  }

  public isWorldUnlocked(worldId: string): boolean {
    if (progressManager.isWorldUnlocked(worldId)) return true;
    const worldProduct = this.products.find(p => p.worldId === worldId && p.type === 'non_consumable');
    if (worldProduct && this.isProductPurchased(worldProduct.sku)) return true;
    return false;
  }

  public async purchase(sku: string): Promise<boolean> {
    const product = this.getProduct(sku);
    if (!product) {
      eventBus.emit('PURCHASE_FAILED', { error: `Product ${sku} not found` });
      return false;
    }

    // Всегда симуляция для локальной разработки
    const fakeToken = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const purchaseData: PurchaseData = {
      sku,
      purchaseToken: fakeToken,
      signature: 'sim_signature',
      originalJson: JSON.stringify({ sku, timestamp: Date.now() }),
      isAcknowledged: false,
    };
    return this.handlePurchaseSuccess(purchaseData);
  }

  public async restorePurchases(): Promise<void> {
    this.loadPurchasesFromStorage();
    this.loadSubscriptionsFromStorage();
    eventBus.emit('RESTORE_PURCHASES_COMPLETE');
  }

  public async acknowledgePurchase(purchaseToken: string): Promise<boolean> {
    const purchase = this.purchases.find(p => p.purchaseToken === purchaseToken);
    if (purchase) {
      purchase.isAcknowledged = true;
      this.savePurchasesToStorage();
      return true;
    }
    return false;
  }

  private getDefaultProducts(): Product[] {
    return [
      { sku: 'world_ocean', type: 'non_consumable', price: '$2.99', title: 'Ocean World', description: '500 levels with walls & conveyors', worldId: 'ocean' },
      { sku: 'world_clouds', type: 'non_consumable', price: '$2.99', title: 'Clouds World', description: '500 levels with wings & teleports', worldId: 'clouds' },
      { sku: 'world_fairytale', type: 'non_consumable', price: '$3.99', title: 'Fairytale World', description: '500 levels with keys & riddles', worldId: 'fairytale' },
      { sku: 'world_volcano', type: 'non_consumable', price: '$4.99', title: 'Volcano World', description: '500 levels with OOP & cloning', worldId: 'volcano' },
      { sku: 'world_bonus', type: 'non_consumable', price: '$9.99', title: 'Bonus World', description: '3000+ hidden levels', worldId: 'bonus' },
      { sku: 'remove_ads', type: 'non_consumable', price: '$4.99', title: 'Remove Ads', description: 'No ads in menu screens' },
      { sku: 'premium_monthly', type: 'subscription', price: '$4.99', title: 'Premium Monthly', description: 'All worlds unlocked while active', durationDays: 30 },
      { sku: 'premium_yearly', type: 'subscription', price: '$39.99', title: 'Premium Yearly', description: 'All worlds unlocked while active', durationDays: 365 },
    ];
  }

  private handlePurchaseSuccess(purchaseData: PurchaseData): boolean {
    const product = this.getProduct(purchaseData.sku);
    if (!product) return false;

    if (product.type === 'non_consumable') {
      if (!this.isProductPurchased(purchaseData.sku)) {
        const newPurchase: PurchasedProduct = {
          sku: purchaseData.sku,
          purchaseDate: Date.now(),
          purchaseToken: purchaseData.purchaseToken,
          isAcknowledged: false,
          transactionId: purchaseData.purchaseToken,
        };
        this.purchases.push(newPurchase);
        this.savePurchasesToStorage();
        if (product.worldId) progressManager.unlockWorld(product.worldId);
        eventBus.emit('PURCHASE_COMPLETED', { sku: purchaseData.sku, worldId: product.worldId });
        return true;
      }
      return true;
    } else if (product.type === 'subscription') {
      const existingIdx = this.subscriptions.findIndex(s => s.sku === purchaseData.sku);
      const expiryDate = Date.now() + (product.durationDays || 30) * 24 * 60 * 60 * 1000;
      const newSub: Subscription = { sku: purchaseData.sku, expiryDate, isActive: true };
      if (existingIdx !== -1) this.subscriptions[existingIdx] = newSub;
      else this.subscriptions.push(newSub);
      this.saveSubscriptionsToStorage();
      const worldsToUnlock = ['ocean', 'clouds', 'fairytale', 'volcano', 'bonus'];
      worldsToUnlock.forEach(worldId => progressManager.unlockWorld(worldId));
      eventBus.emit('PURCHASE_COMPLETED', { sku: purchaseData.sku });
      return true;
    }
    return false;
  }

  private loadPurchasesFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_PURCHASES_KEY);
      this.purchases = raw ? JSON.parse(raw) : [];
    } catch (e) { this.purchases = []; }
  }

  private savePurchasesToStorage(): void {
    localStorage.setItem(STORAGE_PURCHASES_KEY, JSON.stringify(this.purchases));
  }

  private loadSubscriptionsFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_SUBSCRIPTIONS_KEY);
      if (raw) {
        this.subscriptions = JSON.parse(raw);
        const now = Date.now();
        this.subscriptions.forEach(sub => { if (sub.expiryDate <= now) sub.isActive = false; });
        this.saveSubscriptionsToStorage();
      } else { this.subscriptions = []; }
    } catch (e) { this.subscriptions = []; }
  }

  private saveSubscriptionsToStorage(): void {
    localStorage.setItem(STORAGE_SUBSCRIPTIONS_KEY, JSON.stringify(this.subscriptions));
  }
}

export const unlockManager = UnlockManager.getInstance();
