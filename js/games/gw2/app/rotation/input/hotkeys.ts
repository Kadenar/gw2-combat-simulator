import { escapeHtml } from '#gw2/app/presentation/shared/html.js';

export const ROTATION_HOTKEY_STORAGE_KEY = 'gw2-rotation-hotkeys-v1';
export const ROTATION_HOTKEY_ENABLED_STORAGE_KEY = 'gw2-rotation-hotkeys-enabled-v1';

export const ROTATION_HOTKEY_ACTIONS = Object.freeze([
  { id: 'weapon-swap', label: 'Weapon swap', group: 'Weapon', code: 'Backquote' },
  { id: 'weapon-1', label: 'Weapon skill 1', group: 'Weapon', code: 'Digit1' },
  { id: 'weapon-2', label: 'Weapon skill 2', group: 'Weapon', code: 'Digit2' },
  { id: 'weapon-3', label: 'Weapon skill 3', group: 'Weapon', code: 'Digit3' },
  { id: 'weapon-4', label: 'Weapon skill 4', group: 'Weapon', code: 'Digit4' },
  { id: 'weapon-5', label: 'Weapon skill 5', group: 'Weapon', code: 'Digit5' },
  { id: 'slot-6', label: 'Heal skill', group: 'Utility', code: 'Digit6' },
  { id: 'slot-7', label: 'Utility skill 1', group: 'Utility', code: 'Digit7' },
  { id: 'slot-8', label: 'Utility skill 2', group: 'Utility', code: 'Digit8' },
  { id: 'slot-9', label: 'Utility skill 3', group: 'Utility', code: 'Digit9' },
  { id: 'slot-10', label: 'Elite skill', group: 'Utility', code: 'Digit0' },
  {
    id: 'profession-1',
    label: 'Profession skill 1',
    group: 'Profession',
    code: 'F1'
  },
  {
    id: 'profession-2',
    label: 'Profession skill 2',
    group: 'Profession',
    code: 'F2'
  },
  {
    id: 'profession-3',
    label: 'Profession skill 3',
    group: 'Profession',
    code: 'F3'
  },
  {
    id: 'profession-4',
    label: 'Profession skill 4',
    group: 'Profession',
    code: 'F4'
  },
  {
    id: 'profession-5',
    label: 'Profession skill 5',
    group: 'Profession',
    code: 'F5'
  },
  {
    id: 'profession-6',
    label: 'Profession skill 6',
    group: 'Profession',
    code: 'F6'
  },
  {
    id: 'profession-7',
    label: 'Profession skill 7',
    group: 'Profession',
    code: 'F7'
  }
] as const);

export type RotationHotkeyAction = (typeof ROTATION_HOTKEY_ACTIONS)[number]['id'];
export type RotationHotkeyBindings = Record<RotationHotkeyAction, string>;

export interface RotationHotkeyImportResult {
  readonly bindings: Partial<RotationHotkeyBindings>;
  readonly importedActions: readonly RotationHotkeyAction[];
  readonly skippedActions: readonly RotationHotkeyAction[];
}

/** Optional game-owned parser shown by the otherwise shared hotkey editor. */
export interface RotationHotkeyImport {
  readonly label: string;
  readonly accept: string;
  parse(source: string): RotationHotkeyImportResult | Promise<RotationHotkeyImportResult>;
}

type HotkeyStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface RotationHotkeyController {
  root: HTMLElement;
  scope: HTMLElement;
  bindings: RotationHotkeyBindings;
  enabled: boolean;
  active: boolean;
  button: HTMLButtonElement | null;
  dialog: HTMLDialogElement | null;
  keybindImport?: RotationHotkeyImport;
  activate: (action: RotationHotkeyAction, event: KeyboardEvent | PointerEvent) => boolean;
  refresh: () => void;
}

const actionIds = new Set<string>(ROTATION_HOTKEY_ACTIONS.map((action) => action.id));
const controllers = new WeakMap<Document, RotationHotkeyController>();

function browserStorage(): HotkeyStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function defaultRotationHotkeyBindings(): RotationHotkeyBindings {
  return Object.fromEntries(ROTATION_HOTKEY_ACTIONS.map(({ id, code }) => [id, code])) as RotationHotkeyBindings;
}

