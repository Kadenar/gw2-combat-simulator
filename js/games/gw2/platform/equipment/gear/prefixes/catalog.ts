/** Owns selectable prefix names and groupings derived from the prefix table. */
import { GEAR_STATS } from '#gw2/platform/equipment/gear/prefixes/data.js';

export const PREFIXES = [...Object.keys(GEAR_STATS)].sort((a, b) => a.localeCompare(b));

const GEAR_STATS_LOOKUP = GEAR_STATS as Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>
>;

export const PREFIX_GROUPS = [
  {
    label: 'Power',
    items: PREFIXES.filter(
      (prefix) =>
        !Object.values(GEAR_STATS_LOOKUP[prefix] || {}).some((stats) => Object.hasOwn(stats, 'Condition Damage'))
    )
  },
  {
    label: 'Condition',
    items: PREFIXES.filter((prefix) =>
      Object.values(GEAR_STATS_LOOKUP[prefix] || {}).some((stats) => Object.hasOwn(stats, 'Condition Damage'))
    )
  }
];
