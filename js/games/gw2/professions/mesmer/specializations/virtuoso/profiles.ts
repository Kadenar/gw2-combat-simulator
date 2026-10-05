import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { mesmerShatterProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';

export const VIRTUOSO_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.virtuoso.resources'
});

export const VIRTUOSO_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: VIRTUOSO_BALANCE_PROFILE_IDS.resources,
    name: 'Virtuoso Blades',
    profileKind: 'mechanic',
    maximumStacks: 5,
    effects: []
  },
  ...Object.entries(MESMER_VIRTUOSO_SHATTERS).map(([skillId, shatter]) =>
    mesmerShatterProfile(
      Number(skillId),
      {
        [ID.BLADETURN_REQUIEM]: 'Bladeturn Requiem',
        [ID.BLADESONG_DISSONANCE]: 'Bladesong Dissonance',
        [ID.BLADESONG_SORROW]: 'Bladesong Sorrow',
        [ID.BLADESONG_HARMONY]: 'Bladesong Harmony',
        [ID.BLADESONG_DISTORTION]: 'Bladesong Distortion'
      }[Number(skillId)] || `Virtuoso Shatter ${skillId}`,
      shatter
    )
  )
]);
