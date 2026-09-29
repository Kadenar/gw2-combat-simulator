import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { mesmerShatterProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';

export const CHRONOMANCER_BALANCE_PROFILE_IDS = Object.freeze({
  continuumSplit: 'mesmer.chronomancer.continuum-split',
  timeSink: 'mesmer.chronomancer.time-sink',
  rewinder: 'mesmer.chronomancer.rewinder',
  splitSecond: 'mesmer.chronomancer.split-second'
});

export const CHRONOMANCER_SHATTER_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_CHRONOMANCER_SHATTERS).map(([id, shatter]) => [Number(id), String(shatter.balanceProfileId)])
  )
);

export const CHRONOMANCER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  ...Object.entries(MESMER_CHRONOMANCER_SHATTERS).map(([skillId, shatter]) => ({
    ...mesmerShatterProfile(
      CHRONOMANCER_SHATTER_PROFILE_IDS[Number(skillId)],
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
