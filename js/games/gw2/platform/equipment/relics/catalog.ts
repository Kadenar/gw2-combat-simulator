/** Owns selectable relic names, groupings, and equipment-level timing lookups derived from the relic table. */
import { RELIC_DATA } from '#gw2/platform/equipment/relics/data.js';

/** Resolves the relic's fixed weapon-swap reduction so every base recharge loses the same 2.5 seconds. */
export function relicWeaponSwapRechargeReduction(relicName: string | undefined): number {
  const relic = RELIC_DATA[relicName as keyof typeof RELIC_DATA];
  return relic && 'weaponSwapRechargeReduction' in relic ? Number(relic.weaponSwapRechargeReduction) : 0;
}

export const RELIC_NAMES = [...Object.keys(RELIC_DATA)].sort((a, b) => a.localeCompare(b));

/** Only these relics currently support temporary equipment during authored precombat actions. */
export const PRECAST_RELIC_NAMES: readonly string[] = ['Brawler', 'Director', 'Mount Balrior'];

export function normalizePrecastRelics(value: unknown): string[] {
  return Array.isArray(value) ? PRECAST_RELIC_NAMES.filter((name) => value.includes(name)) : [];
}

export const RELIC_GROUPS = [
  {
    label: 'Power',
    items: [
      'Brawler',
      'Bloodstone',
      'Claw',
      'Deadeye',
      'Director',
      'Dragonhunter',
      'Eagle',
      'Fireworks',
      'Mist Stranger',
      'Mistburn',
      'Mount Balrior',
      'Shackles',
      'Thief'
    ]
  },
  {
    label: 'Condition',
    items: ['Akeem', 'Aristocracy', 'Blightbringer', 'Fractal', 'Last Tyrant', 'Mirage', 'Steamshrieker', 'Thorns']
  },
  {
    label: 'Hybrid',
    items: ['Nourys', 'Peitha', 'Visionary', 'Warrior']
  }
];
