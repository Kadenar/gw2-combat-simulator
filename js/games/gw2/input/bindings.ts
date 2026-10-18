import type { InputControlId } from '#gw2/platform/skills/input-controls.js';

/** Shared logical controls and physical bindings for editor shortcuts and personal input analysis. */
export const INPUT_CONTROLS = Object.freeze([
  { id: 'dodge', label: 'Dodge', group: 'Weapon', code: 'KeyV' },
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

export type InputBindings = Record<InputControlId, string>;

export interface InputBindingImportResult {
  readonly bindings: Partial<InputBindings>;
  readonly importedActions: readonly InputControlId[];
  readonly skippedActions: readonly InputControlId[];
  /** All supported alternatives; personal profiles require a choice when more than one exists. */
  readonly bindingOptions: Partial<Record<InputControlId, readonly string[]>>;
}

export function defaultInputBindings(): InputBindings {
  return Object.fromEntries(INPUT_CONTROLS.map(({ id, code }) => [id, code])) as InputBindings;
}

export function normalizeInputBindings(value: unknown): InputBindings {
  const defaults = defaultInputBindings();

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const input = value as Record<string, unknown>;
  for (const action of INPUT_CONTROLS) {
    const candidate = input[action.id];

    if (
      Object.prototype.hasOwnProperty.call(input, action.id) &&
      typeof candidate === 'string' &&
      (candidate === '' || parseInputBinding(candidate))
    ) {
      defaults[action.id] = candidate;
    }
  }

  return defaults;
}

export function inputControlForBinding(bindings: InputBindings, code: string): InputControlId | null {
  return INPUT_CONTROLS.find((action) => bindings[action.id] && bindings[action.id] === code)?.id || null;
}

export function duplicateInputBindings(bindings: InputBindings): string[] {
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
  Mouse3: 'Mouse 3',
  Mouse4: 'Mouse 4',
  Mouse5: 'Mouse 5',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Space: 'Space'
});

export function formatInputBinding(code: string): string {
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

/** Accept known physical codes only; unsupported imports remain unbound rather than becoming defaults. */
function physicalInput(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal|Clear)|Mouse[1-5]|Arrow(?:Up|Down|Left|Right)|(?:Control|Alt|Shift|Meta)(?:Left|Right)|Backquote|Backslash|BracketLeft|BracketRight|Comma|Equal|Minus|Period|Quote|Semicolon|Slash|Space|Tab|Enter|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|NumLock|ScrollLock|PrintScreen|Pause|IntlBackslash|IntlRo|IntlYen)$/.test(
    code
  );
}

const INPUT_MODIFIERS = ['Ctrl', 'Alt', 'Shift'] as const;

export type InputModifier = (typeof INPUT_MODIFIERS)[number];

export const INPUT_MODIFIER_CODES = { Ctrl: 'ControlLeft', Alt: 'AltLeft', Shift: 'ShiftLeft' } as const;

/** One canonical ordering validates both persisted bindings and captured/imported chords. */
export function parseInputBinding(binding: string): { key: string; modifiers: InputModifier[] } | null {
  if (!binding) return null;

  const parts = binding.split('+');
  const key = parts.pop()!;

  if (!physicalInput(key)) return null;

  let previous = -1;
  for (const part of parts) {
    const index = INPUT_MODIFIERS.indexOf(part as InputModifier);

    if (index <= previous) return null;

    previous = index;
  }

  return { key, modifiers: parts as InputModifier[] };
}

/** Identify modifier keys without depending on DOM event types. */
export function inputKeyModifier(code: string): InputModifier | null {
  return /^(Control|Alt|Shift)(Left|Right)$/.test(code)
    ? code.startsWith('Control')
      ? 'Ctrl'
      : code.startsWith('Alt')
        ? 'Alt'
        : 'Shift'
    : null;
}

/** DOM middle-button numbering differs from the physical Mouse3 name. */
export function inputMouseButtonCode(button: number): string | null {
  return ({ 1: 'Mouse3', 3: 'Mouse4', 4: 'Mouse5' } as Record<number, string>)[button] ?? null;
}

/** A modifier used as the key is not also held as its own chord modifier. */
export function inputBindingForKey(
  key: string,
  held: { readonly ctrlKey?: boolean; readonly altKey?: boolean; readonly shiftKey?: boolean }
): string | null {
  const own = inputKeyModifier(key);
  const flags = { Ctrl: held.ctrlKey, Alt: held.altKey, Shift: held.shiftKey };
  const binding = [...INPUT_MODIFIERS.filter((modifier) => flags[modifier] && modifier !== own), key].join('+');
  return parseInputBinding(binding) ? binding : null;
}
