/** Owns selectable sigil names and groupings derived from the sigil table. */
import { SIGIL_DATA } from '#gw2/platform/equipment/sigils/data.js';

export const SIGIL_NAMES: readonly string[] = Object.keys(SIGIL_DATA).sort((left, right) => left.localeCompare(right));

const CONDITION_SIGILS = new Set([
  'Agony',
  'Blight',
  'Bursting',
  'Corruption',
  'Demons',
  'Doom',
  'Earth',
  'Geomancy',
  'Ice',
  'Malice',
  'Smoldering',
  'Torment',
  'Venom'
]);

export const SIGIL_GROUPS = [
  {
    label: 'Power',
    items: SIGIL_NAMES.filter((name) => !CONDITION_SIGILS.has(name))
  },
  {
    label: 'Condition',
    items: SIGIL_NAMES.filter((name) => CONDITION_SIGILS.has(name))
  }
];
