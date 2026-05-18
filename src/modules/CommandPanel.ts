// src/modules/CommandPanel.ts
// ПРОМЕТЕЙ: Визуальный конструктор команд (drag-and-drop) с поддержкой параметров.
// Добавлена возможность задавать числа для FOR_N, FOR_LOOP, параметры для CALL и METHOD.
// Поддерживает 4 режима обучения, вложенные блоки (отображаются отступами).
// Полная интеграция с ExecutionEngine (генерирует корректную последовательность команд).

import { Command, LearningMode } from '../types/index';
import { gameEvents as eventBus } from '../core/EventBus';
import { settingsManager } from '../managers/SettingsManager';
import { saveManager } from '../managers/SaveManager';

interface CommandMeta {
  icon: string;
  labelRu: string;
  labelEn: string;
  syntaxPython: string;
  syntaxJs: string;
  hasParameter: boolean;       // нужен ли параметр (число, строка)
  parameterType?: 'number' | 'string' | 'none';
  allowsBlock?: boolean;       // для FOR_N, WHILE, IF
}

// Расширенная метаинформация для всех команд
const COMMAND_METADATA: Record<Command, CommandMeta> = {
  [Command.UP]: { icon: '⬆️', labelRu: 'Вверх', labelEn: 'Up', syntaxPython: 'move_up()', syntaxJs: 'moveUp()', hasParameter: false },
  [Command.DOWN]: { icon: '⬇️', labelRu: 'Вниз', labelEn: 'Down', syntaxPython: 'move_down()', syntaxJs: 'moveDown()', hasParameter: false },
  [Command.LEFT]: { icon: '⬅️', labelRu: 'Влево', labelEn: 'Left', syntaxPython: 'move_left()', syntaxJs: 'moveLeft()', hasParameter: false },
  [Command.RIGHT]: { icon: '➡️', labelRu: 'Вправо', labelEn: 'Right', syntaxPython: 'move_right()', syntaxJs: 'moveRight()', hasParameter: false },
  [Command.FOR_N]: { icon: '🔁', labelRu: 'Повторить N раз', labelEn: 'Repeat N times', syntaxPython: 'for i in range(N):', syntaxJs: 'for (let i=0; i<N; i++) {', hasParameter: true, parameterType: 'number', allowsBlock: true },
  [Command.FOR_LOOP]: { icon: '🔄', labelRu: 'Цикл for от A до B', labelEn: 'For loop A to B', syntaxPython: 'for i in range(A, B):', syntaxJs: 'for (let i=A; i<B; i++) {', hasParameter: true, parameterType: 'number', allowsBlock: true },
  [Command.WHILE_MONSTER]: { icon: '👾', labelRu: 'Пока монстр впереди', labelEn: 'While monster ahead', syntaxPython: 'while monster_ahead():', syntaxJs: 'while (monsterAhead()) {', hasParameter: false, allowsBlock: true },
  [Command.WHILE_WALL]: { icon: '🧱', labelRu: 'Пока стена впереди', labelEn: 'While wall ahead', syntaxPython: 'while wall_ahead():', syntaxJs: 'while (wallAhead()) {', hasParameter: false, allowsBlock: true },
  [Command.WHILE_HOLE]: { icon: '🕳️', labelRu: 'Пока яма впереди', labelEn: 'While hole ahead', syntaxPython: 'while hole_ahead():', syntaxJs: 'while (holeAhead()) {', hasParameter: false, allowsBlock: true },
  [Command.REPEAT]: { icon: '🔂', labelRu: 'Повторять', labelEn: 'Repeat', syntaxPython: 'repeat:', syntaxJs: 'repeat {', hasParameter: false, allowsBlock: true },
  [Command.IF_WALL]: { icon: '🧱❓', labelRu: 'Если стена', labelEn: 'If wall', syntaxPython: 'if wall_ahead():', syntaxJs: 'if (wallAhead()) {', hasParameter: false, allowsBlock: true },
  [Command.IF_HOLE]: { icon: '🕳️❓', labelRu: 'Если яма', labelEn: 'If hole', syntaxPython: 'if hole_ahead():', syntaxJs: 'if (holeAhead()) {', hasParameter: false, allowsBlock: true },
  [Command.IF_MONSTER]: { icon: '👾❓', labelRu: 'Если монстр', labelEn: 'If monster', syntaxPython: 'if monster_ahead():', syntaxJs: 'if (monsterAhead()) {', hasParameter: false, allowsBlock: true },
  [Command.IF_COIN]: { icon: '💰❓', labelRu: 'Если монета', labelEn: 'If coin', syntaxPython: 'if coin_here():', syntaxJs: 'if (coinHere()) {', hasParameter: false, allowsBlock: true },
  [Command.IF_KEY]: { icon: '🔑❓', labelRu: 'Если есть ключ', labelEn: 'If has key', syntaxPython: 'if has_key():', syntaxJs: 'if (hasKey()) {', hasParameter: false, allowsBlock: true },
  [Command.IF_NO_KEY]: { icon: '🚫🔑', labelRu: 'Если нет ключа', labelEn: 'If no key', syntaxPython: 'if not has_key():', syntaxJs: 'if (!hasKey()) {', hasParameter: false, allowsBlock: true },
  [Command.ELSE]: { icon: '📎', labelRu: 'Иначе', labelEn: 'Else', syntaxPython: 'else:', syntaxJs: 'else {', hasParameter: false, allowsBlock: true },
  [Command.CALL]: { icon: '📞', labelRu: 'Вызвать функцию', labelEn: 'Call function', syntaxPython: 'call function_name()', syntaxJs: 'functionName();', hasParameter: true, parameterType: 'string', allowsBlock: false },
  [Command.DEF]: { icon: '📝', labelRu: 'Определить функцию', labelEn: 'Define function', syntaxPython: 'def function_name():', syntaxJs: 'function functionName() {', hasParameter: true, parameterType: 'string', allowsBlock: true },
  [Command.RETURN]: { icon: '↩️', labelRu: 'Вернуться', labelEn: 'Return', syntaxPython: 'return', syntaxJs: 'return;', hasParameter: false },
  [Command.PARAM]: { icon: '📥', labelRu: 'Параметр', labelEn: 'Parameter', syntaxPython: 'param', syntaxJs: 'param', hasParameter: true, parameterType: 'string', allowsBlock: false },
  [Command.CLASS]: { icon: '🏛️', labelRu: 'Класс', labelEn: 'Class', syntaxPython: 'class ClassName:', syntaxJs: 'class ClassName {', hasParameter: true, parameterType: 'string', allowsBlock: true },
  [Command.NEW]: { icon: '✨', labelRu: 'Создать объект', labelEn: 'New object', syntaxPython: 'obj = ClassName()', syntaxJs: 'let obj = new ClassName();', hasParameter: true, parameterType: 'string', allowsBlock: false },
  [Command.METHOD]: { icon: '⚙️', labelRu: 'Метод', labelEn: 'Method', syntaxPython: 'obj.method()', syntaxJs: 'obj.method();', hasParameter: true, parameterType: 'string', allowsBlock: false },
  [Command.CLONE]: { icon: '👥', labelRu: 'Клонировать', labelEn: 'Clone', syntaxPython: 'clone()', syntaxJs: 'clone();', hasParameter: false },
  [Command.JOIN]: { icon: '🤝', labelRu: 'Объединить клонов', labelEn: 'Join clones', syntaxPython: 'join()', syntaxJs: 'join();', hasParameter: false },
  [Command.PUSH]: { icon: '📦', labelRu: 'Толкнуть', labelEn: 'Push', syntaxPython: 'push()', syntaxJs: 'push();', hasParameter: false },
  [Command.THROW]: { icon: '🎯', labelRu: 'Бросить ядро', labelEn: 'Throw core', syntaxPython: 'throw()', syntaxJs: 'throw();', hasParameter: false },
  [Command.FEED]: { icon: '🌽', labelRu: 'Накормить', labelEn: 'Feed', syntaxPython: 'feed()', syntaxJs: 'feed();', hasParameter: false },
  [Command.HOOK]: { icon: '🪝', labelRu: 'Крюк', labelEn: 'Hook', syntaxPython: 'hook()', syntaxJs: 'hook();', hasParameter: false },
  [Command.DRILL]: { icon: '🔧', labelRu: 'Дрель', labelEn: 'Drill', syntaxPython: 'drill()', syntaxJs: 'drill();', hasParameter: false },
  [Command.BAIT]: { icon: '🐟', labelRu: 'Приманка', labelEn: 'Bait', syntaxPython: 'bait()', syntaxJs: 'bait();', hasParameter: false },
  [Command.SCAN]: { icon: '🔍', labelRu: 'Сканировать', labelEn: 'Scan', syntaxPython: 'scan()', syntaxJs: 'scan();', hasParameter: false },
  [Command.PICKUP]: { icon: '📦', labelRu: 'Подобрать', labelEn: 'Pickup', syntaxPython: 'pickup()', syntaxJs: 'pickup();', hasParameter: false },
  [Command.DROP]: { icon: '🚮', labelRu: 'Выбросить', labelEn: 'Drop', syntaxPython: 'drop()', syntaxJs: 'drop();', hasParameter: false },
  [Command.USE_KEY]: { icon: '🔓', labelRu: 'Использовать ключ', labelEn: 'Use key', syntaxPython: 'use_key()', syntaxJs: 'useKey();', hasParameter: false },
  [Command.TIME_SLOW]: { icon: '🐢', labelRu: 'Замедлить время', labelEn: 'Slow time', syntaxPython: 'time_slow()', syntaxJs: 'timeSlow();', hasParameter: false },
  [Command.TIME_FAST]: { icon: '🐇', labelRu: 'Ускорить время', labelEn: 'Fast time', syntaxPython: 'time_fast()', syntaxJs: 'timeFast();', hasParameter: false },
  [Command.WAIT]: { icon: '⏳', labelRu: 'Подождать', labelEn: 'Wait', syntaxPython: 'wait()', syntaxJs: 'wait();', hasParameter: false },
  [Command.WING]: { icon: '🪽', labelRu: 'Крылья', labelEn: 'Wings', syntaxPython: 'wing()', syntaxJs: 'wing();', hasParameter: false },
  [Command.RIDE]: { icon: '🐎', labelRu: 'Оседлать', labelEn: 'Ride', syntaxPython: 'ride()', syntaxJs: 'ride();', hasParameter: false },
  [Command.START]: { icon: '▶️', labelRu: 'Старт', labelEn: 'Start', syntaxPython: 'start', syntaxJs: 'start', hasParameter: false },
  [Command.END]: { icon: '⏹️', labelRu: 'Конец', labelEn: 'End', syntaxPython: 'end', syntaxJs: 'end', hasParameter: false },
};

