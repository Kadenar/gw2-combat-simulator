/** Physical key geometry shared by distance estimates and the keyboard drawing. */
export interface InputKeyGeometry {
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly label?: string;
}
const EDGE_KEYS: readonly InputKeyGeometry[] = [
  { code: 'Escape', x: 0, y: -1.5, width: 1, label: 'Esc' },
  { code: 'Backspace', x: 13, y: 0, width: 2, label: 'Bksp' },
  { code: 'Tab', x: 0, y: 1, width: 1.5, label: 'Tab' },
  { code: 'CapsLock', x: 0, y: 2, width: 1.75, label: 'Caps' },
  { code: 'Enter', x: 12.75, y: 2, width: 2.25, label: 'Enter' },
  { code: 'ShiftLeft', x: 0, y: 3, width: 2.25, label: 'Shift' },
  { code: 'ShiftRight', x: 12.25, y: 3, width: 2.75, label: 'Shift' },
  { code: 'ControlLeft', x: 0, y: 4, width: 1.5, label: 'Ctrl' },
  { code: 'AltLeft', x: 2.5, y: 4, width: 1.25, label: 'Alt' },
  { code: 'Space', x: 3.75, y: 4, width: 6.25, label: 'Space' },
  { code: 'AltRight', x: 10, y: 4, width: 1.25, label: 'Alt' },
  { code: 'ControlRight', x: 13.5, y: 4, width: 1.5, label: 'Ctrl' }
];
const keys: InputKeyGeometry[] = [];
for (const [row, offset, codes] of [
  [0, 0, ['Backquote', ...'1234567890'.split('').map((key) => `Digit${key}`), 'Minus', 'Equal']],
  [1, 1.5, [...'QWERTYUIOP'.split('').map((key) => `Key${key}`), 'BracketLeft', 'BracketRight', 'Backslash']],
  [2, 1.75, [...'ASDFGHJKL'.split('').map((key) => `Key${key}`), 'Semicolon', 'Quote']],
  [3, 2.25, [...'ZXCVBNM'.split('').map((key) => `Key${key}`), 'Comma', 'Period', 'Slash']]
] as const)
  codes.forEach((code, column) =>
    keys.push({ code, x: offset + column, y: row, width: code === 'Backslash' ? 1.5 : 1 })
  );
for (let index = 1; index <= 12; index++)
  keys.push({ code: `F${index}`, x: index + Math.floor((index - 1) / 4) * 0.5, y: -1.5, width: 1 });
export const INPUT_KEY_LAYOUT: readonly InputKeyGeometry[] = [...keys, ...EDGE_KEYS];
// Distances use key centres, including wide keys; mouse and unmapped keys have no fabricated position.
export const INPUT_KEY_POSITIONS: ReadonlyMap<string, readonly [number, number]> = new Map(
  INPUT_KEY_LAYOUT.map(({ code, x, y, width }) => [code, [x + (width - 1) / 2, y] as const])
);