/** Keeps the current hotkey state inside its toolbar action instead of a detached status label. */
export function rotationHotkeyStatusLabel(enabled: boolean, active: boolean): string {
  return !enabled ? 'Hotkeys: Disabled' : active ? 'Hotkeys: On' : 'Hotkeys: Off';
}

function validKeyboardCode(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  if (value === '') return true;
  const parts = value.split('+');
  const code = parts.pop();
  const modifiers = parts.join('+');
  return Boolean(
    code &&
    /^[A-Za-z][A-Za-z0-9]*$/.test(code) &&
    ['', 'Ctrl', 'Alt', 'Shift', 'Ctrl+Alt', 'Ctrl+Shift', 'Alt+Shift', 'Ctrl+Alt+Shift'].includes(modifiers)
  );
}

export function normalizeRotationHotkeyBindings(value: unknown): RotationHotkeyBindings {
  const defaults = defaultRotationHotkeyBindings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const input = value as Record<string, unknown>;
  for (const action of ROTATION_HOTKEY_ACTIONS) {
    const candidate = input[action.id];
    if (Object.prototype.hasOwnProperty.call(input, action.id) && validKeyboardCode(candidate)) {
      defaults[action.id] = candidate;
    }
  }

  return defaults;
}

export function loadRotationHotkeyBindings(storage: HotkeyStorage | null = browserStorage()): RotationHotkeyBindings {
  if (!storage) return defaultRotationHotkeyBindings();
  try {
    return normalizeRotationHotkeyBindings(JSON.parse(storage.getItem(ROTATION_HOTKEY_STORAGE_KEY) || 'null'));
  } catch {
    return defaultRotationHotkeyBindings();
  }
}

export function saveRotationHotkeyBindings(
  bindings: RotationHotkeyBindings,
  storage: HotkeyStorage | null = browserStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(ROTATION_HOTKEY_STORAGE_KEY, JSON.stringify(normalizeRotationHotkeyBindings(bindings)));
  } catch {
    // Hotkeys still work for this page when storage is unavailable.
  }
}

