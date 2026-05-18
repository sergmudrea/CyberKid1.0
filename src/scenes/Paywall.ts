// src/scenes/Paywall.ts
// ПРОМЕТЕЙ: Сцена покупки премиум-мира с полноценной интеграцией реального UnlockManager.
// Поддерживает реальные покупки через Google Play / App Store (через Capacitor Billing),
// а также симуляцию для веб-версии. Отображает загрузку, обработку ошибок, восстановление покупок.
// Полная локализация (ru/en).

import { Scene } from 'phaser';
import { gameEvents as eventBus } from '../core/EventBus';
import { unlockManager } from '../managers/UnlockManager';
import { settingsManager } from '../managers/SettingsManager';
import { progressManager } from '../managers/ProgressManager';

export class Paywall extends Scene {
  private worldId: string = '';
  private sku: string = '';
  private isPurchasing: boolean = false;
  private lang: 'ru' | 'en' = 'en';
  private productInfo: { title: string; description: string; price: string } | null = null;
  private purchaseButton: Phaser.GameObjects.Text;
  private restoreButton: Phaser.GameObjects.Text;
  private loadingOverlay: Phaser.GameObjects.Container;
  private loadingText: Phaser.GameObjects.Text;
  private backButton: Phaser.GameObjects.Text;

  constructor() {
    super('Paywall');
  }

  init(data: { worldId: string; sku?: string }): void {
    this.worldId = data.worldId;
    this.sku = data.sku || `world_${this.worldId}`;
    this.isPurchasing = false;
  }

  async create(): Promise<void> {
    this.lang = settingsManager.get().language;
    this.createBackground();
    this.createHeader();
    await this.loadProductInfo();
    this.createWorldInfo();
    this.createPriceButton();
    this.createRestoreButton();
    this.createBackButton();
    this.createLoadingOverlay();
    this.setupEventListeners();
    this.events.once('shutdown', () => this.removeEventListeners());
  }

