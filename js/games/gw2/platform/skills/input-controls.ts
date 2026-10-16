/** Logical player controls belong to the engine, independently of physical key bindings. */
export const INPUT_CONTROL_IDS = [
  'dodge',
  'weapon-swap',
  'weapon-1',
  'weapon-2',
  'weapon-3',
  'weapon-4',
  'weapon-5',
  'slot-6',
  'slot-7',
  'slot-8',
  'slot-9',
  'slot-10',
  'profession-1',
  'profession-2',
  'profession-3',
  'profession-4',
  'profession-5',
  'profession-6',
  'profession-7'
] as const;

export type InputControlId = (typeof INPUT_CONTROL_IDS)[number];
const actionIds = new Set<string>(INPUT_CONTROL_IDS);

export function inputControlForSkillSlot(slot: unknown): InputControlId | '' {
  const match = /^(Weapon_([1-5])|Profession_([1-7]))$/.exec(String(slot || ''));

  if (!match) return '';

  const action = match[2] ? `weapon-${match[2]}` : `profession-${match[3]}`;
  return actionIds.has(action) ? (action as InputControlId) : '';
}