export function loadRotationHotkeysEnabled(storage: HotkeyStorage | null = browserStorage()): boolean {
  // Hotkeys are on by default; an explicit stored 'false' is the only opt-out.
  if (!storage) return true;
  try {
    return storage.getItem(ROTATION_HOTKEY_ENABLED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveRotationHotkeysEnabled(enabled: boolean, storage: HotkeyStorage | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(ROTATION_HOTKEY_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // The setting remains available for this page when storage is unavailable.
  }
}

export function rotationHotkeyActionForSkillSlot(slot: unknown): RotationHotkeyAction | '' {
  const match = /^(Weapon_([1-5])|Profession_([1-7]))$/.exec(String(slot || ''));
  if (!match) return '';
  const action = match[2] ? `weapon-${match[2]}` : `profession-${match[3]}`;
  return actionIds.has(action) ? (action as RotationHotkeyAction) : '';
}

/** Assigns the shared weapon-swap pseudo-skill to its configurable hotkey in every profession palette. */
export function rotationHotkeyActionForSkillName(name: unknown): RotationHotkeyAction | '' {
  return String(name || '') === 'Swap Weapons' ? 'weapon-swap' : '';
}

export function rotationUtilityHotkeyAction(index: number): RotationHotkeyAction | '' {
  const action = `slot-${index + 6}`;
  return index >= 0 && index < 5 && actionIds.has(action) ? (action as RotationHotkeyAction) : '';
}

export function rotationLoadoutHotkeyActions(
  bars: readonly { readonly skillIds: readonly unknown[] }[],
  skillChildren: (skillId: number) => readonly unknown[] = () => []
): ReadonlyMap<number, RotationHotkeyAction> {
  const hotkeys = new Map<number, RotationHotkeyAction>();
  const addSkill = (rawSkillId: unknown, action: RotationHotkeyAction, visited: Set<number>): void => {
    const skillId = Number(rawSkillId);
    if (!Number.isFinite(skillId) || visited.has(skillId)) return;
    visited.add(skillId);
    hotkeys.set(skillId, action);
    for (const childId of skillChildren(skillId)) {
      addSkill(childId, action, visited);
    }
  };

  for (const bar of bars) {
    bar.skillIds.forEach((skillId, index) => {
      const action = rotationUtilityHotkeyAction(index);
      if (action) addSkill(skillId, action, new Set<number>());
    });
  }

  return hotkeys;
}

export function rotationHotkeyActionForCode(
  bindings: RotationHotkeyBindings,
  code: string
): RotationHotkeyAction | null {
  return ROTATION_HOTKEY_ACTIONS.find((action) => bindings[action.id] && bindings[action.id] === code)?.id || null;
}

export function activeRotationHotkeyAction(
  bindings: RotationHotkeyBindings,
  event: Pick<KeyboardEvent, 'code' | 'isComposing' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  active: boolean
): RotationHotkeyAction | null {
  if (!active || event.isComposing || event.metaKey) return null;

  const ownModifier = event.code.startsWith('Control')
    ? 'Ctrl'
    : event.code.startsWith('Alt')
      ? 'Alt'
      : event.code.startsWith('Shift')
        ? 'Shift'
        : '';
  const parts: string[] = [];
  if (event.ctrlKey && ownModifier !== 'Ctrl') parts.push('Ctrl');
  if (event.altKey && ownModifier !== 'Alt') parts.push('Alt');
  if (event.shiftKey && ownModifier !== 'Shift') parts.push('Shift');
  parts.push(event.code);

  const exact = rotationHotkeyActionForCode(bindings, parts.join('+'));
  if (exact || !event.shiftKey || ownModifier === 'Shift') return exact;

  // An unbound Shift modifier retains the rotation builder's concurrent-cast shortcut.
  return rotationHotkeyActionForCode(bindings, parts.filter((part) => part !== 'Shift').join('+'));
}

export function activeRotationMouseHotkeyAction(
  bindings: RotationHotkeyBindings,
  event: Pick<MouseEvent, 'button' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  active: boolean
): RotationHotkeyAction | null {
  if (!active || event.metaKey || (event.button !== 3 && event.button !== 4)) return null;
  const code = `Mouse${event.button + 1}`;
  const parts = [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', code].filter(
    Boolean
  );
  const exact = rotationHotkeyActionForCode(bindings, parts.join('+'));
  if (exact || !event.shiftKey) return exact;

  return rotationHotkeyActionForCode(bindings, parts.filter((part) => part !== 'Shift').join('+'));
}

export function duplicateRotationHotkeyCodes(bindings: RotationHotkeyBindings): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const code of Object.values(bindings)) {
    if (!code) continue;
    if (seen.has(code)) duplicates.add(code);
    seen.add(code);
  }

  return [...duplicates];
}

const DISPLAY_CODES: Readonly<Record<string, string>> = Object.freeze({
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  Backquote: '`',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Equal: '=',
  Minus: '-',
  Mouse4: 'Mouse 4',
  Mouse5: 'Mouse 5',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Space: 'Space'
});

const BADGE_CODES: Readonly<Record<string, string>> = Object.freeze({
  Backspace: 'Bksp',
  CapsLock: 'Caps',
  Delete: 'Del',
  Enter: 'Ent',
  Escape: 'Esc',
  Insert: 'Ins',
  Mouse4: 'M4',
  Mouse5: 'M5',
  NumpadAdd: 'N+',
  NumpadClear: 'NClr',
  NumpadDecimal: 'N.',
  NumpadDivide: 'N/',
  NumpadEnter: 'NEnt',
  NumpadEqual: 'N=',
  NumpadMultiply: 'N*',
  NumpadSubtract: 'N-',
  PageDown: 'PgDn',
  PageUp: 'PgUp',
  PrintScreen: 'PrtSc',
  Space: 'Spc'
});

export function formatRotationHotkey(code: string): string {
  if (!code) return 'Unbound';
  const parts = code.split('+');
  const keyCode = parts.pop() || '';
  const label = /^Digit\d$/.test(keyCode)
    ? keyCode.slice(-1)
    : /^Key[A-Z]$/.test(keyCode)
      ? keyCode.slice(-1)
      : /^Numpad\d$/.test(keyCode)
        ? `Numpad ${keyCode.slice(-1)}`
        : DISPLAY_CODES[keyCode] || keyCode;
  return [...parts, label].join('+');
}

/** Keeps palette badges compact so long bindings identify the key without covering most of the skill icon. */
export function formatRotationHotkeyBadge(code: string): string {
  if (!code) return '';
  const parts = code.split('+');
  const keyCode = parts.pop() || '';
  const modifiers = parts.map((part) => ({ Ctrl: 'C', Alt: 'A', Shift: 'S' })[part] || part).join('');
  const keyLabel = /^Numpad\d$/.test(keyCode)
    ? `N${keyCode.slice(-1)}`
    : BADGE_CODES[keyCode] || formatRotationHotkey(keyCode);
  return modifiers ? `${modifiers}+${keyLabel}` : keyLabel;
}

function shouldIgnoreHotkey(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], dialog"));
}

