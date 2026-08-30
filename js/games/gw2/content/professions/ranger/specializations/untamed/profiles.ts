import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import { defineTraitProfile as trait } from '#gw2/integrations/patches/authoring/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';

export const UNTAMED_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'ranger.untamed.resources',
  explodingSporesRanger: 'ranger.untamed.exploding-spores.ranger',
  explodingSporesPet: 'ranger.untamed.exploding-spores.pet',
  letLoose: TRAIT.LET_LOOSE,
  blindingOutburst: TRAIT.BLINDING_OUTBURST,
  ferociousSymbiosis: TRAIT.FEROCIOUS_SYMBIOSIS,
  debilitatingBlows: TRAIT.DEBILITATING_BLOWS,
  enhancingImpact: TRAIT.ENHANCING_IMPACT
});

export const UNTAMED_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: UNTAMED_BALANCE_PROFILE_IDS.resources,
    name: 'Unleash and Ambush Windows',
    profileKind: 'mechanic',
    durationMultiplier: 4,
    internalCooldown: 9,
    recharge: 1,
    maximumStacks: 5,
    pulseInterval: 0.5,
    effects: []
  },
  {
    id: UNTAMED_BALANCE_PROFILE_IDS.explodingSporesRanger,
    parentId: ID.EXPLODING_SPORES,
    name: 'Exploding Spores - Ranger Unleashed',
    profileKind: 'skill-variant',
    effects: [{ type: 'boon', boon: 'might', duration: 10, stacks: 8 }]
  },
  {
    id: UNTAMED_BALANCE_PROFILE_IDS.explodingSporesPet,
    parentId: ID.EXPLODING_SPORES,
    name: 'Exploding Spores - Pet Unleashed',
    profileKind: 'skill-variant',
    effects: [{ type: 'boon', boon: 'protection', duration: 4, stacks: 1 }]
  },
  trait(UNTAMED_BALANCE_PROFILE_IDS.letLoose, 'Let Loose', {
    internalCooldown: 9,
    effects: [
      { type: 'boon', boon: 'quickness', duration: 5, stacks: 1 },
      { type: 'boon', boon: 'might', duration: 10, stacks: 5 }
    ]
  }),
  trait(UNTAMED_BALANCE_PROFILE_IDS.blindingOutburst, 'Blinding Outburst', {
    effects: [{ type: 'condition', condition: 'Blindness', duration: 2, stacks: 1 }]
  }),
  trait(UNTAMED_BALANCE_PROFILE_IDS.ferociousSymbiosis, 'Ferocious Symbiosis', {
    maximumStacks: 5,
    durationMultiplier: 5,
    internalCooldown: 0.5
  }),
  trait(UNTAMED_BALANCE_PROFILE_IDS.debilitatingBlows, 'Debilitating Blows', {
    internalCooldown: 1,
    effects: [
      { type: 'condition', condition: 'Poisoned', duration: 5, stacks: 2 },
      { type: 'condition', condition: 'Slow', duration: 2, stacks: 2 }
    ]
  }),
  trait(UNTAMED_BALANCE_PROFILE_IDS.enhancingImpact, 'Enhancing Impact', {
    internalCooldown: 1,
    effects: [
      { type: 'boon', boon: 'quickness', duration: 3, stacks: 1 },
      { type: 'boon', boon: 'stability', duration: 3, stacks: 1 }
    ]
  })
]);
