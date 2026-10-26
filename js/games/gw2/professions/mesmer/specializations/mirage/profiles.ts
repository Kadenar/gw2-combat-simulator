import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { MIRAGE_MIRROR_EFFECTS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';

export const MIRAGE_BALANCE_PROFILE_IDS = Object.freeze({ mechanics: 'mesmer.mirage.mechanics' });

// Ground mirrors are created by multiple skills and traits, so their shared lifetime and reward retain one owner.
export const MIRAGE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: MIRAGE_BALANCE_PROFILE_IDS.mechanics,
    name: 'Mirage Mirrors',
    profileKind: 'mechanic',
    effects: [
      ...MIRAGE_MIRROR_EFFECTS,
      { name: 'mirage-mirror', type: 'buff', kind: 'mirage-mirror', duration: 8, stacks: 1 }
    ]
  }
]);