function activateRotationHotkey(controller: RotationHotkeyController, event: KeyboardEvent): void {
  if (shouldIgnoreHotkey(event)) return;
  const action = activeRotationHotkeyAction(controller.bindings, event, controller.active);
  if (!action) return;
  if (event.repeat) return;
  if (controller.activate(action, event)) event.preventDefault();
}

/** Activates standard browser Mouse 4/5 events while the pointer remains over the active rotation palette. */
function activateRotationMouseHotkey(controller: RotationHotkeyController, event: PointerEvent): void {
  const action = activeRotationMouseHotkeyAction(controller.bindings, event, controller.active);
  if (!action) return;
  if (controller.activate(action, event)) event.preventDefault();
}

function hotkeyFieldsHtml(): string {
  return ['Weapon', 'Utility', 'Profession']
    .map(
      (group) => `<fieldset class="rotation-hotkey-group">
        <legend>${group}</legend>
        ${ROTATION_HOTKEY_ACTIONS.filter((action) => action.group === group)
          .map(
            (action) => `<label class="rotation-hotkey-field">
              <span>${escapeHtml(action.label)}</span>
              <input type="text" readonly data-hotkey-input="${escapeHtml(action.id)}"
                aria-label="${escapeHtml(action.label)} hotkey" />
            </label>`
          )
          .join('')}
      </fieldset>`
    )
    .join('');
}

function ensureStyles(document: Document): void {
  if (document.getElementById('rotation-hotkey-styles')) return;
  const style = document.createElement('style');
  style.id = 'rotation-hotkey-styles';
  style.textContent = `
    .pal-hotkey { position:absolute; z-index:4; top:-13px; right:1px; box-sizing:border-box;
      min-width:12px; max-width:calc(100% - 2px); padding:1px 3px; overflow:hidden;
      border:1px solid rgba(255,255,255,.65); border-radius:3px; background:rgba(12,14,20,.9);
      color:#fff; font-size:8px; font-weight:800; line-height:10px; text-align:center;
      text-overflow:ellipsis; white-space:nowrap;
      text-shadow:0 1px 2px #000; pointer-events:none; }
    /* Let active hotkey badges sit just above the tile without moving its cooldown or clipping the badge. */
    .pal-skill:has(> .pal-hotkey) { overflow:visible; }
    .rotation-panel:not(.rotation-hotkeys-active) .pal-hotkey { opacity:.45; }
    .rotation-hotkey-dialog { position:fixed; inset:0; width:min(720px, calc(100vw - 32px));
      max-height:calc(100vh - 32px); margin:auto; padding:0; overflow:auto;
      border:1px solid var(--border-light); border-radius:8px;
      background:var(--bg-panel); color:var(--text); box-shadow:0 18px 60px rgba(0,0,0,.65); }
    .rotation-hotkey-dialog::backdrop { background:rgba(5,7,12,.78); }
    .rotation-hotkey-form { padding:18px; }
    .rotation-hotkey-form h3 { margin:0 0 6px; }
    .rotation-hotkey-intro { margin:0 0 10px; color:var(--text-dim); font-size:12px; }
    .rotation-hotkey-enable { display:flex; align-items:center; gap:7px; margin:0 0 14px;
      padding:8px 10px; border:1px solid var(--border); border-radius:6px;
      background:var(--bg-panel-alt); color:var(--text-bright); font-size:12px; cursor:pointer; }
    .rotation-hotkey-enable input { accent-color:var(--accent); }
    .rotation-hotkey-groups { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
    .rotation-hotkey-group { min-width:0; margin:0; padding:10px; border:1px solid var(--border); border-radius:6px; }
    .rotation-hotkey-group legend { padding:0 5px; color:var(--accent); font-size:11px; font-weight:700; text-transform:uppercase; }
    .rotation-hotkey-field { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px 0; font-size:11px; }
    .rotation-hotkey-field input { width:92px; padding:4px 6px; border:1px solid var(--border-light);
      border-radius:4px; background:var(--bg); color:var(--text-bright); text-align:center; cursor:pointer; }
    .rotation-hotkey-field input:focus { border-color:var(--accent); outline:1px solid var(--accent); }
    .rotation-hotkey-import-status { margin:12px 0 0; color:var(--health); font-size:11px; }
    .rotation-hotkey-error { margin:12px 0 0; color:var(--condi); font-size:11px; }
    .rotation-hotkey-actions { display:flex; justify-content:flex-end; gap:6px; margin-top:14px; }
    @media (max-width:700px) { .rotation-hotkey-groups { grid-template-columns:1fr; } }
  `;
  document.head.append(style);
}

