// src/modules/CommandPanel.ts
// Эйдо: Визуальный конструктор команд (drag-and-drop с поддержкой мыши и touch).
// Использует нативные DOM-элементы, встраиваемые в body (не Phaser.DOMElement) для совместимости с Capacitor.
// Поддерживает 4 режима обучения, загружает метаданные команд из syntax.json (или встроенного объекта).

import { Command, LearningMode } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';
import { saveManager } from '../managers/SaveManager';

// Интерфейс метаданных команды
interface CommandMeta {
  icon: string;
  labelRu: string;
  labelEn: string;
  syntaxPython: string;
  syntaxJs: string;
}

// Полные метаданные для всех 45+ команд (согласно ТЗ)
const COMMAND_METADATA: Record<Command, CommandMeta> = {
  // Движение
  [Command.UP]: { icon: '⬆️', labelRu: 'Вверх', labelEn: 'Up', syntaxPython: 'move_up()', syntaxJs: 'moveUp()' },
  [Command.DOWN]: { icon: '⬇️', labelRu: 'Вниз', labelEn: 'Down', syntaxPython: 'move_down()', syntaxJs: 'moveDown()' },
  [Command.LEFT]: { icon: '⬅️', labelRu: 'Влево', labelEn: 'Left', syntaxPython: 'move_left()', syntaxJs: 'moveLeft()' },
  [Command.RIGHT]: { icon: '➡️', labelRu: 'Вправо', labelEn: 'Right', syntaxPython: 'move_right()', syntaxJs: 'moveRight()' },
  // Циклы
  [Command.FOR_N]: { icon: '🔁', labelRu: 'Повторить N раз', labelEn: 'Repeat N times', syntaxPython: 'for i in range(N):', syntaxJs: 'for (let i=0; i<N; i++) {' },
  [Command.FOR_LOOP]: { icon: '🔄', labelRu: 'Цикл for от A до B', labelEn: 'For loop A to B', syntaxPython: 'for i in range(A, B):', syntaxJs: 'for (let i=A; i<B; i++) {' },
  [Command.WHILE_MONSTER]: { icon: '👾', labelRu: 'Пока монстр впереди', labelEn: 'While monster ahead', syntaxPython: 'while monster_ahead():', syntaxJs: 'while (monsterAhead()) {' },
  [Command.WHILE_WALL]: { icon: '🧱', labelRu: 'Пока стена впереди', labelEn: 'While wall ahead', syntaxPython: 'while wall_ahead():', syntaxJs: 'while (wallAhead()) {' },
  [Command.WHILE_HOLE]: { icon: '🕳️', labelRu: 'Пока яма впереди', labelEn: 'While hole ahead', syntaxPython: 'while hole_ahead():', syntaxJs: 'while (holeAhead()) {' },
  [Command.REPEAT]: { icon: '🔂', labelRu: 'Повторять', labelEn: 'Repeat', syntaxPython: 'repeat:', syntaxJs: 'repeat {' },
  // Условия
  [Command.IF_WALL]: { icon: '🧱❓', labelRu: 'Если стена', labelEn: 'If wall', syntaxPython: 'if wall_ahead():', syntaxJs: 'if (wallAhead()) {' },
  [Command.IF_HOLE]: { icon: '🕳️❓', labelRu: 'Если яма', labelEn: 'If hole', syntaxPython: 'if hole_ahead():', syntaxJs: 'if (holeAhead()) {' },
  [Command.IF_MONSTER]: { icon: '👾❓', labelRu: 'Если монстр', labelEn: 'If monster', syntaxPython: 'if monster_ahead():', syntaxJs: 'if (monsterAhead()) {' },
  [Command.IF_COIN]: { icon: '💰❓', labelRu: 'Если монета', labelEn: 'If coin', syntaxPython: 'if coin_here():', syntaxJs: 'if (coinHere()) {' },
  [Command.IF_KEY]: { icon: '🔑❓', labelRu: 'Если есть ключ', labelEn: 'If has key', syntaxPython: 'if has_key():', syntaxJs: 'if (hasKey()) {' },
  [Command.IF_NO_KEY]: { icon: '🚫🔑', labelRu: 'Если нет ключа', labelEn: 'If no key', syntaxPython: 'if not has_key():', syntaxJs: 'if (!hasKey()) {' },
  [Command.ELSE]: { icon: '📎', labelRu: 'Иначе', labelEn: 'Else', syntaxPython: 'else:', syntaxJs: 'else {' },
  // Функции
  [Command.CALL]: { icon: '📞', labelRu: 'Вызвать функцию', labelEn: 'Call function', syntaxPython: 'call function_name()', syntaxJs: 'functionName();' },
  [Command.DEF]: { icon: '📝', labelRu: 'Определить функцию', labelEn: 'Define function', syntaxPython: 'def function_name():', syntaxJs: 'function functionName() {' },
  [Command.RETURN]: { icon: '↩️', labelRu: 'Вернуться', labelEn: 'Return', syntaxPython: 'return', syntaxJs: 'return;' },
  [Command.PARAM]: { icon: '📥', labelRu: 'Параметр', labelEn: 'Parameter', syntaxPython: 'param', syntaxJs: 'param' },
  // ООП
  [Command.CLASS]: { icon: '🏛️', labelRu: 'Класс', labelEn: 'Class', syntaxPython: 'class ClassName:', syntaxJs: 'class ClassName {' },
  [Command.NEW]: { icon: '✨', labelRu: 'Создать объект', labelEn: 'New object', syntaxPython: 'obj = ClassName()', syntaxJs: 'let obj = new ClassName();' },
  [Command.METHOD]: { icon: '⚙️', labelRu: 'Метод', labelEn: 'Method', syntaxPython: 'obj.method()', syntaxJs: 'obj.method();' },
  // Параллелизм
  [Command.CLONE]: { icon: '👥', labelRu: 'Клонировать', labelEn: 'Clone', syntaxPython: 'clone()', syntaxJs: 'clone();' },
  [Command.JOIN]: { icon: '🤝', labelRu: 'Объединить клонов', labelEn: 'Join clones', syntaxPython: 'join()', syntaxJs: 'join();' },
  // Взаимодействие
  [Command.PUSH]: { icon: '📦', labelRu: 'Толкнуть', labelEn: 'Push', syntaxPython: 'push()', syntaxJs: 'push();' },
  [Command.THROW]: { icon: '🎯', labelRu: 'Бросить ядро', labelEn: 'Throw core', syntaxPython: 'throw()', syntaxJs: 'throw();' },
  [Command.FEED]: { icon: '🌽', labelRu: 'Накормить', labelEn: 'Feed', syntaxPython: 'feed()', syntaxJs: 'feed();' },
  [Command.HOOK]: { icon: '🪝', labelRu: 'Крюк', labelEn: 'Hook', syntaxPython: 'hook()', syntaxJs: 'hook();' },
  [Command.DRILL]: { icon: '🔧', labelRu: 'Дрель', labelEn: 'Drill', syntaxPython: 'drill()', syntaxJs: 'drill();' },
  [Command.BAIT]: { icon: '🐟', labelRu: 'Приманка', labelEn: 'Bait', syntaxPython: 'bait()', syntaxJs: 'bait();' },
  [Command.SCAN]: { icon: '🔍', labelRu: 'Сканировать', labelEn: 'Scan', syntaxPython: 'scan()', syntaxJs: 'scan();' },
  // Инвентарь
  [Command.PICKUP]: { icon: '📦', labelRu: 'Подобрать', labelEn: 'Pickup', syntaxPython: 'pickup()', syntaxJs: 'pickup();' },
  [Command.DROP]: { icon: '🚮', labelRu: 'Выбросить', labelEn: 'Drop', syntaxPython: 'drop()', syntaxJs: 'drop();' },
  [Command.USE_KEY]: { icon: '🔓', labelRu: 'Использовать ключ', labelEn: 'Use key', syntaxPython: 'use_key()', syntaxJs: 'useKey();' },
  // Время
  [Command.TIME_SLOW]: { icon: '🐢', labelRu: 'Замедлить время', labelEn: 'Slow time', syntaxPython: 'time_slow()', syntaxJs: 'timeSlow();' },
  [Command.TIME_FAST]: { icon: '🐇', labelRu: 'Ускорить время', labelEn: 'Fast time', syntaxPython: 'time_fast()', syntaxJs: 'timeFast();' },
  [Command.WAIT]: { icon: '⏳', labelRu: 'Подождать', labelEn: 'Wait', syntaxPython: 'wait()', syntaxJs: 'wait();' },
  // Дополнительные
  [Command.WING]: { icon: '🪽', labelRu: 'Крылья', labelEn: 'Wings', syntaxPython: 'wing()', syntaxJs: 'wing();' },
  [Command.RIDE]: { icon: '🐎', labelRu: 'Оседлать', labelEn: 'Ride', syntaxPython: 'ride()', syntaxJs: 'ride();' },
  // Технические (не используются в панели, но для полноты)
  [Command.START]: { icon: '▶️', labelRu: 'Старт', labelEn: 'Start', syntaxPython: 'start', syntaxJs: 'start' },
  [Command.END]: { icon: '⏹️', labelRu: 'Конец', labelEn: 'End', syntaxPython: 'end', syntaxJs: 'end' },
};

