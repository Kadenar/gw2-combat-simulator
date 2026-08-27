/** Converts GW2's exported keybind XML into rotation-builder hotkey bindings. */
import type { RotationHotkeyAction, RotationHotkeyBindings } from './hotkeys.js';

export interface Gw2HotkeyImportResult {
  bindings: Partial<RotationHotkeyBindings>;
  importedActions: RotationHotkeyAction[];
  skippedActions: RotationHotkeyAction[];
}

const ACTION_BY_GW2_ID: Readonly<Record<string, RotationHotkeyAction>> = Object.freeze({
  '17': 'weapon-swap',
  '18': 'weapon-1',
  '19': 'weapon-2',
  '20': 'weapon-3',
  '21': 'weapon-4',
  '22': 'weapon-5',
  '23': 'slot-6',
  '24': 'slot-7',
  '25': 'slot-8',
  '26': 'slot-9',
  '27': 'slot-10',
  '28': 'profession-1',
  '29': 'profession-2',
  '30': 'profession-3',
  '31': 'profession-4',
  '79': 'profession-5',
  '201': 'profession-6',
  '202': 'profession-7'
});

const SPECIAL_GW2_KEY_CODES: Readonly<Record<number, string>> = Object.freeze({
  0: 'AltLeft',
  1: 'ControlLeft',
  2: 'ShiftLeft',
  3: 'Quote',
  4: 'Backslash',
  5: 'CapsLock',
  6: 'Semicolon',
  7: 'Minus',
  8: 'Equal',
  9: 'Escape',
  10: 'BracketLeft',
  11: 'NumLock',
  12: 'Period',
  13: 'BracketRight',
  14: 'Semicolon',
  15: 'Slash',
  16: 'PrintScreen',
  17: 'Backquote',
  18: 'Backspace',
  19: 'Delete',
  20: 'Enter',
  21: 'Space',
  22: 'Tab',
  23: 'End',
  24: 'Home',
  25: 'Insert',
  26: 'PageDown',
  27: 'PageUp',
  28: 'ArrowDown',
  29: 'ArrowLeft',
  30: 'ArrowRight',
  31: 'ArrowUp',
  91: 'NumpadAdd',
  92: 'NumpadDecimal',
  93: 'NumpadDivide',
  94: 'NumpadMultiply',
  105: 'NumpadEnter',
  106: 'NumpadSubtract',
  109: 'AltRight',
  110: 'ControlRight',
  111: 'Backslash',
  135: 'ShiftRight',
  137: 'NumpadEqual',
  138: 'NumpadClear'
});

function decodeXmlAttribute(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|quot|apos|amp|lt|gt);/gi, (entity, decimal, hex) => {
    if (decimal || hex) {
      const codePoint = Number.parseInt(decimal || hex, hex ? 16 : 10);
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    }

    return (
      {
        '&quot;': '"',
        '&apos;': "'",
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>'
      }[entity.toLowerCase()] || entity
    );
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(source))) {
    attributes[match[1]] = decodeXmlAttribute(match[2] ?? match[3] ?? '');
  }

  return attributes;
}

function hotkeyActionFromName(name: string): RotationHotkeyAction | null {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();

  if (normalized === 'swap weapons' || normalized === 'weapon swap') return 'weapon-swap';
  const numbered = /^(weapon|utility|profession) skill ([1-7])$/.exec(normalized);

  if (numbered) {
    const index = Number(numbered[2]);

    if (numbered[1] === 'weapon' && index <= 5) return `weapon-${index}` as RotationHotkeyAction;

    if (numbered[1] === 'utility' && index <= 3) return `slot-${index + 6}` as RotationHotkeyAction;

    if (numbered[1] === 'profession') return `profession-${index}` as RotationHotkeyAction;
  }

  if (normalized === 'healing skill' || normalized === 'heal skill') return 'slot-6';

  if (normalized === 'elite skill') return 'slot-10';
  return null;
}

function hotkeyActionForAttributes(attributes: Record<string, string>): RotationHotkeyAction | null {
  return ACTION_BY_GW2_ID[attributes.id] || hotkeyActionFromName(attributes.name || '');
}

export function gw2KeyboardCode(button: string | undefined): string | null {
  if (!button || !/^\d+$/.test(button)) return null;
  const keyCode = Number(button);

  if (keyCode >= 32 && keyCode <= 43) return `F${keyCode - 31}`;

  if (keyCode >= 48 && keyCode <= 57) return `Digit${keyCode - 48}`;

  if (keyCode >= 65 && keyCode <= 90) return `Key${String.fromCharCode(keyCode)}`;

  if (keyCode >= 95 && keyCode <= 104) return `Numpad${keyCode - 95}`;

  if (keyCode >= 112 && keyCode <= 123) return `F${keyCode - 99}`;
  return SPECIAL_GW2_KEY_CODES[keyCode] || null;
}

export function gw2MouseCode(button: string | undefined): string | null {
  if (!button || !/^\d+$/.test(button)) return null;
  const mouseButton = Number(button);
  return mouseButton === 3 || mouseButton === 4 ? `Mouse${mouseButton + 1}` : null;
}

function hotkeyWithModifiers(code: string, rawModifier: string | undefined): string | null {
  const modifier = rawModifier === undefined || rawModifier === '' ? 0 : Number(rawModifier);

  if (!Number.isInteger(modifier) || modifier < 0 || modifier > 7) return null;
  const parts: string[] = [];

  if (modifier & 2) parts.push('Ctrl');

  if (modifier & 4) parts.push('Alt');

  if (modifier & 1) parts.push('Shift');
  parts.push(code);
  return parts.join('+');
}

function bindingForAttributes(attributes: Record<string, string>): string | null {
  const candidates = [
    { device: attributes.device, button: attributes.button, modifier: attributes.mod },
    { device: attributes.device2, button: attributes.button2, modifier: attributes.mod2 }
  ];
  for (const candidate of candidates) {
    const code =
      candidate.device === 'Keyboard'
        ? gw2KeyboardCode(candidate.button)
        : candidate.device === 'Mouse'
          ? gw2MouseCode(candidate.button)
          : null;
    const hotkey = code ? hotkeyWithModifiers(code, candidate.modifier) : null;

    if (hotkey) return hotkey;
  }

  const hasAssignedDevice = candidates.some(({ device }) => Boolean(device) && device !== 'None');
  return hasAssignedDevice ? null : '';
}

/**
 * Imports only simulator combat actions, preferring GW2's primary supported binding and falling back to its secondary one.
 */
export function parseGw2HotkeyBindingsXml(xml: string): Gw2HotkeyImportResult {
  if (!/<InputBindings(?:\s|>)/i.test(xml) || !/<\/InputBindings\s*>/i.test(xml)) {
    throw new Error('This is not a Guild Wars 2 InputBindings XML file.');
  }

  const bindings: Partial<RotationHotkeyBindings> = {};
  const imported = new Set<RotationHotkeyAction>();
  const skipped = new Set<RotationHotkeyAction>();
  const actionPattern = /<action\b([^>]*)\/?\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = actionPattern.exec(xml))) {
    const attributes = parseAttributes(match[1]);
    const action = hotkeyActionForAttributes(attributes);

    if (!action) continue;
    const binding = bindingForAttributes(attributes);

    if (binding === null) {
      if (!imported.has(action)) skipped.add(action);
      continue;
    }

    bindings[action] = binding;
    imported.add(action);
    skipped.delete(action);
  }

  return {
    bindings,
    importedActions: [...imported],
    skippedActions: [...skipped]
  };
}
