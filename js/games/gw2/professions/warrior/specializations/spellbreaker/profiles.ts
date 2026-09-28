import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

export const SPELLBREAKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.spellbreaker.resources',
  attackersInsight: TRAIT.ATTACKERS_INSIGHT,
  magebaneTether: TRAIT.MAGEBANE_TETHER,
  noEscape: TRAIT.NO_ESCAPE,
  pureStrike: TRAIT.PURE_STRIKE
});

export const SPELLBREAKER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: SPELLBREAKER_BALANCE_PROFILE_IDS.resources,
    name: 'Spellbreaker Adrenaline',
    profileKind: 'mechanic',
    maximumStacks: 20,
    effects: []
  },
  trait(SPELLBREAKER_BALANCE_PROFILE_IDS.attackersInsight, "Attacker's Insight", {
    maximumStacks: 5,
    attributePerStack: 50,
    effects: [{ name: 'attackers-insight', type: 'buff', kind: 'attackers-insight', stacks: 1, duration: 15 }]
  }),
  trait(SPELLBREAKER_BALANCE_PROFILE_IDS.magebaneTether, 'Magebane Tether', {
    cooldown: 12,
    effects: [{ name: 'magebane-tether', type: 'buff', kind: 'magebane-tether', stacks: 1, duration: 8 }]
  }),
  trait(SPELLBREAKER_BALANCE_PROFILE_IDS.noEscape, 'No Escape', {
    effects: [{ name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  }),
  trait(SPELLBREAKER_BALANCE_PROFILE_IDS.pureStrike, 'Pure Strike', {
    // Targets have no boons, so the supported bonus is a single critical-damage multiplier.
    criticalDamage: 1.1
  })
]);