function populateDialog(controller: RotationHotkeyController, bindings = controller.bindings): void {
  if (!controller.dialog) return;
  const enabled = controller.dialog.querySelector<HTMLInputElement>('[data-hotkey-enabled]');
  if (enabled) enabled.checked = controller.enabled;
  for (const input of controller.dialog.querySelectorAll<HTMLInputElement>('[data-hotkey-input]')) {
    const action = input.dataset.hotkeyInput as RotationHotkeyAction;
    input.dataset.code = bindings[action];
    input.value = formatRotationHotkey(bindings[action]);
  }

  const error = controller.dialog.querySelector<HTMLElement>('.rotation-hotkey-error');
  if (error) {
    error.hidden = true;
    error.textContent = '';
  }

  const importStatus = controller.dialog.querySelector<HTMLElement>('.rotation-hotkey-import-status');
  if (importStatus) {
    importStatus.hidden = true;
    importStatus.textContent = '';
  }
}

function dialogBindings(dialog: HTMLDialogElement): RotationHotkeyBindings {
  const bindings = defaultRotationHotkeyBindings();
  for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-hotkey-input]')) {
    const action = input.dataset.hotkeyInput as RotationHotkeyAction;
    bindings[action] = input.dataset.code || '';
  }

  return bindings;
}

