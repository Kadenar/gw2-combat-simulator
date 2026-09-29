import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import {
  guardianTimedBuffActive,
  latestGuardianTimedBuff
} from '#gw2/professions/guardian/core/mechanics/modifier-queries.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { AURA_DETONATE, detonate } from '#gw2/professions/guardian/specializations/luminary/traits/behavior.js';

/** Completed stance casts emit the surviving party boon and hostile Blind components. */
export const shimmeringStances = defineTrait({
  id: TRAIT.SHIMMERING_STANCES,
  name: 'Shimmering Stances',
  balance: {
    effects: [
      { type: 'boon', name: 'protection', boon: 'protection', duration: 3, audience: { recipients: 'party' } },
      { type: 'blind', name: 'Blind', duration: 3 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHIMMERING_STANCES,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Stance')),
      attribution: (_runtime, cast) => ({
        source: 'guardian',
        skillId: TRAIT.SHIMMERING_STANCES,
        skillName: 'Shimmering Stances',
        offTarget: cast.command.offTarget === true
      })
    }
  ]
});

/** Consumes only a live aura with a surviving strike, preserving detonation priority and already-scheduled work. */
export const sovereignOfLight = defineTrait({
  id: TRAIT.SOVEREIGN_OF_LIGHT,
  name: 'Sovereign of Light',
  balance: {
    effects: [{ type: 'strike', name: 'Strike', coefficient: 1.5, hits: 1 }]
  },
  hooks: { tasks: { [AURA_DETONATE]: (runtime, data) => detonate(runtime, data as Gw2ResolverEvent) } }
});

/** Accepted equips install the weapon-tagged window; only its latest live hammer grants damage. */
export const radiantArmaments = defineTrait({
  id: TRAIT.RADIANT_ARMAMENTS,
  name: 'Radiant Armaments',
  balance: {
    effects: [{ type: 'buff', name: 'radiant-armaments', kind: 'radiant-armaments', duration: 10 }]
  },
  modifierRules: [
    {
      requiresSelection: false,
      order: -1,
      id: 'guardian.radiant-armaments',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.07,
      when: (context) => {
        const armament = latestGuardianTimedBuff(context, 'guardian-radiant-armaments');
        // The buff is emitted for every radiant weapon, but the +7% bonus is
        // exclusive to the hammer (Dazzling Hammer). The shared effect-clock expiry check is
        // necessary because latestGuardianTimedBuff returns the most-recently
        // applied record regardless of whether it has expired.
        return (
          armament?.metadata?.radiantWeapon === 'hammer' &&
          gw2EffectExpiresAt(armament.at, armament.duration || 0) > context.time
        );
      }
    }
  ]
});

/** Delayed equips extend the capped damage window without revoking already-applied buffs. */
export const empoweredArmaments = defineTrait({
  id: TRAIT.EMPOWERED_ARMAMENTS,
  name: 'Empowered Armaments',
  balance: {
    maximumStacks: 20,
    resourceGain: 6
  },
  modifierRules: [
    {
      requiresSelection: false,
      order: -2,
      id: 'guardian.empowered-armaments',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => guardianTimedBuffActive(context, 'guardian-empowered-armaments')
    }
  ]
});

/** Completed equips grant the authored party boon package at the delayed reward boundary. */
export const resplendentWeaponry = defineTrait({
  id: TRAIT.RESPLENDENT_WEAPONRY,
  name: 'Resplendent Weaponry',
  balance: {
    effects: [
      { type: 'boon', name: 'alacrity', boon: 'alacrity', duration: 4 },
      { type: 'boon', name: 'might', boon: 'might', duration: 8, stacks: 1 },
      { type: 'boon', name: 'fury', boon: 'fury', duration: 5 }
    ]
  }
});

/** Completed equips reduce real virtue recharge and refresh the shared readiness projection. */
export const illuminatingInspiration = defineTrait({
  id: TRAIT.ILLUMINATING_INSPIRATION,
  name: 'Illuminating Inspiration',
  balance: { rechargeReduction: 4 }
});

/** Supplies eligible Vitality before build conversions. */
export const lightsGift = defineTrait({
  id: TRAIT.LIGHTS_GIFT,
  name: "Light's Gift",
  balance: { attributeBonus: 180 },
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'flat',
        to: 'Vitality',
        amount: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.LIGHTS_GIFT),
          'attributeBonus'
        ),
        feedsConversions: true
      }
    ]
  })
});

/** Virtue reset targets and reporting share this behavior-only trait owner. */
export const masterAtArms = defineTrait({ id: TRAIT.MASTER_AT_ARMS, name: 'Master-at-Arms' });

export const luminaryTraits = [
  empoweredArmaments,
  radiantArmaments,
  shimmeringStances,
  sovereignOfLight,
  resplendentWeaponry,
  illuminatingInspiration,
  lightsGift,
  masterAtArms
];
