import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { rangerPetEvent, rangerTargetImpaired } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

function openingStrikeReady(context: Gw2ModifierContext): boolean {
  const core = readProfessionCoreState<{
    playerOpeningStrikeReady?: boolean;
    petOpeningStrikeReady?: boolean;
  }>(context.runtime?.profession);
  return rangerPetEvent(context)
    ? core.petOpeningStrikeReady === true
    : isGw2PlayerModifierOwnedEvent(context.event) && core.playerOpeningStrikeReady === true;
}

function targetVulnerable(context: Gw2ModifierContext): boolean {
  return (context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) > 0;
}

/** Owns Wolfsong's live tuning and trait behavior. */
export const wolfsong = defineTrait({
  id: TRAIT.WOLFSONG,
  name: 'Wolfsong',
  balance: {
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 6,
        stacks: 6
      }
    ]
  },
  modifierRules: [
    {
      order: 8,
      id: 'ranger.wolfsong',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetVulnerable(context)
    }
  ]
});

/** Owns Clarion Bond's live tuning and trait behavior. */
export const clarionBond = defineTrait({
  id: TRAIT.CLARION_BOND,
  name: 'Clarion Bond',
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 15,
    effects: [
      { name: 'fury', type: 'boon', boon: 'fury', duration: 5, stacks: 1 },
      { name: 'might', type: 'boon', boon: 'might', duration: 5, stacks: 6 },
      { name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 5, stacks: 1 },
      { name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 5, stacks: 1 }
    ]
  }
});

/** Owns Opening Strike's live tuning and trait behavior. */
export const openingStrike = defineTrait({
  id: TRAIT.OPENING_STRIKE,
  name: 'Opening Strike',
  balance: {
    effects: [
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 5,
        stacks: 5
      }
    ]
  }
});

/** Owns Alpha Focus's live tuning and trait behavior. */
export const alphaFocus = defineTrait({
  id: TRAIT.ALPHA_FOCUS,
  name: 'Alpha Focus',
  balance: {
    effects: [{ name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 }]
  }
});

/** Owns Hunter's Gaze's live tuning and trait behavior. */
export const huntersGaze = defineTrait({
  id: TRAIT.HUNTERS_GAZE,
  name: "Hunter's Gaze",
  balance: {
    internalCooldown: 1,
    maximumStacks: 3,
    effects: [{ name: 'might', type: 'boon', boon: 'might', duration: 5, stacks: 1 }]
  }
});

/** Owns Lead the Wind's live tuning and trait behavior. */
export const leadTheWind = defineTrait({
  id: TRAIT.LEAD_THE_WIND,
  name: 'Lead the Wind',
  balance: {
    rechargeMultiplier: 0.8,
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 10, stacks: 1 },
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 5, stacks: 1 }
    ]
  },
  triggers: [
    {
      order: 3,
      emit: TRAIT.LEAD_THE_WIND,
      on: 'castCommit' as const,
      when: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) =>
        cast.skill.id === ID.POINT_BLANK_SHOT,
      effects: (effect) => effect.type === 'boon' && effect.name === 'swiftness',
      attribution: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => ({
        skillId: TRAIT.LEAD_THE_WIND,
        skillName: 'Lead the Wind',
        name: `Lead the Wind - swiftness`,
        triggeredBy: cast.skill.name
      })
    },
    {
      order: 4,
      emit: TRAIT.LEAD_THE_WIND,
      on: 'castCommit' as const,
      when: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) =>
        cast.skill.id === ID.POINT_BLANK_SHOT,
      effects: (effect) => effect.type === 'boon' && effect.name === 'quickness',
      attribution: (_runtime: MechanicQueriesOf<RangerRuntime>, cast: RuntimeCast<RangerSkill>) => ({
        skillId: TRAIT.LEAD_THE_WIND,
        skillName: 'Lead the Wind',
        name: `Lead the Wind - quickness`,
        triggeredBy: cast.skill.name
      })
    }
  ],
  rechargeRules: [
    {
      order: 3,
      when: (_runtime, skill) => skill.weapon === 'Longbow',
      multiplier: { profile: TRAIT.LEAD_THE_WIND, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Precise Strike's live tuning and trait behavior. */
export const preciseStrike = defineTrait({
  id: TRAIT.PRECISE_STRIKE,
  name: 'Precise Strike',
  balance: {
    criticalChance: 1
  },
  modifierRules: [
    {
      order: 10,
      id: 'ranger.precise-strike',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PRECISE_STRIKE), 'criticalChance'),
      when: (context) => openingStrikeReady(context)
    }
  ]
});

/** Owns Farsighted's live tuning and trait behavior. */
export const farsighted = defineTrait({
  id: TRAIT.FARSIGHTED,
  name: 'Farsighted',
  modifierRules: [
    {
      order: 6,
      id: 'ranger.farsighted',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        skillForEvent(context.profession?.catalog, context.event, context.skillId)?.type === 'Weapon'
    }
  ]
});

/** Owns Remorseless's live tuning and trait behavior. */
export const remorseless = defineTrait({
  id: TRAIT.REMORSELESS,
  name: 'Remorseless',
  modifierRules: [
    {
      order: 9,
      id: 'ranger.remorseless',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      when: (context) => openingStrikeReady(context)
    }
  ]
});

/** Owns Predator's Onslaught's live tuning and trait behavior. */
export const predatorsOnslaught = defineTrait({
  id: TRAIT.PREDATORS_ONSLAUGHT,
  name: "Predator's Onslaught",
  modifierRules: [
    {
      order: 11,
      id: 'ranger.predators-onslaught-player',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && rangerTargetImpaired(context)
    },
    {
      order: 33,
      id: 'ranger.predators-onslaught-pet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => rangerPetEvent(context) && rangerTargetImpaired(context)
    }
  ]
});
