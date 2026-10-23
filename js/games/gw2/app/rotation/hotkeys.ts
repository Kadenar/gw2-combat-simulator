import { bindInputCapture } from '#gw2/app/shared/input-binding-capture.js';
import { inputBindingForKey, inputMouseButtonCode, inputKeyModifier } from '#gw2/input/bindings.js';
import { inputControlForBinding } from '#gw2/input/bindings.js';
import {
  INPUT_CONTROLS,
  type InputBindings,
  defaultInputBindings,
  normalizeInputBindings,
  duplicateInputBindings,
  formatInputBinding
} from '#gw2/input/bindings.js';
import { type InputControlId } from '#gw2/platform/skills/input-controls.js';
import { bindDialog, showDialog } from '#browser/page/dialog.js';
import { escapeHtml } from '#ui/shared/html.js';
import { ensureDocumentStyles, shouldIgnoreHotkey } from '#ui/shared/dom.js';

export const ROTATION_HOTKEY_STORAGE_KEY = 'gw2-rotation-hotkeys-v1';

export const ROTATION_HOTKEY_ENABLED_STORAGE_KEY = 'gw2-rotation-hotkeys-enabled-v1';

/** Accepted GW2 keybind export types; the XML parser itself loads only after a file is chosen. */
const KEYBIND_IMPORT_ACCEPT = '.xml,application/xml,text/xml';

type HotkeyStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface RotationHotkeyController {
  root: HTMLElement;
  scope: HTMLElement;
  bindings: InputBindings;
  enabled: boolean;
  active: boolean;
  button: HTMLButtonElement | null;
  dialog: HTMLDialogElement | null;
  pendingModifier: string | null;
}

const actionIds = new Set<string>(INPUT_CONTROLS.map((action) => action.id));
const controllers = new WeakMap<Document, RotationHotkeyController>();

function browserStorage(): HotkeyStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Keeps the current hotkey state inside its toolbar action instead of a detached status label. */
export function rotationHotkeyStatusLabel(enabled: boolean, active: boolean): string {
  return !enabled ? 'Hotkeys: Disabled' : active ? 'Hotkeys: On' : 'Hotkeys: Off';
}

export function loadRotationHotkeyBindings(storage: HotkeyStorage | null = browserStorage()): InputBindings {
  if (!storage) return defaultInputBindings();

  try {
    return normalizeInputBindings(JSON.parse(storage.getItem(ROTATION_HOTKEY_STORAGE_KEY) || 'null'));
  } catch {
    return defaultInputBindings();
  }
}

