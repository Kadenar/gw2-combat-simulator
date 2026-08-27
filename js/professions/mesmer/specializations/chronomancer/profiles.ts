import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { defineTraitProfile as trait } from '../../../../platform/gw2/authoring/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerShatterProfile, mesmerTraitDamageProfile } from '../../core/profiles.js';
import { MESMER_CHRONOMANCER_SHATTERS, MESMER_CHRONOMANCER_TRAIT_DAMAGE } from './mechanics.js';

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

export const CHRONOMANCER_SHATTER_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze({
  [ID.CONTINUUM_SPLIT]: CHRONOMANCER_BALANCE_PROFILE_IDS.continuumSplit,
  [ID.TIME_SINK]: CHRONOMANCER_BALANCE_PROFILE_IDS.timeSink,
  [ID.REWINDER]: CHRONOMANCER_BALANCE_PROFILE_IDS.rewinder,
  [ID.SPLIT_SECOND]: CHRONOMANCER_BALANCE_PROFILE_IDS.splitSecond
});

export const CHRONOMANCER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  ...Object.entries(MESMER_CHRONOMANCER_SHATTERS).map(([skillId, shatter]) =>
    mesmerShatterProfile(
      CHRONOMANCER_SHATTER_PROFILE_IDS[Number(skillId)],
      Number(skillId),
      {
        [ID.CONTINUUM_SPLIT]: 'Continuum Split',
        [ID.TIME_SINK]: 'Time Sink',
        [ID.REWINDER]: 'Rewinder',
        [ID.SPLIT_SECOND]: 'Split Second'
      }[Number(skillId)] || `Chronomancer Shatter ${skillId}`,
      shatter,
      Number(skillId) === ID.REWINDER
        ? [
            {
              type: 'condition',
              condition: 'Confusion',
              duration: 3,
              stacks: 1
            }
          ]
        : []
    )
  ),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.flowOfTime, 'Flow of Time', {
    criticalChance: 0.15
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.dangerTime, 'Danger Time', {
    criticalDamage: 0.05,
    durationMultiplier: 10
  }),
  mesmerTraitDamageProfile(
    CHRONOMANCER_BALANCE_PROFILE_IDS.timeBomb,
    'Time Bomb',
    MESMER_CHRONOMANCER_TRAIT_DAMAGE['Time Bomb']
  ),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.illusionaryReversion, 'Illusionary Reversion', {
    threshold: 3,
    resourceGain: 1
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.stretchedTime, 'Stretched Time', {
    durationPerTier: 1,
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 3,
        stacks: 1,
        recipients: 'party',
        maximumRecipients: 5
      }
    ]
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment, 'Seize the Moment', {
    durationPerTier: 1,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1,
        recipients: 'party',
        maximumRecipients: 5
      }
    ]
  }),
  trait(CHRONOMANCER_BALANCE_PROFILE_IDS.chronophantasma, 'Chronophantasma', {
    damageMultiplier: 1.05
  })
]);
