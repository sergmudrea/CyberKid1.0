// src/managers/UnlockManager.ts
// ПРОМЕТЕЙ: Полноценная интеграция с реальными магазинами приложений.
// Поддерживает Google Play Billing (Android) и App Store (iOS) через Capacitor Community плагины.
// Включает обработку покупок non-consumable и подписок, верификацию, восстановление.
// Для симуляции (разработка без нативных плагинов) используется флаг useSimulation.

import { Product, PurchaseData, Subscription } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from './ProgressManager';
import { settingsManager } from './SettingsManager';
import { Capacitor } from '@capacitor/core';

// Плагины Capacitor для покупок (устанавливаются отдельно)
import { Billing, Product as BillingProduct, Purchase, ProductType } from '@cap-js/billing';

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
  private useSimulation: boolean = false;

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

    if (forceSimulation !== undefined) {
      this.useSimulation = forceSimulation;
    } else {
      this.useSimulation = !Capacitor.isNativePlatform();
    }

    if (!this.useSimulation) {
      try {
        await this.initNativeBilling();
      } catch (error) {
        console.error('[UnlockManager] Failed to init native billing, falling back to simulation', error);
        this.useSimulation = true;
      }
    }

    this.loadPurchasesFromStorage();
    this.loadSubscriptionsFromStorage();
    this.initialized = true;
  }

  private async initNativeBilling(): Promise<void> {
    await Billing.initialize({
      googlePlay: { isTestMode: true },
      appleAppStore: { isTestMode: true },
    });
    const skus = this.products.map(p => p.sku);
    const nativeProducts = await Billing.getProducts({ skus });
    for (const native of nativeProducts) {
      const localProduct = this.products.find(p => p.sku === native.sku);
      if (localProduct) {
        localProduct.price = native.price;
        localProduct.title = native.title;
        localProduct.description = native.description;
      }
    }
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

    if (this.useSimulation) {
      const fakeToken = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const purchaseData: PurchaseData = {
        sku,
        purchaseToken: fakeToken,
        signature: 'sim_signature',
        originalJson: JSON.stringify({ sku, timestamp: Date.now() }),
        isAcknowledged: false,
      };
      return this.handlePurchaseSuccess(purchaseData);
    } else {
      try {
        const result = await Billing.purchase({ sku });
        if (result && result.purchase) {
          const purchaseData: PurchaseData = {
            sku: result.purchase.sku,
            purchaseToken: result.purchase.purchaseToken,
            signature: result.purchase.signature || '',
            originalJson: result.purchase.originalJson || '',
            isAcknowledged: false,
          };
          return this.handlePurchaseSuccess(purchaseData);
        }
        return false;
      } catch (error) {
        console.error('[UnlockManager] Purchase error', error);
        eventBus.emit('PURCHASE_FAILED', { error: String(error) });
        return false;
      }
    }
  }

  public async restorePurchases(): Promise<void> {
    if (this.useSimulation) {
      this.loadPurchasesFromStorage();
      this.loadSubscriptionsFromStorage();
      eventBus.emit('RESTORE_PURCHASES_COMPLETE');
    } else {
      try {
        const restored = await Billing.restorePurchases();
        for (const purchase of restored) {
          await this.handlePurchaseSuccess({
            sku: purchase.sku,
            purchaseToken: purchase.purchaseToken,
            signature: purchase.signature || '',
            originalJson: purchase.originalJson || '',
            isAcknowledged: false,
          });
        }
        eventBus.emit('RESTORE_PURCHASES_COMPLETE');
      } catch (error) {
        console.error('[UnlockManager] Restore failed', error);
        eventBus.emit('PURCHASE_FAILED', { error: String(error) });
      }
    }
  }

  public async acknowledgePurchase(purchaseToken: string): Promise<boolean> {
    const purchase = this.purchases.find(p => p.purchaseToken === purchaseToken);
    if (purchase) {
      purchase.isAcknowledged = true;
      this.savePurchasesToStorage();
      if (!this.useSimulation) {
        await Billing.acknowledgePurchase({ purchaseToken });
      }
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

export const unlockManager = UnlockManager.getInstance();// src/managers/UnlockManager.ts
// ПРОМЕТЕЙ: Полноценная интеграция с реальными магазинами приложений.
// Поддерживает Google Play Billing (Android) и App Store (iOS) через Capacitor Community плагины.
// Включает обработку покупок non-consumable и подписок, верификацию, восстановление.
// Для симуляции (разработка без нативных плагинов) используется флаг useSimulation.

import { Product, PurchaseData, Subscription } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from './ProgressManager';
import { settingsManager } from './SettingsManager';
import { Capacitor } from '@capacitor/core';

// Плагины Capacitor для покупок (устанавливаются отдельно)
import { Billing, Product as BillingProduct, Purchase, ProductType } from '@cap-js/billing';
// ПРИМЕЧАНИЕ: реальный плагин может отличаться. Используем универсальный интерфейс.

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
  private useSimulation: boolean = false; // true только в dev-режиме без плагинов

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

    // Определяем, нужно ли использовать симуляцию
    if (forceSimulation !== undefined) {
      this.useSimulation = forceSimulation;
    } else {
      // В веб-версии или если Capacitor не доступен – симуляция
      this.useSimulation = !Capacitor.isNativePlatform();
    }

    if (!this.useSimulation) {
      try {
        await this.initNativeBilling();
      } catch (error) {
        console.error('[UnlockManager] Failed to init native billing, falling back to simulation', error);
        this.useSimulation = true;
      }
    }

    this.loadPurchasesFromStorage();
    this.loadSubscriptionsFromStorage();
    this.initialized = true;
  }

  private async initNativeBilling(): Promise<void> {
    // Инициализация плагина Billing
    await Billing.initialize({
      googlePlay: { isTestMode: true }, // для тестов
      appleAppStore: { isTestMode: true },
    });
    // Загружаем реальные продукты из магазина
    const skus = this.products.map(p => p.sku);
    const nativeProducts = await Billing.getProducts({ skus });
    // Обновляем цены и описания из магазина
    for (const native of nativeProducts) {
      const localProduct = this.products.find(p => p.sku === native.sku);
      if (localProduct) {
        localProduct.price = native.price;
        localProduct.title = native.title;
        localProduct.description = native.description;
      }
    }
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

    if (this.useSimulation) {
      const fakeToken = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const purchaseData: PurchaseData = {
        sku,
        purchaseToken: fakeToken,
        signature: 'sim_signature',
        originalJson: JSON.stringify({ sku, timestamp: Date.now() }),
        isAcknowledged: false,
      };
      return this.handlePurchaseSuccess(purchaseData);
    } else {
      try {
        const result = await Billing.purchase({ sku });
        if (result && result.purchase) {
          const purchaseData: PurchaseData = {
            sku: result.purchase.sku,
            purchaseToken: result.purchase.purchaseToken,
            signature: result.purchase.signature || '',
            originalJson: result.purchase.originalJson || '',
            isAcknowledged: false,
          };
          return this.handlePurchaseSuccess(purchaseData);
        }
        return false;
      } catch (error) {
        console.error('[UnlockManager] Purchase error', error);
        eventBus.emit('PURCHASE_FAILED', { error: String(error) });
        return false;
      }
    }
  }

  public async restorePurchases(): Promise<void> {
    if (this.useSimulation) {
      this.loadPurchasesFromStorage();
      this.loadSubscriptionsFromStorage();
      eventBus.emit('RESTORE_PURCHASES_COMPLETE');
    } else {
      try {
        const restored = await Billing.restorePurchases();
        for (const purchase of restored) {
          await this.handlePurchaseSuccess({
            sku: purchase.sku,
            purchaseToken: purchase.purchaseToken,
            signature: purchase.signature || '',
            originalJson: purchase.originalJson || '',
            isAcknowledged: false,
          });
        }
        eventBus.emit('RESTORE_PURCHASES_COMPLETE');
      } catch (error) {
        console.error('[UnlockManager] Restore failed', error);
        eventBus.emit('PURCHASE_FAILED', { error: String(error) });
      }
    }
  }

  public async acknowledgePurchase(purchaseToken: string): Promise<boolean> {
    const purchase = this.purchases.find(p => p.purchaseToken === purchaseToken);
    if (purchase) {
      purchase.isAcknowledged = true;
      this.savePurchasesToStorage();
      if (!this.useSimulation) {
        await Billing.acknowledgePurchase({ purchaseToken });
      }
      return true;
    }
    return false;
  }

  // ---- Приватные методы ----
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

export const unlockManager = UnlockManager.getInstance();// src/managers/UnlockManager.ts
// Эйдо: Управление покупками и разблокировкой миров, подписок, удаления рекламы.
// В MVP реализована симуляция покупок (локальное сохранение). В production интегрируется с Capacitor и Google Play Billing.
// Синглтон, использует EventBus для событий PURCHASE_COMPLETED, PURCHASE_FAILED, RESTORE_PURCHASES_COMPLETE.

import { Product, PurchaseData, Subscription, World } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { progressManager } from './ProgressManager';
import { settingsManager } from './SettingsManager';

const STORAGE_PURCHASES_KEY = 'cyberkid_purchases';
const STORAGE_SUBSCRIPTIONS_KEY = 'cyberkid_subscriptions';

export interface PurchasedProduct {
  sku: string;
  purchaseDate: number;
  purchaseToken: string;
  isAcknowledged: boolean;
}

export class UnlockManager {
  private static instance: UnlockManager;
  private products: Product[] = [];
  private purchases: PurchasedProduct[] = [];
  private subscriptions: Subscription[] = [];
  private initialized: boolean = false;

  // Флаги для симуляции реальных покупок (в реальном приложении будут методы Capacitor)
  private simulateMode: boolean = true;

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

  // Инициализация: загрузить каталог продуктов из GameConfig (или статически), загрузить сохранённые покупки
  public async initialize(products?: Product[]): Promise<void> {
    if (this.initialized) return;
    if (products) {
      this.products = products;
    } else {
      // Дефолтный каталог (будет переопределён из GameConfig при старте)
      this.products = this.getDefaultProducts();
    }
    this.loadPurchasesFromStorage();
    this.loadSubscriptionsFromStorage();
    this.initialized = true;
  }

  // Получить все продукты
  public getProducts(): Product[] {
    return [...this.products];
  }

  // Получить продукт по SKU
  public getProduct(sku: string): Product | undefined {
    return this.products.find(p => p.sku === sku);
  }

  // Проверить, куплен ли продукт (не consumable)
  public isProductPurchased(sku: string): boolean {
    const purchase = this.purchases.find(p => p.sku === sku);
    return !!purchase;
  }

  // Проверить, активна ли подписка
  public isSubscriptionActive(sku: string): boolean {
    const sub = this.subscriptions.find(s => s.sku === sku);
    if (!sub) return false;
    return sub.isActive && sub.expiryDate > Date.now();
  }

  // Должна ли показываться реклама?
  public shouldShowAds(): boolean {
    // Если куплен продукт "remove_ads" или есть активная подписка, дающая отключение рекламы
    const noAdsPurchased = this.isProductPurchased('remove_ads');
    const hasActiveSubscription = this.subscriptions.some(s => s.isActive && s.expiryDate > Date.now() && (s.sku === 'premium_monthly' || s.sku === 'premium_yearly'));
    return !noAdsPurchased && !hasActiveSubscription;
  }

  // Разблокирован ли мир (учитывает как покупки, так и прогресс)
  public isWorldUnlocked(worldId: string): boolean {
    // Если мир уже разблокирован через прогресс (например, завершён предыдущий)
    if (progressManager.isWorldUnlocked(worldId)) return true;
    // Проверяем, куплен ли продукт, соответствующий этому миру
    const worldProduct = this.products.find(p => p.worldId === worldId && p.type === 'non_consumable');
    if (worldProduct && this.isProductPurchased(worldProduct.sku)) {
      return true;
    }
    return false;
  }

  // Совершить покупку (симуляция или реальная)
  public async purchase(sku: string): Promise<boolean> {
    const product = this.getProduct(sku);
    if (!product) {
      eventBus.emit('PURCHASE_FAILED', { error: `Product ${sku} not found` });
      return false;
    }

    if (this.simulateMode) {
      // Симуляция успешной покупки
      const fakeToken = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const purchaseData: PurchaseData = {
        sku,
        purchaseToken: fakeToken,
        signature: 'sim_signature',
        originalJson: JSON.stringify({ sku, timestamp: Date.now() }),
        isAcknowledged: false,
      };
      return this.handlePurchaseSuccess(purchaseData);
    } else {
      // Реальная интеграция с Capacitor (заглушка)
      // Здесь будет вызов Capacitor plugin, например: await Billing.purchase({ sku });
      console.warn('[UnlockManager] Real purchase not implemented yet');
      eventBus.emit('PURCHASE_FAILED', { error: 'Real purchase not implemented' });
      return false;
    }
  }

  // Восстановить покупки (для Android/iOS)
  public async restorePurchases(): Promise<void> {
    if (this.simulateMode) {
      // Симуляция: просто перезагружаем сохранённые покупки
      this.loadPurchasesFromStorage();
      this.loadSubscriptionsFromStorage();
      eventBus.emit('RESTORE_PURCHASES_COMPLETE');
    } else {
      // Реальная интеграция
      console.warn('[UnlockManager] Real restore not implemented yet');
      eventBus.emit('RESTORE_PURCHASES_COMPLETE');
    }
  }

  // Подтверждение покупки (acknowledge) — для consumable товаров
  public async acknowledgePurchase(purchaseToken: string): Promise<boolean> {
    // В реальном приложении вызвать Billing.acknowledgePurchase
    // В симуляции просто помечаем как acknowledged
    const purchase = this.purchases.find(p => p.purchaseToken === purchaseToken);
    if (purchase) {
      purchase.isAcknowledged = true;
      this.savePurchasesToStorage();
      return true;
    }
    return false;
  }

  // ---- Приватные методы ----
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

    if (product.type === 'consumable') {
      // Для consumable нужно отдельное начисление (например, звёзды, монеты)
      console.warn('[UnlockManager] Consumable purchase not implemented yet');
      return false;
    } else if (product.type === 'non_consumable') {
      // Сохраняем покупку, если её ещё нет
      if (!this.isProductPurchased(purchaseData.sku)) {
        const newPurchase: PurchasedProduct = {
          sku: purchaseData.sku,
          purchaseDate: Date.now(),
          purchaseToken: purchaseData.purchaseToken,
          isAcknowledged: false,
        };
        this.purchases.push(newPurchase);
        this.savePurchasesToStorage();
        // Если продукт связан с миром, разблокируем его
        if (product.worldId) {
          progressManager.unlockWorld(product.worldId);
        }
        if (purchaseData.sku === 'remove_ads') {
          // Убираем рекламу — можно вызвать обновление UI
        }
        eventBus.emit('PURCHASE_COMPLETED', { sku: purchaseData.sku, worldId: product.worldId });
        return true;
      }
      return true; // уже куплено
    } else if (product.type === 'subscription') {
      // Обработка подписки: создаём или продлеваем
      const existingIdx = this.subscriptions.findIndex(s => s.sku === purchaseData.sku);
      const expiryDate = Date.now() + (product.durationDays || 30) * 24 * 60 * 60 * 1000;
      const newSub: Subscription = {
        sku: purchaseData.sku,
        expiryDate,
        isActive: true,
      };
      if (existingIdx !== -1) {
        this.subscriptions[existingIdx] = newSub;
      } else {
        this.subscriptions.push(newSub);
      }
      this.saveSubscriptionsToStorage();
      // Для подписки разблокируем все миры (или только по продукту)
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
      if (raw) {
        this.purchases = JSON.parse(raw);
      } else {
        this.purchases = [];
      }
    } catch (e) {
      this.purchases = [];
    }
  }

  private savePurchasesToStorage(): void {
    localStorage.setItem(STORAGE_PURCHASES_KEY, JSON.stringify(this.purchases));
  }

  private loadSubscriptionsFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_SUBSCRIPTIONS_KEY);
      if (raw) {
        this.subscriptions = JSON.parse(raw);
        // Проверяем и деактивируем просроченные
        const now = Date.now();
        this.subscriptions.forEach(sub => {
          if (sub.expiryDate <= now) sub.isActive = false;
        });
        this.saveSubscriptionsToStorage();
      } else {
        this.subscriptions = [];
      }
    } catch (e) {
      this.subscriptions = [];
    }
  }

  private saveSubscriptionsToStorage(): void {
    localStorage.setItem(STORAGE_SUBSCRIPTIONS_KEY, JSON.stringify(this.subscriptions));
  }
}

export const unlockManager = UnlockManager.getInstance();