  private createBackground(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a2a, 0x0a0a2a, 0x1a1a4a, 0x1a1a4a);
    bg.fillRect(0, 0, width, height);
  }

  private createHeader(): void {
    const width = this.cameras.main.width;
    const title = this.add.text(width / 2, 60, this.lang === 'ru' ? 'ПРЕМИУМ МИР' : 'PREMIUM WORLD', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffcc00',
      stroke: '#ff6600',
      strokeThickness: 2,
    }).setOrigin(0.5);
  }

  private async loadProductInfo(): Promise<void> {
    const product = unlockManager.getProduct(this.sku);
    if (product) {
      this.productInfo = {
        title: product.title,
        description: product.description,
        price: product.price,
      };
    } else {
      // Fallback (на случай, если продукт не загружен из магазина)
      const worldPrices: Record<string, string> = {
        ocean: '$2.99',
        clouds: '$2.99',
        fairytale: '$3.99',
        volcano: '$4.99',
        bonus: '$9.99',
      };
      const worldNames: Record<string, { ru: string; en: string }> = {
        ocean: { ru: 'Океан', en: 'Ocean' },
        clouds: { ru: 'Облака', en: 'Clouds' },
        fairytale: { ru: 'Сказка', en: 'Fairytale' },
        volcano: { ru: 'Вулкан', en: 'Volcano' },
        bonus: { ru: 'Бонус', en: 'Bonus' },
      };
      const name = worldNames[this.worldId]?.[this.lang] || this.worldId;
      const price = worldPrices[this.worldId] || '$4.99';
      this.productInfo = {
        title: name,
        description: this.lang === 'ru' ? `Откройте мир ${name} с 500 новыми уровнями!` : `Unlock ${name} world with 500 new levels!`,
        price: price,
      };
    }
  }

  private createWorldInfo(): void {
    const width = this.cameras.main.width;
    const centerY = 180;
    const iconMap: Record<string, string> = {
      ocean: '🌊',
      clouds: '☁️',
      fairytale: '🏰',
      volcano: '🌋',
      bonus: '⭐',
    };
    const icon = iconMap[this.worldId] || '🌟';
    const iconText = this.add.text(width / 2, centerY - 40, icon, { fontSize: '80px' }).setOrigin(0.5);
    const title = this.add.text(width / 2, centerY + 20, this.productInfo?.title || '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5);
    const desc = this.add.text(width / 2, centerY + 70, this.productInfo?.description || '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: 500 },
    }).setOrigin(0.5);
    const levelsText = this.add.text(width / 2, centerY + 120, this.lang === 'ru' ? '500 новых уровней' : '500 new levels', {
      fontSize: '14px',
      color: '#ffcc00',
    }).setOrigin(0.5);
  }

  private createPriceButton(): void {
    const width = this.cameras.main.width;
    const price = this.productInfo?.price || '$4.99';
    const btnText = `${price} - ${this.lang === 'ru' ? 'КУПИТЬ' : 'PURCHASE'}`;
    this.purchaseButton = this.add.text(width / 2, 400, btnText, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 32, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.purchaseButton.on('pointerdown', () => this.purchase());
    this.purchaseButton.on('pointerover', () => this.purchaseButton.setColor('#00ffcc'));
    this.purchaseButton.on('pointerout', () => this.purchaseButton.setColor('#ffffff'));
  }

  private createRestoreButton(): void {
    const width = this.cameras.main.width;
    this.restoreButton = this.add.text(width / 2, 470, this.lang === 'ru' ? '🔄 ВОССТАНОВИТЬ ПОКУПКИ' : '🔄 RESTORE PURCHASES', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#aaaaaa',
      backgroundColor: '#2a2a4a',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.restoreButton.on('pointerdown', () => this.restorePurchases());
    this.restoreButton.on('pointerover', () => this.restoreButton.setColor('#ffffff'));
    this.restoreButton.on('pointerout', () => this.restoreButton.setColor('#aaaaaa'));
  }

  private createBackButton(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.backButton = this.add.text(50, height - 40, this.lang === 'ru' ? '← НАЗАД' : '← BACK', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 6 },
    }).setInteractive({ useHandCursor: true });
    this.backButton.on('pointerdown', () => this.scene.start('WorldMap'));
    this.backButton.on('pointerover', () => this.backButton.setColor('#00ffcc'));
    this.backButton.on('pointerout', () => this.backButton.setColor('#ffffff'));
  }

  private createLoadingOverlay(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.loadingOverlay = this.add.container(0, 0);
    const overlayBg = this.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    overlayBg.setOrigin(0, 0);
    this.loadingOverlay.add(overlayBg);
    this.loadingText = this.add.text(width / 2, height / 2, this.lang === 'ru' ? 'ОБРАБОТКА...' : 'PROCESSING...', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.loadingOverlay.add(this.loadingText);
    this.loadingOverlay.setVisible(false);
  }

  private showLoading(show: boolean): void {
    this.loadingOverlay.setVisible(show);
    this.purchaseButton.setVisible(!show);
    this.restoreButton.setVisible(!show);
    this.backButton.setVisible(!show);
  }

  private async purchase(): Promise<void> {
    if (this.isPurchasing) return;
    this.isPurchasing = true;
    this.showLoading(true);

    const success = await unlockManager.purchase(this.sku);
    this.isPurchasing = false;
    this.showLoading(false);

    if (success) {
      // После успешной покупки разблокируем мир через ProgressManager
      progressManager.unlockWorld(this.worldId);
      const msg = this.lang === 'ru' ? 'Мир успешно разблокирован!' : 'World unlocked successfully!';
      alert(msg);
      this.scene.start('WorldMap');
    } else {
      const msg = this.lang === 'ru' ? 'Ошибка покупки. Попробуйте позже.' : 'Purchase failed. Please try again.';
      alert(msg);
    }
  }

  private async restorePurchases(): Promise<void> {
    if (this.isPurchasing) return;
    this.isPurchasing = true;
    this.showLoading(true);

    await unlockManager.restorePurchases();
    this.isPurchasing = false;
    this.showLoading(false);

    // Проверяем, разблокирован ли этот мир после восстановления
    if (progressManager.isWorldUnlocked(this.worldId) || unlockManager.isWorldUnlocked(this.worldId)) {
      const msg = this.lang === 'ru' ? 'Мир успешно восстановлен!' : 'World restored successfully!';
      alert(msg);
      this.scene.start('WorldMap');
    } else {
      const msg = this.lang === 'ru' ? 'Покупки не найдены.' : 'No purchases found.';
      alert(msg);
    }
  }

  private setupEventListeners(): void {
    eventBus.on('PURCHASE_COMPLETED', this.onPurchaseCompleted);
    eventBus.on('PURCHASE_FAILED', this.onPurchaseFailed);
  }

  private removeEventListeners(): void {
    eventBus.off('PURCHASE_COMPLETED', this.onPurchaseCompleted);
    eventBus.off('PURCHASE_FAILED', this.onPurchaseFailed);
  }

  private onPurchaseCompleted = (payload: any): void => {
    if (payload && payload.sku === this.sku) {
      // Можно дополнительно обновить UI, но основная логика уже в purchase()
    }
  };

  private onPurchaseFailed = (payload: any): void => {
    if (payload && payload.error) {
      console.warn('Purchase failed:', payload.error);
    }
  };
}
