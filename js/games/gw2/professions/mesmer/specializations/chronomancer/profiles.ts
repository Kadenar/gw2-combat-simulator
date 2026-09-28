import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerShatterProfile } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_CHRONOMANCER_SHATTERS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';

export const CHRONOMANCER_BALANCE_PROFILE_IDS = Object.freeze({
  continuumSplit: 'mesmer.chronomancer.continuum-split',
  timeSink: 'mesmer.chronomancer.time-sink',
  rewinder: 'mesmer.chronomancer.rewinder',
  splitSecond: 'mesmer.chronomancer.split-second',
  flowOfTime: TRAIT.FLOW_OF_TIME,
  dangerTime: TRAIT.DANGER_TIME,
  timeBomb: TRAIT.TIME_BOMB,
  illusionaryReversion: TRAIT.ILLUSIONARY_REVERSION,
  stretchedTime: TRAIT.STRETCHED_TIME,
  seizeTheMoment: TRAIT.SEIZE_THE_MOMENT,
  chronophantasma: TRAIT.CHRONOPHANTASMA
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
  })),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.flowOfTime, 'Flow of Time', {
    criticalChance: 0.15
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.dangerTime, 'Danger Time', {
    criticalDamage: 0.05,
    durationMultiplier: 10
  }),
  // The trait owns its explosion packet and delay for both runtime and tooltip consumers.
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.timeBomb, 'Time Bomb', {
    durationMultiplier: 5,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 3, hits: 1 }]
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.illusionaryReversion, 'Illusionary Reversion', {
    threshold: 3,
    resourceGain: 1
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.stretchedTime, 'Stretched Time', {
    durationPerTier: 1,
    effects: [
      {
        name: 'alacrity',
        type: 'boon',
        boon: 'alacrity',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment, 'Seize the Moment', {
    durationPerTier: 1,
    effects: [
      {
        name: 'quickness',
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      }
    ]
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.chronophantasma, 'Chronophantasma', {
    damageMultiplier: 1.05
  })
]);
