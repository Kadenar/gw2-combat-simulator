import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/modifiers.js';
import { THIEF_MISC_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/misc-skills.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Landed player attacks against defiant foes trigger Lesser Haste's self boons on one shared ICD. */
export const burstOfAgility = defineTrait({
  id: TRAIT.BURST_OF_AGILITY,
  name: 'Burst of Agility',
  balance: {
    internalCooldown: THIEF_MISC_SKILL_MECHANICS[ID.LESSER_HASTE]!.cooldown,
    effects: THIEF_MISC_SKILL_MECHANICS[ID.LESSER_HASTE]!.effects
  },
  triggers: [
    {
      on: 'damage.resolved',
      emit: TRAIT.BURST_OF_AGILITY,
      icd: 'profile',
      when: (runtime, event) =>
        event.actorType === 'player' && Number(event.coefficient) > 0 && Boolean(runtime.config.target?.defiant),
      attribution: (runtime, event) => ({
        skillId: ID.LESSER_HASTE,
        skillName: 'Lesser Haste',
        name: 'Lesser Haste',
        icon: runtime.helpers.skillsById.get(ID.LESSER_HASTE)?.icon,
        triggeredBy: event.skillName,
        audience: { recipients: 'self' }
      })
    }
  ]
});

/** Owns Bountiful Theft tuning and behavior at the existing execution boundaries. */
export const bountifulTheft = defineTrait({
  id: TRAIT.BOUNTIFUL_THEFT,
  name: 'Bountiful Theft',
  balance: {
    effects: [
      { type: 'boon', name: 'Vigor', boon: 'Vigor', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 5, duration: 10 }
    ]
  }
});

/** Owns Deadly Ambush tuning and behavior at the existing execution boundaries. */
export const deadlyAmbush = defineTrait({
  id: TRAIT.DEADLY_AMBUSH,
  name: 'Deadly Ambush',
  modifierRules: [
    {
      order: 11,
      id: 'thief.deadly-ambush-bleeding',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === 'Bleeding'
    }
  ],
  balance: {
    effects: [{ type: 'condition', name: 'Bleeding', condition: 'Bleeding', stacks: 3, duration: 10 }]
  }
});

/** Owns Kleptomaniac tuning and behavior at the existing execution boundaries. */
export const kleptomaniac = defineTrait({
  id: TRAIT.KLEPTOMANIAC,
  name: 'Kleptomaniac',
  balance: {
    resourceGain: 2
  }
});

/** Owns Lead Attacks tuning and behavior at the existing execution boundaries. */
export const leadAttacks = defineTrait({
  id: TRAIT.LEAD_ATTACKS,
  name: 'Lead Attacks',
  modifierRules: [
    {
      order: 7,
      id: 'thief.lead-attacks',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      // Grants, damage and siphons share selected tuning; each packet counts its own live stacks.
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.LEAD_ATTACKS);
        return (
          Math.min(
            balanceProfileNumber(profile, 'maximumStacks'),
            activeStackCount(thiefRuntimeState(context).leadAttackExpirations || [], context.time)
          ) * balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    maximumStacks: 15,
    durationMultiplier: 10,
    damageIncreasePerStack: 0.01,
    rechargeMultiplier: 0.85
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => Boolean(skill.stealTraitSkill) && skill.stealRechargeMode !== 'additive',
      multiplier: { profile: TRAIT.LEAD_ATTACKS, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Preparedness tuning and behavior at the existing execution boundaries. */
export const preparedness = defineTrait({
  id: TRAIT.PREPAREDNESS,
  name: 'Preparedness',
  balance: { attributeBonus: 150 },
  buildAttributes(_common, { balanceContext }) {
    const preparednessProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.PREPAREDNESS);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(preparednessProfile, 'attributeBonus'),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Quick Pockets tuning and behavior at the existing execution boundaries. */
export const quickPockets = defineTrait({
  id: TRAIT.QUICK_POCKETS,
  name: 'Quick Pockets',
  balance: {
    internalCooldown: 8,
    resourceGain: 3
  }
});

/** Owns Sleight of Hand tuning and behavior at the existing execution boundaries. */
export const sleightOfHand = defineTrait({
  id: TRAIT.SLEIGHT_OF_HAND,
  name: 'Sleight of Hand',
  balance: {
    rechargeMultiplier: 0.8,
    effects: [{ type: 'control', name: 'daze', kind: 'daze' }]
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => Boolean(skill.stealTraitSkill) && skill.stealRechargeMode !== 'additive',
      multiplier: { profile: TRAIT.SLEIGHT_OF_HAND, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Thrill of the Crime tuning and behavior at the existing execution boundaries. */
export const thrillOfTheCrime = defineTrait({
  id: TRAIT.THRILL_OF_THE_CRIME,
  name: 'Thrill of the Crime',
  balance: {
    effects: [
      { type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 5, duration: 10 },
      { type: 'boon', name: 'Swiftness', boon: 'Swiftness', stacks: 1, duration: 10 }
    ]
  }
});

/** Owns Uncatchable tuning and behavior at the existing execution boundaries. */
export const uncatchable = defineTrait({
  id: TRAIT.UNCATCHABLE,
  name: 'Uncatchable',
  balance: {
    // Effect timelines own pulse timing for simulation, patch authoring, and tooltips.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        name: 'Bleeding',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        applications: 3,
        atMs: 800,
        intervalMs: 1000
      },
      {
        type: 'condition',
        name: 'Crippled',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 3,
        atMs: 800,
        intervalMs: 1000
      }
    ])
  }
});
