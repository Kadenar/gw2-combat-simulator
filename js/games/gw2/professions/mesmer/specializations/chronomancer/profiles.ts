import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { mesmerShatterProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';

export const CHRONOMANCER_BALANCE_PROFILE_IDS = Object.freeze({
  continuumSplit: 'mesmer.chronomancer.continuum-split'
});

export const CHRONOMANCER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  ...Object.entries(MESMER_CHRONOMANCER_SHATTERS).map(([skillId, shatter]) => ({
    ...mesmerShatterProfile(
      Number(skillId),
      {
        [ID.CONTINUUM_SPLIT]: 'Continuum Split',
        [ID.TIME_SINK]: 'Time Sink',
        [ID.REWINDER]: 'Rewinder',
        [ID.SPLIT_SECOND]: 'Split Second'
      }[Number(skillId)] || `Chronomancer Shatter ${skillId}`,
      shatter
    ),
    ...(shatter.durationPerTier == null ? {} : { durationPerTier: shatter.durationPerTier })
  }))
]);