function ensureDialog(controller: RotationHotkeyController): void {
  if (controller.dialog) return;
  const document = controller.root.ownerDocument;
  const dialog = document.createElement('dialog');
  dialog.className = 'rotation-hotkey-dialog';
  dialog.setAttribute('aria-labelledby', 'rotation-hotkey-title');
  dialog.innerHTML = `<form class="rotation-hotkey-form" method="dialog">
    <h3 id="rotation-hotkey-title">Rotation hotkeys</h3>
    <p class="rotation-hotkey-intro">Hotkeys are enabled by default. Click the rotation panel to activate them. Bindings apply to every profession.</p>
    <label class="rotation-hotkey-enable">
      <input type="checkbox" data-hotkey-enabled />
      <span>Enable rotation hotkeys</span>
    </label>
    ${
      controller.keybindImport
        ? `<input type="file" accept="${escapeHtml(controller.keybindImport.accept)}" data-hotkey-import-file hidden />`
        : ''
    }
    <div class="rotation-hotkey-groups">${hotkeyFieldsHtml()}</div>
    <p class="rotation-hotkey-import-status" role="status" hidden></p>
    <p class="rotation-hotkey-error" role="alert" hidden></p>
    <div class="rotation-hotkey-actions">
      ${
        controller.keybindImport
          ? `<button type="button" class="btn btn-io" data-hotkey-import>${escapeHtml(controller.keybindImport.label)}</button>`
          : ''
      }
      <button type="button" class="btn btn-undo" data-hotkey-reset>Reset defaults</button>
      <button type="button" class="btn" data-hotkey-cancel>Cancel</button>
      <button type="button" class="btn btn-run" data-hotkey-save>Save</button>
    </div>
  </form>`;
  document.body.append(dialog);
  controller.dialog = dialog;

  for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-hotkey-input]')) {
    input.addEventListener('keydown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.metaKey) return;
      if (event.code === 'Escape') {
        input.blur();
        return;
      }

      if (
        [
          'ControlLeft',
          'ControlRight',
          'AltLeft',
          'AltRight',
          'MetaLeft',
          'MetaRight',
          'ShiftLeft',
          'ShiftRight',
          'Tab'
        ].includes(event.code)
      ) {
        return;
      }

      const modifiers = [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : ''].filter(
        Boolean
      );
      const code = ['Backspace', 'Delete'].includes(event.code) ? '' : [...modifiers, event.code].join('+');
      input.dataset.code = code;
      input.value = formatRotationHotkey(code);
    });
    input.addEventListener('pointerdown', (event) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      event.stopPropagation();
      const modifiers = [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : ''].filter(
        Boolean
      );
      const code = [...modifiers, `Mouse${event.button + 1}`].join('+');
      input.dataset.code = code;
      input.value = formatRotationHotkey(code);
    });
    input.addEventListener('auxclick', (event) => {
      if (event.button === 3 || event.button === 4) event.preventDefault();
    });
  }

  const importInput = dialog.querySelector<HTMLInputElement>('[data-hotkey-import-file]');
  dialog.querySelector('[data-hotkey-import]')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file || !controller.keybindImport) return;
    const error = dialog.querySelector<HTMLElement>('.rotation-hotkey-error');
    const previousStatus = dialog.querySelector<HTMLElement>('.rotation-hotkey-import-status');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }

    if (previousStatus) {
      previousStatus.hidden = true;
      previousStatus.textContent = '';
    }

    try {
      const result = await controller.keybindImport.parse(await file.text());
      if (!result.importedActions.length) {
        throw new Error('No supported combat skill bindings were found in this file.');
      }

      populateDialog(controller, { ...dialogBindings(dialog), ...result.bindings });
      const importStatus = dialog.querySelector<HTMLElement>('.rotation-hotkey-import-status');
      if (importStatus) {
        importStatus.hidden = false;
        importStatus.textContent = `Imported ${result.importedActions.length} binding${
          result.importedActions.length === 1 ? '' : 's'
        }${
          result.skippedActions.length
            ? `; skipped ${result.skippedActions.length} unsupported binding${
                result.skippedActions.length === 1 ? '' : 's'
              }`
            : ''
        }. Review them, then save.`;
      }
    } catch (reason) {
      if (error) {
        error.hidden = false;
        error.textContent = reason instanceof Error ? reason.message : 'Could not import this keybind file.';
      }
    } finally {
      importInput.value = '';
    }
  });

  dialog.querySelector('[data-hotkey-reset]')?.addEventListener('click', () => {
    populateDialog(controller, defaultRotationHotkeyBindings());
  });
  dialog.querySelector('[data-hotkey-cancel]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-hotkey-save]')?.addEventListener('click', () => {
    const bindings = dialogBindings(dialog);
    const enabled = Boolean(dialog.querySelector<HTMLInputElement>('[data-hotkey-enabled]')?.checked);
    const duplicates = duplicateRotationHotkeyCodes(bindings);
    const error = dialog.querySelector<HTMLElement>('.rotation-hotkey-error');
    if (duplicates.length) {
      if (error) {
        error.hidden = false;
        error.textContent = `Each action needs a unique key. Duplicates: ${duplicates
          .map(formatRotationHotkey)
          .join(', ')}.`;
      }

      return;
    }

    controller.bindings = bindings;
    controller.enabled = enabled;
    saveRotationHotkeyBindings(bindings);
    saveRotationHotkeysEnabled(enabled);
    setRotationHotkeysActive(controller, false);
    controller.refresh();
    dialog.close();
  });
  dialog.addEventListener('close', () => setRotationHotkeysActive(controller, false));
}

