import { formatInputBinding } from '#gw2/input/bindings.js';
import { inputKeyReach } from '#gw2/input/analysis.js';
import { INPUT_KEY_LAYOUT } from '#gw2/input/keyboard-layout.js';
import type { InputKeyUsage } from '#gw2/app/input-profile/summary.js';
import { escapeHtml as html } from '#ui/shared/html.js';

interface DrawnKey {
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height?: number;
  readonly label?: string;
  /** Corner radii in pixels (top-left, top-right, bottom-right, bottom-left); defaults to a keycap's 5px. */
  readonly radii?: readonly [number, number, number, number];
}

const UNIT = 40;
const GAP = 4;
const PAD = 6;
// Separates the function row from the number row, as on a physical keyboard.
const ROW_GAP = 6;

const KEYBOARD: readonly DrawnKey[] = INPUT_KEY_LAYOUT;
// Mouse buttons cost no reach and have no keyboard distance; the mouse is drawn only when a binding uses it.
// One rounded silhouette spans the keyboard's number-to-bottom rows; buttons sit inside it without overlapping one
// another, so emphasis on one button never shows another's outline through it.
const MOUSE_LEFT = 15.5;
// Give the silhouette and its buttons enough horizontal room to read beside the keyboard.
const MOUSE_WIDTH = 110;
const MOUSE_HEIGHT = 5 * UNIT - GAP;
const mousePart = (
  code: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  radii?: readonly [number, number, number, number]
): DrawnKey => ({
  code,
  label,
  x: MOUSE_LEFT + x / UNIT,
  y: y / UNIT,
  width: (width + GAP) / UNIT,
  height: (height + GAP) / UNIT,
  radii
});
const MOUSE_BODY = mousePart('', '', 0, 0, MOUSE_WIDTH, MOUSE_HEIGHT, [48, 48, 48, 48]);
const MOUSE: readonly DrawnKey[] = [
  mousePart('Mouse1', 'M1', 4, 4, 43, 74, [39, 3, 3, 3]),
  mousePart('Mouse3', '', 49, 16, 12, 26, [5, 5, 5, 5]),
  mousePart('Mouse2', 'M2', 63, 4, 43, 74, [3, 39, 3, 3]),
  mousePart('Mouse5', 'M5', 5, 94, 28, 28),
  mousePart('Mouse4', 'M4', 5, 126, 28, 28)
];
const MOUSE_CODES = new Set(MOUSE.map((key) => key.code));
const DRAWN_CODES = new Set([...KEYBOARD, ...MOUSE].map((key) => key.code));

const left = (key: DrawnKey): number => PAD + key.x * UNIT;
const top = (key: DrawnKey): number => PAD + (key.y + 1.5) * UNIT + (key.y >= 0 ? ROW_GAP : 0);

/** A keycap outline; mouse buttons use per-corner radii to read as one rounded mouse. */
function capShape(key: DrawnKey): string {
  const x = left(key);
  const y = top(key);
  const w = key.width * UNIT - GAP;
  const h = (key.height ?? 1) * UNIT - GAP;
  if (!key.radii) return `<rect class="input-kb-cap" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"></rect>`;
  const [tl, tr, br, bl] = key.radii;
  return `<path class="input-kb-cap" d="M${x + tl},${y}H${x + w - tr}A${tr},${tr} 0 0 1 ${x + w},${y + tr}V${y + h - br}A${br},${br} 0 0 1 ${x + w - br},${y + h}H${x + bl}A${bl},${bl} 0 0 1 ${x},${y + h - bl}V${y + tl}A${tl},${tl} 0 0 1 ${x + tl},${y}Z"></path>`;
}

/** Used keys not on the drawing (numpad, navigation keys) are listed beside it instead of being dropped. */
export function offKeyboardUsage(usage: ReadonlyMap<string, InputKeyUsage>): InputKeyUsage[] {
  return [...usage.values()].filter((key) => !DRAWN_CODES.has(key.code));
}

/**
 * Draw the keyboard shaded by the model's reach tiers, with press counts on used keys. Keys carry data-key-code so the
 * results panel can link them to key rows and the chart.
 */
export function inputKeyboardSvg(usage: ReadonlyMap<string, InputKeyUsage>): string {
  const mouse = [...usage.keys()].some((code) => MOUSE_CODES.has(code));
  const width = PAD * 2 + (mouse ? MOUSE_LEFT * UNIT + MOUSE_WIDTH : 15 * UNIT - GAP);
  const height = PAD * 2 + 6.5 * UNIT + ROW_GAP - GAP;
  const keys = [...KEYBOARD, ...(mouse ? MOUSE : [])]
    .map((key) => {
      const used = usage.get(key.code);
      const x = left(key);
      const y = top(key);
      const w = key.width * UNIT - GAP;
      const h = (key.height ?? 1) * UNIT - GAP;
      const tier = inputKeyReach(key.code) === 'near' ? 0 : inputKeyReach(key.code) === 'stretch' ? 1 : 2;
      const classes = ['input-kb-key', `is-reach-${tier}`, used ? 'is-used' : '', used?.modifier ? 'is-modifier' : '']
        .filter(Boolean)
        .join(' ');
      const label = html(key.label ?? formatInputBinding(key.code));
      const small = h < UNIT - GAP || w < UNIT - GAP;
      const labelY = y + (used && !small ? 16 : h / 2 + 4);
      return `<g class="${classes}" data-key-code="${html(key.code)}">
        ${capShape(key)}
        ${label ? `<text class="input-kb-label${small ? ' is-small' : ''}" x="${x + w / 2}" y="${labelY}">${label}</text>` : ''}
        ${used && !small ? `<text class="input-kb-count" x="${x + w / 2}" y="${y + 30}">&times;${used.count}</text>` : ''}
      </g>`;
    })
    .join('');
  const body = mouse ? `<g class="input-kb-mouse">${capShape(MOUSE_BODY)}</g>` : '';
  return `<svg class="input-kb-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Keyboard map of the keys this rotation uses, shaded by reach from the WASD keys">${body}${keys}</svg>`;
}
