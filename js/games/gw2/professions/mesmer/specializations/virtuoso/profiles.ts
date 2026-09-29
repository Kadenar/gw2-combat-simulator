import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { mesmerShatterProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_VIRTUOSO_SHATTERS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';

export const VIRTUOSO_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.virtuoso.resources',
  bladeturnRequiem: 'mesmer.virtuoso.bladeturn-requiem',
  bladesongDissonance: 'mesmer.virtuoso.bladesong-dissonance',
  bladesongSorrow: 'mesmer.virtuoso.bladesong-sorrow',
  bladesongHarmony: 'mesmer.virtuoso.bladesong-harmony',
  bladesongDistortion: 'mesmer.virtuoso.bladesong-distortion'
});

export const VIRTUOSO_SHATTER_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_VIRTUOSO_SHATTERS).map(([id, shatter]) => [Number(id), String(shatter.balanceProfileId)])
  )
);

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
      VIRTUOSO_SHATTER_PROFILE_IDS[Number(skillId)],
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
