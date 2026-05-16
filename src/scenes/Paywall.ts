// src/scenes/Paywall.ts
// Эйдо: Сцена покупки премиум-мира (Paywall). Отображает информацию о мире,
// цену, кнопку покупки (с интеграцией unlockManager), восстановление покупок,
// кнопку "Назад". При успешной покупке разблокирует мир и возвращает на карту миров.

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
  private contentContainer: Phaser.GameObjects.Container;

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
      // fallback с разными ценами для разных миров
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
    // Создаём контейнер и добавляем его на сцену
    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.add([iconText, title, desc, levelsText]);
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
    const backBtn = this.add.text(50, height - 40, this.lang === 'ru' ? '← НАЗАД' : '← BACK', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a2a4a',
      padding: { x: 16, y: 6 },
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('WorldMap'));
    backBtn.on('pointerover', () => backBtn.setColor('#00ffcc'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
  }

  private async purchase(): Promise<void> {
    if (this.isPurchasing) return;
    this.isPurchasing = true;
    const originalText = this.purchaseButton.text;
    this.purchaseButton.setText(this.lang === 'ru' ? 'ОБРАБОТКА...' : 'PROCESSING...');
    this.purchaseButton.disableInteractive();
    this.restoreButton.disableInteractive();

    const success = await unlockManager.purchase(this.sku);
    this.isPurchasing = false;
    if (success) {
      progressManager.unlockWorld(this.worldId);
      alert(this.lang === 'ru' ? 'Мир успешно разблокирован!' : 'World unlocked successfully!');
      this.scene.start('WorldMap');
    } else {
      this.purchaseButton.setText(originalText);
      this.purchaseButton.setInteractive({ useHandCursor: true });
      this.restoreButton.setInteractive({ useHandCursor: true });
      alert(this.lang === 'ru' ? 'Ошибка покупки. Попробуйте позже.' : 'Purchase failed. Please try again.');
    }
  }

  private async restorePurchases(): Promise<void> {
    if (this.isPurchasing) return;
    this.isPurchasing = true;
    const originalText = this.restoreButton.text;
    this.restoreButton.setText(this.lang === 'ru' ? 'ВОССТАНОВЛЕНИЕ...' : 'RESTORING...');
    this.restoreButton.disableInteractive();
    this.purchaseButton.disableInteractive();

    await unlockManager.restorePurchases();
    this.isPurchasing = false;
    // Проверяем, разблокирован ли уже этот мир после восстановления
    if (progressManager.isWorldUnlocked(this.worldId) || unlockManager.isWorldUnlocked(this.worldId)) {
      alert(this.lang === 'ru' ? 'Мир успешно восстановлен!' : 'World restored successfully!');
      this.scene.start('WorldMap');
    } else {
      this.restoreButton.setText(originalText);
      this.restoreButton.setInteractive({ useHandCursor: true });
      this.purchaseButton.setInteractive({ useHandCursor: true });
      alert(this.lang === 'ru' ? 'Покупки не найдены.' : 'No purchases found.');
    }
  }

  private setupEventListeners(): void {
    eventBus.on('PURCHASE_COMPLETED', this.onPurchaseCompleted.bind(this));
    eventBus.on('PURCHASE_FAILED', this.onPurchaseFailed.bind(this));
  }

  private removeEventListeners(): void {
    eventBus.off('PURCHASE_COMPLETED', this.onPurchaseCompleted.bind(this));
    eventBus.off('PURCHASE_FAILED', this.onPurchaseFailed.bind(this));
  }

  private onPurchaseCompleted(payload: any): void {
    if (payload && payload.sku === this.sku) {
      // Можно показать тост, но необязательно
    }
  }

  private onPurchaseFailed(payload: any): void {
    if (payload && payload.error) {
      console.warn('Purchase failed:', payload.error);
    }
  }
}
