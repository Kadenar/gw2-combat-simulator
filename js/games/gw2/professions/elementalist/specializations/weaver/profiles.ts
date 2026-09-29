/** Mechanic and skill-variant tuning for Weaver; traits own their profiles under traits/. */
import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Stable mechanic and skill-variant patch identities. */
export const WEAVER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.weaver.resources',
  primordialStance: 'elementalist.weaver.primordial-stance',
  unravel: 'elementalist.weaver.unravel',
  ferventStance: 'elementalist.weaver.fervent-stance',
  frostfireFlurry: 'elementalist.weaver.frostfire-flurry-bullets',
  purblindingPlasma: 'elementalist.weaver.purblinding-plasma-bullet',
  moltenMeteor: 'elementalist.weaver.molten-meteor-bullet',
  flowingFinesse: 'elementalist.weaver.flowing-finesse-bullets',
  enervatingEarth: 'elementalist.weaver.enervating-earth-bullet'
});

const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

const buff = (name: string, kind: string, stacks: number, duration: number): SkillEffect => ({
  type: 'buff',
  name,
  kind,
  stacks,
  duration
});

const condition = (name: string, conditionName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'condition',
  name,
  condition: conditionName,
  stacks,
  duration
});

const aura = (name: string, auraName: string, duration: number): SkillEffect => ({
  type: 'buff',
  name,
  kind: auraName,
  stacks: 1,
  duration
});

/** One authored source for stance skill templates and the patchable live-attunement pulse profile. */
export const PRIMORDIAL_STANCE_EFFECTS = Object.freeze({
  strike: { type: 'strike', name: 'Primordial Stance', coefficient: 0.33, hits: 1 },
  Fire: { type: 'condition', name: 'Fire', condition: 'Burning', stacks: 1, duration: 2 },
  Water: { type: 'condition', name: 'Water', condition: 'Chilled', stacks: 1, duration: 1 },
  Air: { type: 'condition', name: 'Air', condition: 'Vulnerability', stacks: 8, duration: 3 },
  Earth: { type: 'condition', name: 'Earth', condition: 'Bleeding', stacks: 2, duration: 6 }
} satisfies Record<string, SkillEffect>);

/** Default profiles registered with the Weaver module data. */
export const WEAVER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Shared Weave Self bucket: `initialDelay` is the attunement recharge applied
  // after every swap inside Weave Self, `recharge` the Perfect Weave window,
  // `durationMultiplier` the Weave Self duration, and `firstPacketRatio` the
  // fraction of the cast at which Weave Self activates.
  {
    id: WEAVER_BALANCE_PROFILE_IDS.resources,
    name: 'Weaver Attunement Resources',
    profileKind: 'mechanic',
    initialDelay: 2,
    recharge: 10,
    durationMultiplier: 20,
    maximumStacks: 4,
    firstPacketRatio: 0.65,
    effects: []
  },
  variant(WEAVER_BALANCE_PROFILE_IDS.frostfireFlurry, ID.FROSTFIRE_FLURRY, 'Frostfire Flurry - Consumed Bullets', {
    effects: [aura('Fire', 'Fire Aura', 3), condition('Water', 'Vulnerability', 4, 8)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.purblindingPlasma, ID.PURBLINDING_PLASMA, 'Purblinding Plasma - Fire Bullet', {
    rechargeMultiplier: 2 / 3,
    effects: [condition('Fire', 'Burning', 3, 4)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.moltenMeteor, ID.MOLTEN_METEOR, 'Molten Meteor - Earth Bullet', {
    effects: [condition('Earth', 'Bleeding', 3, 8)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.flowingFinesse, ID.FLOWING_FINESSE, 'Flowing Finesse - Consumed Bullets', {
    effects: [aura('Water', 'Frost Aura', 3), buff('Air', 'superspeed', 1, 4)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.enervatingEarth, ID.ENERVATING_EARTH, 'Enervating Earth - Earth Bullet', {
    effects: [condition('Earth', 'Bleeding', 4, 8)]
  }),
  {
    id: WEAVER_BALANCE_PROFILE_IDS.primordialStance,
    parentId: ID.PRIMORDIAL_STANCE_FIRE,
    name: 'Primordial Stance - Dynamic Pulse',
    profileKind: 'skill-variant',
    effects: Object.values(PRIMORDIAL_STANCE_EFFECTS)
  },
  {
    id: WEAVER_BALANCE_PROFILE_IDS.unravel,
    parentId: ID.UNRAVEL,
    name: 'Unravel - Attunement and Boons',
    profileKind: 'skill-variant',
    durationMultiplier: 5,
    effects: [
      boon('Fire', 'might', 5, 5),
      boon('Water', 'vigor', 1, 5),
      boon('Air', 'fury', 1, 5),
      boon('Earth', 'protection', 1, 5)
    ]
  },
  {
    id: WEAVER_BALANCE_PROFILE_IDS.ferventStance,
    parentId: ID.FERVENT_STANCE,
    name: 'Fervent Stance - Dual Attack Might',
    profileKind: 'skill-variant',
    durationMultiplier: 8,
    effects: [boon('Might', 'might', 3, 8)]
  }
]);