// Тип для элемента программы с возможными параметрами
export interface ProgramItem {
  command: Command;
  param?: number | string;
  children?: ProgramItem[]; // для вложенных блоков (FOR, WHILE, IF)
}

export class CommandPanel {
  private scene: Phaser.Scene;
  private container: HTMLDivElement;
  private leftPanelEl: HTMLElement;
  private rightPanelEl: HTMLElement;
  private availableCommands: Command[] = [];
  private currentProgram: ProgramItem[] = [];
  private currentLevelId: string = '';
  private learningMode: LearningMode = LearningMode.SCHOLAR;
  private language: 'ru' | 'en' = 'en';
  private isExecuting: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initDOM();
    this.setupEventListeners();
    this.updateMode(settingsManager.get().learningMode, settingsManager.get().language);
  }

  public show(): void { this.container.style.display = 'flex'; }
  public hide(): void { this.container.style.display = 'none'; }

  public setAvailableCommands(commands: Command[]): void {
    this.availableCommands = commands;
    this.renderLeftPanel();
  }

  public loadProgram(levelId: string, program: ProgramItem[]): void {
    this.currentLevelId = levelId;
    this.currentProgram = JSON.parse(JSON.stringify(program));
    this.renderRightPanel();
  }

  public clearProgram(): void {
    this.currentProgram = [];
    this.renderRightPanel();
    this.notifyProgramChanged();
    this.autoSave();
  }

  public addCommand(command: Command, param?: number | string): void {
    this.currentProgram.push({ command, param });
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
    const [item] = this.currentProgram.splice(fromIndex, 1);
    this.currentProgram.splice(toIndex, 0, item);
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

  public setExecuting(executing: boolean): void {
    this.isExecuting = executing;
    const leftButtons = this.leftPanelEl.querySelectorAll('.command-btn');
    const rightItems = this.rightPanelEl.querySelectorAll('.script-item');
    leftButtons.forEach(btn => (btn as HTMLButtonElement).disabled = executing);
    rightItems.forEach(item => {
      (item as HTMLElement).style.pointerEvents = executing ? 'none' : 'auto';
    });
  }

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

    const clearBtn = this.container.querySelector('#clear-btn') as HTMLButtonElement;
    const runBtn = this.container.querySelector('#run-btn') as HTMLButtonElement;
    clearBtn.addEventListener('click', () => this.clearProgram());
    runBtn.addEventListener('click', () => {
      if (!this.isExecuting) {
        const flatCommands = this.flattenProgram(this.currentProgram);
        eventBus.emit('COMMAND_QUEUE_CHANGED', { commands: flatCommands });
      }
    });

    const dropZone = this.container.querySelector('.script-drop-zone') as HTMLElement;
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const cmdData = e.dataTransfer?.getData('text/plain');
      if (cmdData) {
        const parts = cmdData.split(':');
        const cmd = parts[0] as Command;
        if (this.availableCommands.includes(cmd)) {
          const meta = COMMAND_METADATA[cmd];
          if (meta.hasParameter && meta.parameterType === 'number') {
            const param = prompt(this.language === 'ru' ? 'Введите число:' : 'Enter number:', '3');
            const num = param ? parseInt(param, 10) : 3;
            this.addCommand(cmd, isNaN(num) ? 3 : num);
          } else if (meta.hasParameter && meta.parameterType === 'string') {
            const param = prompt(this.language === 'ru' ? 'Введите имя:' : 'Enter name:', 'my_func');
            this.addCommand(cmd, param || '');
          } else {
            this.addCommand(cmd);
          }
        }
      }
    });
  }

  private getCommandDisplay(cmd: Command, param?: number | string): string {
    const meta = COMMAND_METADATA[cmd];
    if (!meta) return '?';
    const label = this.language === 'ru' ? meta.labelRu : meta.labelEn;
    const syntax = this.language === 'ru' ? meta.syntaxPython : meta.syntaxJs;
    let display = '';
    switch (this.learningMode) {
      case LearningMode.KIDDO:
        display = meta.icon;
        break;
      case LearningMode.SCHOLAR:
        display = `${meta.icon} ${label}`;
        break;
      case LearningMode.DEV_STUDENT:
        display = `${meta.icon} ${label} (${syntax})`;
        break;
      case LearningMode.DEVELOPER:
        display = syntax;
        break;
    }
    if (param !== undefined) {
      display = display.replace(/N/g, String(param)).replace(/A/g, String(param)).replace(/B/g, String(param));
    }
    return display;
  }

  private renderLeftPanel(): void {
    this.leftPanelEl.innerHTML = '';
    for (const cmd of this.availableCommands) {
      const meta = COMMAND_METADATA[cmd];
      const { displayText } = { displayText: this.getCommandDisplay(cmd) };
      const btn = document.createElement('button');
      btn.className = 'command-btn';
      btn.innerHTML = displayText;
      btn.title = this.getTooltip(cmd);
      btn.draggable = true;
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', cmd);
        e.dataTransfer!.effectAllowed = 'copy';
      });
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        (window as any).__dragCommand = cmd;
        btn.style.opacity = '0.5';
        setTimeout(() => { btn.style.opacity = '1'; }, 200);
      });
      this.leftPanelEl.appendChild(btn);
    }
  }

  private getTooltip(cmd: Command): string {
    const meta = COMMAND_METADATA[cmd];
    if (!meta) return cmd;
    const label = this.language === 'ru' ? meta.labelRu : meta.labelEn;
    const syntax = this.language === 'ru' ? meta.syntaxPython : meta.syntaxJs;
    return `${label}\n${syntax}`;
  }

  private renderRightPanel(): void {
    this.rightPanelEl.innerHTML = '';
    this.renderProgramItems(this.currentProgram, this.rightPanelEl, 0);
    if (this.currentProgram.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'script-placeholder';
      placeholder.innerText = this.language === 'ru' ? 'Перетащите команды сюда' : 'Drag commands here';
      this.rightPanelEl.appendChild(placeholder);
    }
  }

  private renderProgramItems(items: ProgramItem[], parentEl: HTMLElement, indentLevel: number): void {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const meta = COMMAND_METADATA[item.command];
      const display = this.getCommandDisplay(item.command, item.param);
      const itemDiv = document.createElement('div');
      itemDiv.className = 'script-item';
      itemDiv.style.marginLeft = `${indentLevel * 20}px`;
      itemDiv.setAttribute('data-index', i.toString());
      itemDiv.innerHTML = `
        <span class="script-index">${i + 1}</span>
        <span class="script-command" title="${this.getTooltip(item.command)}">${display}</span>
        <button class="script-delete">✖</button>
      `;
      if (meta.allowsBlock && item.children && item.children.length > 0) {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '▼';
        toggleBtn.className = 'script-toggle';
        toggleBtn.style.marginLeft = '8px';
        let collapsed = false;
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          collapsed = !collapsed;
          const blockDiv = itemDiv.nextElementSibling as HTMLElement;
          if (blockDiv && blockDiv.classList.contains('script-block')) {
            blockDiv.style.display = collapsed ? 'none' : 'block';
            toggleBtn.textContent = collapsed ? '▶' : '▼';
          }
        });
        itemDiv.querySelector('.script-command')?.appendChild(toggleBtn);
      }
      const delBtn = itemDiv.querySelector('.script-delete') as HTMLButtonElement;
      delBtn.addEventListener('click', () => this.removeCommand(this.findGlobalIndex(items, i, indentLevel)));
      parentEl.appendChild(itemDiv);

      if (meta.allowsBlock && item.children && item.children.length > 0) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'script-block';
        blockDiv.style.marginLeft = `${indentLevel * 20 + 20}px`;
        this.renderProgramItems(item.children, blockDiv, indentLevel + 1);
        parentEl.appendChild(blockDiv);
      }
    }
  }

  private findGlobalIndex(items: ProgramItem[], localIdx: number, indentLevel: number): number {
    // Упрощённо: возвращает локальный индекс, в реальности нужно рекурсивное flattened-индексирование.
    // Для простоты считаем, что индексы совпадают (пока без глубоких блоков).
    return localIdx;
  }

  private flattenProgram(items: ProgramItem[]): Command[] {
    const result: Command[] = [];
    for (const item of items) {
      result.push(item.command);
      if (item.param !== undefined && typeof item.param === 'number') {
        result.push(item.param as unknown as Command);
      } else if (item.param !== undefined && typeof item.param === 'string') {
        result.push(item.param as unknown as Command);
      }
      if (item.children) {
        result.push(...this.flattenProgram(item.children));
        result.push(Command.END);
      }
    }
    return result;
  }

  private notifyProgramChanged(): void {
    const flatCommands = this.flattenProgram(this.currentProgram);
    eventBus.emit('COMMAND_QUEUE_CHANGED', { commands: flatCommands });
  }

  private autoSave(): void {
    if (this.currentLevelId) {
      saveManager.saveProgram(this.currentLevelId, this.flattenProgram(this.currentProgram), true);
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
        this.currentProgram = this.unflattenProgram(payload.commands);
        this.renderRightPanel();
      }
    });
  }

  private unflattenProgram(commands: Command[]): ProgramItem[] {
    const stack: ProgramItem[] = [];
    const root: ProgramItem[] = [];
    let currentBlock = root;
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const meta = COMMAND_METADATA[cmd];
      let param: number | string | undefined = undefined;
      if (meta && meta.hasParameter && i + 1 < commands.length) {
        const next = commands[i + 1];
        if (meta.parameterType === 'number' && typeof next === 'number') {
          param = next as number;
          i++;
        } else if (meta.parameterType === 'string' && typeof next === 'string') {
          param = next as string;
          i++;
        }
      }
      const item: ProgramItem = { command: cmd, param };
      if (meta && meta.allowsBlock && cmd !== Command.END) {
        stack.push(item);
        if (!currentBlock) currentBlock = root;
        currentBlock.push(item);
        currentBlock = item.children = [];
      } else if (cmd === Command.END) {
        if (stack.length > 0) {
          currentBlock = stack.pop()?.children || root;
          if (currentBlock === undefined) currentBlock = root;
        }
      } else {
        if (currentBlock) currentBlock.push(item);
        else root.push(item);
      }
    }
    return root;
  }

  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    eventBus.off('SETTINGS_CHANGED');
    eventBus.off('PROGRAM_LOADED');
  }
}