export function saveRotationHotkeyBindings(
  bindings: InputBindings,
  storage: HotkeyStorage | null = browserStorage()
): void {
  if (!storage) return;

  try {
    storage.setItem(ROTATION_HOTKEY_STORAGE_KEY, JSON.stringify(normalizeInputBindings(bindings)));
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

/** Shared logical controls intentionally select the first enabled palette face, in visible palette order. */
function currentHotkeyTarget(root: HTMLElement, action: InputControlId): HTMLElement | null {
  const candidates = [...root.querySelectorAll<HTMLElement>('.pal-skill[data-hotkey-action]')].filter(
    (candidate) => candidate.dataset.hotkeyAction === action
  );
  return candidates.find((candidate) => !candidate.classList.contains('pal-context-disabled')) || null;
}

function activateRotationHotkey(controller: RotationHotkeyController, event: KeyboardEvent): void {
  // Leaving Golem can hide the palette without moving the pointer; hidden controls must not cast.
  if (!controller.root.checkVisibility()) return;

  if (shouldIgnoreHotkey(event)) return;

  const action = activeRotationHotkeyAction(controller.bindings, event, controller.active);

  if (!action) return;

  // Consume bound keys before consulting stale tiles, including function keys with native browser actions.
  if (controller.root.dataset.palettePending === 'true') {
    event.preventDefault();
    return;
  }

  const target = currentHotkeyTarget(controller.root, action);
  const MouseEventConstructor = controller.root.ownerDocument.defaultView?.MouseEvent;

  if (!target || !MouseEventConstructor) return;

  event.preventDefault();

  if (event.repeat) return;

  target.dispatchEvent(
    new MouseEventConstructor('click', {
      bubbles: true,
      cancelable: true,
      shiftKey: event.shiftKey && !controller.bindings[action].includes('Shift+')
    })
  );
}

/** Activates standard browser Mouse 3/4/5 events while the pointer remains over the active rotation palette. */
function activateRotationMouseHotkey(controller: RotationHotkeyController, event: PointerEvent): void {
  if (!controller.root.checkVisibility()) return;

  const action = activeRotationMouseHotkeyAction(controller.bindings, event, controller.active);

  if (!action) return;

  if (controller.root.dataset.palettePending === 'true') {
    event.preventDefault();
    return;
  }

  const target = currentHotkeyTarget(controller.root, action);
  const MouseEventConstructor = controller.root.ownerDocument.defaultView?.MouseEvent;

  if (!target || !MouseEventConstructor) return;

  event.preventDefault();
  target.dispatchEvent(
    new MouseEventConstructor('click', {
      bubbles: true,
      cancelable: true,
      shiftKey: event.shiftKey && !controller.bindings[action].includes('Shift+')
    })
  );
}

function hotkeyFieldsHtml(): string {
  return ['Weapon', 'Utility', 'Profession']
    .map(
      (group) => `<fieldset class="rotation-hotkey-group">
        <legend>${group}</legend>
        ${INPUT_CONTROLS.filter((action) => action.group === group)
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

const ROTATION_HOTKEY_STYLES = `
    .pal-hotkey { position:absolute; z-index:4; top:-13px; right:1px; box-sizing:border-box;
      min-width:12px; max-width:calc(100% - 2px); padding:1px 3px; overflow:hidden;
      border:1px solid rgba(255,255,255,.65); border-radius:3px; background:rgba(12,14,20,.9);
      color:#fff; font-size:8px; font-weight:800; line-height:10px; text-align:center;
      text-overflow:ellipsis; white-space:nowrap;
      text-shadow:0 1px 2px #000; pointer-events:none; }
    /* Let active hotkey badges sit just above the tile without moving its cooldown or clipping the badge. */
    .pal-skill:has(> .pal-hotkey) { overflow:visible; }
    .rotation-panel:not(.rotation-hotkeys-active) .pal-hotkey { opacity:.45; }
    .rotation-hotkey-dialog { --dialog-width:720px; }
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
      border-radius:4px; background:var(--bg-panel-alt); color:var(--text-bright); text-align:center; cursor:pointer; }
    .rotation-hotkey-field input:focus { border-color:var(--accent); outline:1px solid var(--accent); }
    .rotation-hotkey-import-status { margin:12px 0 0; color:var(--health); font-size:11px; }
    .rotation-hotkey-error { margin:12px 0 0; color:var(--condi); font-size:11px; }
    @media (max-width:700px) { .rotation-hotkey-groups { grid-template-columns:1fr; } }
  `;

function refreshHotkeyBadges(controller: RotationHotkeyController): void {
  for (const skill of controller.root.querySelectorAll<HTMLElement>('.pal-skill[data-hotkey-action]')) {
    const action = skill.dataset.hotkeyAction as InputControlId;
    const code = controller.bindings[action];
    skill.querySelector('.pal-hotkey')?.remove();
    skill.removeAttribute('aria-keyshortcuts');

    if (!controller.enabled || !code) continue;

    const badge = skill.ownerDocument.createElement('span');
    badge.className = 'pal-hotkey';
    badge.textContent = formatRotationHotkeyBadge(code);
    badge.setAttribute('aria-hidden', 'true');
    skill.append(badge);
    skill.setAttribute('aria-keyshortcuts', formatInputBinding(code));
  }
}

function populateDialog(controller: RotationHotkeyController, bindings = controller.bindings): void {
  if (!controller.dialog) return;

  const enabled = controller.dialog.querySelector<HTMLInputElement>('[data-hotkey-enabled]');

  if (enabled) enabled.checked = controller.enabled;

  for (const input of controller.dialog.querySelectorAll<HTMLInputElement>('[data-hotkey-input]')) {
    const action = input.dataset.hotkeyInput as InputControlId;
    input.dataset.code = bindings[action];
    input.value = formatInputBinding(bindings[action]);
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

function dialogBindings(dialog: HTMLDialogElement): InputBindings {
  const bindings = defaultInputBindings();
  for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-hotkey-input]')) {
    const action = input.dataset.hotkeyInput as InputControlId;
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
  dialog.innerHTML = `<form class="rotation-hotkey-form app-dialog-body" method="dialog">
    <h3 id="rotation-hotkey-title">Rotation hotkeys</h3>
    <p class="rotation-hotkey-intro">Hotkeys are enabled by default. Click the rotation panel to activate them. Bindings apply to every profession. Release a lone modifier or use Mouse 3/4/5 to bind it. Tab moves focus; press Enter first to bind Tab, Delete, Backspace, or Enter. Delete or Backspace clears; Escape cancels armed capture, otherwise it closes the dialog.</p>
    <label class="rotation-hotkey-enable">
      <input type="checkbox" data-hotkey-enabled />
      <span>Enable rotation hotkeys</span>
    </label>
    <input type="file" accept="${KEYBIND_IMPORT_ACCEPT}" data-hotkey-import-file hidden />
    <div class="rotation-hotkey-groups">${hotkeyFieldsHtml()}</div>
    <p class="rotation-hotkey-import-status" role="status" hidden></p>
    <p class="rotation-hotkey-error" role="alert" hidden></p>
    <div class="rotation-hotkey-actions app-dialog-actions">
      <button type="button" class="btn btn-io" data-hotkey-import>Import GW2 XML</button>
      <button type="button" class="btn btn-undo" data-hotkey-reset>Reset defaults</button>
      <button type="button" class="btn" data-dialog-close>Cancel</button>
      <button type="button" class="btn btn-run" data-hotkey-save>Save</button>
    </div>
  </form>`;
  bindDialog(dialog);
  document.body.append(dialog);
  controller.dialog = dialog;

  for (const input of dialog.querySelectorAll<HTMLInputElement>('[data-hotkey-input]')) {
    bindInputCapture(input, (code) => {
      input.dataset.code = code;
      input.value = formatInputBinding(code);
    });
  }

  const importInput = dialog.querySelector<HTMLInputElement>('[data-hotkey-import-file]');
  dialog.querySelector('[data-hotkey-import]')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];

    if (!file) return;

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
      const { parseGw2HotkeyBindingsXml } = await import('#gw2/integrations/keybinds/parser.js');
      const result = parseGw2HotkeyBindingsXml(await file.text());

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
    populateDialog(controller, defaultInputBindings());
  });
  dialog.querySelector('[data-hotkey-save]')?.addEventListener('click', () => {
    const bindings = dialogBindings(dialog);
    const enabled = Boolean(dialog.querySelector<HTMLInputElement>('[data-hotkey-enabled]')?.checked);
    const duplicates = duplicateInputBindings(bindings);
    const error = dialog.querySelector<HTMLElement>('.rotation-hotkey-error');

    if (duplicates.length) {
      if (error) {
        error.hidden = false;
        error.textContent = `Each action needs a unique key. Duplicates: ${duplicates
          .map(formatInputBinding)
          .join(', ')}.`;
      }

      return;
    }

    controller.bindings = bindings;
    controller.enabled = enabled;
    saveRotationHotkeyBindings(bindings);
    saveRotationHotkeysEnabled(enabled);
    setRotationHotkeysActive(controller, false);
    refreshHotkeyBadges(controller);
    dialog.close();
  });
  dialog.addEventListener('close', () => setRotationHotkeysActive(controller, false));
}

function setRotationHotkeysActive(controller: RotationHotkeyController, active: boolean): void {
  controller.active = controller.enabled && active;

  if (!controller.active) controller.pendingModifier = null;

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

    if (controller.dialog) showDialog(controller.dialog);
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

  // This toolbar configures editor hotkeys; the separate activity profile is opened from its result panel.
  controller.button = button;
  setRotationHotkeysActive(controller, controller.active);
}

/** Mounts document-level keyboard and side-mouse handlers and refreshes palette badges. */
export function mountRotationHotkeys(root: HTMLElement | null): void {
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
      pendingModifier: null
    };
    controllers.set(document, controller);
    document.addEventListener('pointerdown', (event) => {
      const current = controller as RotationHotkeyController;
      current.pendingModifier = null;
      const target = event.target;
      setRotationHotkeysActive(current, target instanceof Node && current.root.contains(target));
      activateRotationMouseHotkey(current, event);
    });
    document.addEventListener('pointerup', (event) => {
      const current = controller as RotationHotkeyController;

      // Browsers commit Mouse 4/5 history navigation on release, so consume the matching active hotkey there too.
      if (activeRotationMouseHotkeyAction(current.bindings, event, current.active)) event.preventDefault();
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

      // A modifier bound on its own fires on release, so starting a chord does not also insert a dodge.
      if (!event.repeat) {
        current.pendingModifier =
          inputKeyModifier(event.code) &&
          current.active &&
          !shouldIgnoreHotkey(event) &&
          [event.ctrlKey, event.altKey, event.shiftKey].filter(Boolean).length === 1
            ? event.code
            : null;
      }

      if (!inputKeyModifier(event.code)) activateRotationHotkey(current, event);
    });
    document.addEventListener('keyup', (event) => {
      const current = controller as RotationHotkeyController;

      if (
        current.pendingModifier === event.code &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.metaKey
      ) {
        current.pendingModifier = null;
        activateRotationHotkey(current, event);
      }
    });
    document.defaultView?.addEventListener('blur', () =>
      setRotationHotkeysActive(controller as RotationHotkeyController, false)
    );
  } else {
    controller.root = root;
    controller.scope = scope;
  }

  ensureDocumentStyles(document, 'rotation-hotkey-styles', ROTATION_HOTKEY_STYLES);
  ensureControls(controller);
  setRotationHotkeysActive(controller, controller.active);
  refreshHotkeyBadges(controller);
}

/** Assigns the shared weapon-swap pseudo-skill to its configurable hotkey in every profession palette. */
export function rotationHotkeyActionForSkillName(name: unknown): InputControlId | '' {
  return String(name || '') === 'Swap Weapons' ? 'weapon-swap' : '';
}

export function rotationUtilityHotkeyAction(index: number): InputControlId | '' {
  const action = `slot-${index + 6}`;
  return index >= 0 && index < 5 && actionIds.has(action) ? (action as InputControlId) : '';
}

export function rotationLoadoutHotkeyActions(
  bars: readonly { readonly skillIds: readonly unknown[] }[],
  skillChildren: (skillId: number) => readonly unknown[] = () => []
): ReadonlyMap<number, InputControlId> {
  const hotkeys = new Map<number, InputControlId>();
  const addSkill = (rawSkillId: unknown, action: InputControlId, visited: Set<number>): void => {
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

export function activeRotationHotkeyAction(
  bindings: InputBindings,
  event: Pick<KeyboardEvent, 'code' | 'isComposing' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  active: boolean
): InputControlId | null {
  if (!active || event.isComposing || event.metaKey) return null;

  const code = inputBindingForKey(event.code, event);

  if (!code) return null;

  const exact = inputControlForBinding(bindings, code);

  if (exact || !event.shiftKey || event.code.startsWith('Shift')) return exact;

  // An unbound Shift modifier retains the rotation builder's concurrent-cast shortcut.
  return inputControlForBinding(
    bindings,
    inputBindingForKey(event.code, { ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: false }) ?? ''
  );
}

export function activeRotationMouseHotkeyAction(
  bindings: InputBindings,
  event: Pick<MouseEvent, 'button' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  active: boolean
): InputControlId | null {
  const key = inputMouseButtonCode(event.button);

  if (!active || event.metaKey || !key) return null;

  const code = inputBindingForKey(key, event);

  if (!code) return null;

  const exact = inputControlForBinding(bindings, code);

  if (exact || !event.shiftKey) return exact;

  return inputControlForBinding(
    bindings,
    inputBindingForKey(key, { ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: false }) ?? ''
  );
}

const BADGE_CODES: Readonly<Record<string, string>> = Object.freeze({
  Backspace: 'Bksp',
  CapsLock: 'Caps',
  Delete: 'Del',
  Enter: 'Ent',
  Escape: 'Esc',
  Insert: 'Ins',
  Mouse3: 'M3',
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

/** Keeps palette badges compact so long bindings identify the key without covering most of the skill icon. */
export function formatRotationHotkeyBadge(code: string): string {
  if (!code) return '';

  const parts = code.split('+');
  const keyCode = parts.pop() || '';
  const modifiers = parts.map((part) => ({ Ctrl: 'C', Alt: 'A', Shift: 'S' })[part] || part).join('');
  const keyLabel = /^Numpad\d$/.test(keyCode)
    ? `N${keyCode.slice(-1)}`
    : BADGE_CODES[keyCode] || formatInputBinding(keyCode);
  return modifiers ? `${modifiers}+${keyLabel}` : keyLabel;
}