export class CommandPanel {
  private scene: Phaser.Scene;
  private container: HTMLDivElement;
  private leftPanelEl: HTMLElement;
  private rightPanelEl: HTMLElement;
  private availableCommands: Command[] = [];
  private currentProgram: Command[] = [];
  private currentLevelId: string = '';
  private learningMode: LearningMode = LearningMode.SCHOLAR;
  private language: 'ru' | 'en' = 'en';
  private isExecuting: boolean = false;

  // Для touch drag
  private dragStartIndex: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initDOM();
    this.setupEventListeners();
    this.updateMode(settingsManager.get().learningMode, settingsManager.get().language);
  }

  // Показать/скрыть панель (можно вызывать из сцены)
  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  // Установка доступных команд
  public setAvailableCommands(commands: Command[]): void {
    this.availableCommands = commands;
    this.renderLeftPanel();
  }

  public loadProgram(levelId: string, program: Command[]): void {
    this.currentLevelId = levelId;
    this.currentProgram = [...program];
    this.renderRightPanel();
  }

  public clearProgram(): void {
    this.currentProgram = [];
    this.renderRightPanel();
    this.notifyProgramChanged();
    this.autoSave();
  }

  public addCommand(command: Command): void {
    this.currentProgram.push(command);
    this.renderRightPanel();
    this.notifyProgramChanged();
    this.autoSave();
  }

  public removeCommand(index: number): void {
    if (index >= 0 && index < this.currentProgram.length) {
      this.currentProgram.splice(index, 1);
      this.renderRightPanel();
      this.notifyProgramChanged();
      this.autoSave();
    }
  }

  public moveCommand(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const [cmd] = this.currentProgram.splice(fromIndex, 1);
    this.currentProgram.splice(toIndex, 0, cmd);
    this.renderRightPanel();
    this.notifyProgramChanged();
    this.autoSave();
  }

  public updateMode(mode: LearningMode, lang: 'ru' | 'en'): void {
    this.learningMode = mode;
    this.language = lang;
    this.renderLeftPanel();
    this.renderRightPanel();
  }

  // Блокировка во время выполнения
  public setExecuting(executing: boolean): void {
    this.isExecuting = executing;
    this.setEnabled(!executing);
  }

  private setEnabled(enabled: boolean): void {
    const leftButtons = this.leftPanelEl.querySelectorAll('.command-btn');
    const rightItems = this.rightPanelEl.querySelectorAll('.script-item');
    leftButtons.forEach(btn => (btn as HTMLButtonElement).disabled = !enabled);
    rightItems.forEach(item => {
      (item as HTMLElement).style.pointerEvents = enabled ? 'auto' : 'none';
    });
  }

  // ---------- Приватные методы ----------
  private initDOM(): void {
    this.container = document.createElement('div');
    this.container.className = 'command-panel';
    this.container.innerHTML = `
      <div class="panel-left">
        <h3 data-i18n="commands-title">Commands</h3>
        <div class="commands-grid" id="commands-grid"></div>
      </div>
      <div class="panel-right">
        <h3 data-i18n="program-title">Program</h3>
        <div class="script-area" id="script-area">
          <div class="script-list" id="script-list"></div>
          <div class="script-drop-zone" data-i18n="drop-zone">Drag commands here</div>
        </div>
        <div class="panel-actions">
          <button id="clear-btn" data-i18n="clear-btn">Clear</button>
          <button id="run-btn" data-i18n="run-btn">Run</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.container);

    this.leftPanelEl = this.container.querySelector('#commands-grid') as HTMLElement;
    this.rightPanelEl = this.container.querySelector('#script-list') as HTMLElement;

    // Кнопки действий
    const clearBtn = this.container.querySelector('#clear-btn') as HTMLButtonElement;
    const runBtn = this.container.querySelector('#run-btn') as HTMLButtonElement;
    clearBtn.addEventListener('click', () => this.clearProgram());
    runBtn.addEventListener('click', () => {
      if (!this.isExecuting) {
        eventBus.emit('COMMAND_QUEUE_CHANGED', { commands: this.currentProgram });
      }
    });

    // Настройка drop-зоны для мыши
    const dropZone = this.container.querySelector('.script-drop-zone') as HTMLElement;
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const cmd = e.dataTransfer?.getData('text/plain') as Command;
      if (cmd && this.availableCommands.includes(cmd)) {
        this.addCommand(cmd);
      }
    });
    // Touch-версия для drop
    dropZone.addEventListener('touchstart', (e) => { e.preventDefault(); });
    dropZone.addEventListener('touchend', (e) => {
      e.preventDefault();
      // В реальности нужно хранить последний перетаскиваемый элемент, упростим: используем глобальную переменную
      const cmd = (window as any).__dragCommand;
      if (cmd && this.availableCommands.includes(cmd)) {
        this.addCommand(cmd);
        (window as any).__dragCommand = null;
      }
    });
  }

  private getCommandDisplay(cmd: Command): { displayText: string; tooltip: string } {
    const meta = COMMAND_METADATA[cmd];
    if (!meta) {
      return { displayText: '❓', tooltip: cmd };
    }
    const label = this.language === 'ru' ? meta.labelRu : meta.labelEn;
    const syntax = this.language === 'ru' ? meta.syntaxPython : meta.syntaxJs;
    let displayText = '';
    switch (this.learningMode) {
      case LearningMode.KIDDO:
        displayText = meta.icon;
        break;
      case LearningMode.SCHOLAR:
        displayText = `${meta.icon} ${label}`;
        break;
      case LearningMode.DEV_STUDENT:
        displayText = `${meta.icon} ${label} (${syntax})`;
        break;
      case LearningMode.DEVELOPER:
        displayText = syntax;
        break;
    }
    return { displayText, tooltip: `${label}\n${syntax}` };
  }

  private renderLeftPanel(): void {
    this.leftPanelEl.innerHTML = '';
    for (const cmd of this.availableCommands) {
      const { displayText, tooltip } = this.getCommandDisplay(cmd);
      const btn = document.createElement('button');
      btn.className = 'command-btn';
      btn.innerHTML = displayText;
      btn.title = tooltip;
      btn.draggable = true;
      // Mouse events
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', cmd);
        e.dataTransfer!.effectAllowed = 'copy';
      });
      // Touch events
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        (window as any).__dragCommand = cmd;
        // Визуальный фидбек
        btn.style.opacity = '0.5';
        setTimeout(() => { btn.style.opacity = '1'; }, 200);
      });
      this.leftPanelEl.appendChild(btn);
    }
  }

  private renderRightPanel(): void {
    this.rightPanelEl.innerHTML = '';
    for (let i = 0; i < this.currentProgram.length; i++) {
      const cmd = this.currentProgram[i];
      const { displayText, tooltip } = this.getCommandDisplay(cmd);
      const item = document.createElement('div');
      item.className = 'script-item';
      item.setAttribute('data-index', i.toString());
      item.innerHTML = `
        <span class="script-index">${i + 1}</span>
        <span class="script-command" title="${tooltip.replace(/"/g, '&quot;')}">${displayText}</span>
        <button class="script-delete">✖</button>
      `;
      // Drag & drop для мыши (переупорядочивание)
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', `move:${i}`);
        e.dataTransfer!.effectAllowed = 'move';
      });
      item.addEventListener('dragover', (e) => e.preventDefault());
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = e.dataTransfer?.getData('text/plain');
        if (data && data.startsWith('move:')) {
          const fromIndex = parseInt(data.split(':')[1], 10);
          this.moveCommand(fromIndex, i);
        }
      });
      // Touch-версия для переупорядочивания
      item.addEventListener('touchstart', (e) => {
        this.dragStartIndex = i;
        item.style.opacity = '0.5';
      });
      item.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        const targetItem = target?.closest('.script-item');
        if (targetItem && this.dragStartIndex !== null) {
          const targetIndex = parseInt(targetItem.getAttribute('data-index') || '0', 10);
          if (targetIndex !== this.dragStartIndex) {
            this.moveCommand(this.dragStartIndex, targetIndex);
            this.dragStartIndex = targetIndex;
          }
        }
      });
      item.addEventListener('touchend', () => {
        this.dragStartIndex = null;
        item.style.opacity = '1';
      });
      const delBtn = item.querySelector('.script-delete') as HTMLButtonElement;
      delBtn.addEventListener('click', () => this.removeCommand(i));
      this.rightPanelEl.appendChild(item);
    }
    if (this.currentProgram.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'script-placeholder';
      placeholder.innerText = this.language === 'ru' ? 'Перетащите команды сюда' : 'Drag commands here';
      this.rightPanelEl.appendChild(placeholder);
    }
  }

  private notifyProgramChanged(): void {
    eventBus.emit('COMMAND_QUEUE_CHANGED', { commands: this.currentProgram });
  }

  private autoSave(): void {
    if (this.currentLevelId) {
      saveManager.saveProgram(this.currentLevelId, this.currentProgram, true);
    }
  }

  private setupEventListeners(): void {
    eventBus.on('SETTINGS_CHANGED', (payload) => {
      if (payload && payload.learningMode !== undefined) {
        this.updateMode(payload.learningMode, payload.language || 'en');
      }
    });
    eventBus.on('PROGRAM_LOADED', (payload) => {
      if (payload && payload.commands) {
        this.currentProgram = [...payload.commands];
        this.renderRightPanel();
      }
    });
  }

  // Уничтожение панели (вызывать при смене сцены)
  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    eventBus.off('SETTINGS_CHANGED');
    eventBus.off('PROGRAM_LOADED');
  }
}
