import type { BalanceProfile } from '../../../../../platform/engine/types.js';
import { defineTraitProfile as trait } from '../../../../../integrations/patches/authoring/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerShatterProfile, mesmerTraitDamageProfile } from '../../core/profiles.js';
import { MESMER_VIRTUOSO_SHATTERS, MESMER_VIRTUOSO_TRAIT_DAMAGE } from './mechanics.js';

export const VIRTUOSO_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'mesmer.virtuoso.resources',
  bladeturnRequiem: 'mesmer.virtuoso.bladeturn-requiem',
  bladesongDissonance: 'mesmer.virtuoso.bladesong-dissonance',
  bladesongSorrow: 'mesmer.virtuoso.bladesong-sorrow',
  bladesongHarmony: 'mesmer.virtuoso.bladesong-harmony',
  bladesongDistortion: 'mesmer.virtuoso.bladesong-distortion',
  deadlyBlades: TRAIT.DEADLY_BLADES,
  quietIntensity: TRAIT.QUIET_INTENSITY,
  mentalFocus: TRAIT.MENTAL_FOCUS,
  jaggedMind: TRAIT.JAGGED_MIND,
  phantasmalBlades: TRAIT.PHANTASMAL_BLADES,
  sharpeningSorrow: 2207,
  infiniteForge: TRAIT.INFINITE_FORGE,
  bloodsong: TRAIT.BLOODSONG
});

export const VIRTUOSO_SHATTER_PROFILE_IDS: Readonly<Record<number, string>> = Object.freeze({
  [ID.BLADETURN_REQUIEM]: VIRTUOSO_BALANCE_PROFILE_IDS.bladeturnRequiem,
  [ID.BLADESONG_DISSONANCE]: VIRTUOSO_BALANCE_PROFILE_IDS.bladesongDissonance,
  [ID.BLADESONG_SORROW]: VIRTUOSO_BALANCE_PROFILE_IDS.bladesongSorrow,
  [ID.BLADESONG_HARMONY]: VIRTUOSO_BALANCE_PROFILE_IDS.bladesongHarmony,
  [ID.BLADESONG_DISTORTION]: VIRTUOSO_BALANCE_PROFILE_IDS.bladesongDistortion
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
      VIRTUOSO_SHATTER_PROFILE_IDS[Number(skillId)],
      Number(skillId),
      {
        [ID.BLADETURN_REQUIEM]: 'Bladeturn Requiem',
        [ID.BLADESONG_DISSONANCE]: 'Bladesong Dissonance',
        [ID.BLADESONG_SORROW]: 'Bladesong Sorrow',
        [ID.BLADESONG_HARMONY]: 'Bladesong Harmony',
        [ID.BLADESONG_DISTORTION]: 'Bladesong Distortion'
      }[Number(skillId)] || `Virtuoso Shatter ${skillId}`,
      shatter,
      Number(skillId) === ID.BLADESONG_SORROW
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
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.deadlyBlades, 'Deadly Blades', {
    durationMultiplier: 7,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 5,
        stacks: 1
      }
    ]
  }),
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.quietIntensity, 'Quiet Intensity', {
    criticalChance: 0.15,
    vitalityConversion: 0.1
  }),
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.mentalFocus, 'Mental Focus', {
    damageMultiplier: 1.05
  }),
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.jaggedMind, 'Jagged Mind', {
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        duration: 4,
        stacks: 1
      }
    ]
  }),
  mesmerTraitDamageProfile(
    VIRTUOSO_BALANCE_PROFILE_IDS.phantasmalBlades,
    'Phantasmal Blades',
    MESMER_VIRTUOSO_TRAIT_DAMAGE['Phantasmal Blade']
  ),
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.sharpeningSorrow, 'Sharpening Sorrow', {
    expertiseBonus: 150
  }),
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.infiniteForge, 'Infinite Forge', {
    pulseInterval: 3,
    threshold: 5,
    playerStacks: 1,
    resourceGain: 2
  }),
  trait(VIRTUOSO_BALANCE_PROFILE_IDS.bloodsong, 'Bloodsong', {
    threshold: 5,
    resourceGain: 1
  })
]);