function setRotationHotkeysActive(controller: RotationHotkeyController, active: boolean): void {
  controller.active = controller.enabled && active;
  controller.scope.classList.toggle('rotation-hotkeys-active', controller.active);
  if (controller.button) {
    controller.button.textContent = rotationHotkeyStatusLabel(controller.enabled, controller.active);
    controller.button.title = !controller.enabled
      ? 'Configure rotation hotkeys (disabled)'
      : controller.active
        ? 'Configure rotation hotkeys (press Escape to release)'
        : 'Configure rotation hotkeys (click the rotation panel to activate)';
  }
}

function ensureControls(controller: RotationHotkeyController): void {
  if (controller.button?.isConnected) return;
  const heading =
    controller.root.previousElementSibling?.matches('h3') === true
      ? controller.root.previousElementSibling
      : controller.root.closest('.rotation-panel')?.querySelector('h3');
  if (!(heading instanceof HTMLElement)) return;
  heading.classList.add('rotation-builder-heading');
  const button = heading.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-io rotation-hotkey-button';
  button.setAttribute('aria-live', 'polite');
  button.title = 'Configure global rotation hotkeys';
  button.addEventListener('click', () => {
    ensureDialog(controller);
    populateDialog(controller);
    controller.dialog?.showModal();
  });
  const sharedControls = heading.querySelector('.rotation-builder-controls');
  const focusButton = sharedControls?.querySelector('.rotation-focus-toggle');
  if (sharedControls && focusButton) {
    sharedControls.insertBefore(button, focusButton);
  } else if (sharedControls) {
    sharedControls.prepend(button);
  } else {
    heading.append(button);
  }

  controller.button = button;
  setRotationHotkeysActive(controller, controller.active);
}

/** Mounts document-level keyboard and side-mouse handlers while React owns palette targets and badges. */
export function mountRotationHotkeys(
  root: HTMLElement | null,
  keybindImport?: RotationHotkeyImport,
  activate: RotationHotkeyController['activate'] = () => false,
  refresh: RotationHotkeyController['refresh'] = () => undefined
): void {
  if (!root) return;
  const document = root.ownerDocument;
  const scope = root.closest<HTMLElement>('.rotation-panel') || root;
  let controller = controllers.get(document);
  if (!controller) {
    controller = {
      root,
      scope,
      bindings: loadRotationHotkeyBindings(),
      enabled: loadRotationHotkeysEnabled(),
      active: false,
      button: null,
      dialog: null,
      keybindImport,
      activate,
      refresh
    };
    controllers.set(document, controller);
    document.addEventListener('pointerdown', (event) => {
      const current = controller as RotationHotkeyController;
      const target = event.target;
      setRotationHotkeysActive(current, target instanceof Node && current.root.contains(target));
      activateRotationMouseHotkey(current, event);
    });
    document.addEventListener('auxclick', (event) => {
      const current = controller as RotationHotkeyController;
      const target = event.target;
      if (
        target instanceof Node &&
        current.root.contains(target) &&
        activeRotationMouseHotkeyAction(current.bindings, event, current.active)
      ) {
        event.preventDefault();
      }
    });
    document.addEventListener('keydown', (event) => {
      const current = controller as RotationHotkeyController;
      if (event.code === 'Escape' && !current.dialog?.open) {
        setRotationHotkeysActive(current, false);
        return;
      }

      activateRotationHotkey(current, event);
    });
    document.defaultView?.addEventListener('blur', () =>
      setRotationHotkeysActive(controller as RotationHotkeyController, false)
    );
  } else {
    controller.root = root;
    controller.scope = scope;
    controller.keybindImport = keybindImport;
    controller.activate = activate;
    controller.refresh = refresh;
  }

  ensureStyles(document);
  ensureControls(controller);
  setRotationHotkeysActive(controller, controller.active);
}
