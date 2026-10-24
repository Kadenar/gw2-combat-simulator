import type { AuraName } from '#gw2/platform/constants.js';
import { AURA, STATUS, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
/** Mechanic and skill-variant tuning for Weaver; traits own their profiles under traits/. */
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/profile-authoring.js';
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

const aura = (name: string, auraName: AuraName, duration: number): SkillEffect => ({
  type: 'aura',
  name,
  aura: auraName,
  duration
});

/** One authored source for stance skill templates and the patchable live-attunement pulse profile. */
export const PRIMORDIAL_STANCE_EFFECTS = Object.freeze({
  strike: { type: 'strike', name: 'Primordial Stance', coefficient: 0.33, hits: 1 },
  Fire: { type: 'condition', name: 'Fire', condition: CONDITION.BURNING, stacks: 1, duration: 2 },
  Water: { type: 'condition', name: 'Water', condition: CONDITION.CHILLED, stacks: 1, duration: 1 },
  Air: { type: 'condition', name: 'Air', condition: CONDITION.VULNERABILITY, stacks: 8, duration: 3 },
  Earth: { type: 'condition', name: 'Earth', condition: CONDITION.BLEEDING, stacks: 2, duration: 6 }
} satisfies Record<string, SkillEffect>);

/** Default profiles registered with the Weaver module data. */
export const WEAVER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Shared Weave Self bucket: `initialDelay` is the attunement recharge applied
  // after every swap inside Weave Self, `recharge` the Perfect Weave window,
  // `duration` the Weave Self duration, and `firstPacketRatio` the
  // fraction of the cast at which Weave Self activates.
  {
    id: WEAVER_BALANCE_PROFILE_IDS.resources,
    name: 'Weaver Attunement Resources',
    profileKind: 'mechanic',
    initialDelay: 2,
    recharge: 10,
    duration: 20,
    firstPacketRatio: 0.65,
    effects: []
  },
  variant(WEAVER_BALANCE_PROFILE_IDS.frostfireFlurry, ID.FROSTFIRE_FLURRY, 'Frostfire Flurry - Consumed Bullets', {
    effects: [aura('Fire', AURA.FIRE, 3), condition('Water', CONDITION.VULNERABILITY, 4, 8)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.purblindingPlasma, ID.PURBLINDING_PLASMA, 'Purblinding Plasma - Fire Bullet', {
    rechargeMultiplier: 2 / 3,
    effects: [condition('Fire', CONDITION.BURNING, 3, 4)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.moltenMeteor, ID.MOLTEN_METEOR, 'Molten Meteor - Earth Bullet', {
    effects: [condition('Earth', CONDITION.BLEEDING, 3, 8)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.flowingFinesse, ID.FLOWING_FINESSE, 'Flowing Finesse - Consumed Bullets', {
    effects: [aura('Water', AURA.FROST, 3), buff('Air', STATUS.SUPERSPEED, 1, 4)]
  }),
  variant(WEAVER_BALANCE_PROFILE_IDS.enervatingEarth, ID.ENERVATING_EARTH, 'Enervating Earth - Earth Bullet', {
    effects: [condition('Earth', CONDITION.BLEEDING, 4, 8)]
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
    duration: 5,
    effects: [
      boon('Fire', boonKey(BOON.MIGHT), 5, 5),
      boon('Water', boonKey(BOON.VIGOR), 1, 5),
      boon('Air', boonKey(BOON.FURY), 1, 5),
      boon('Earth', boonKey(BOON.PROTECTION), 1, 5)
    ]
  },
  {
    id: WEAVER_BALANCE_PROFILE_IDS.ferventStance,
    parentId: ID.FERVENT_STANCE,
    name: 'Fervent Stance - Dual Attack Might',
    profileKind: 'skill-variant',
    duration: 8,
    effects: [boon(BOON.MIGHT, boonKey(BOON.MIGHT), 3, 8)]
  }
]);
