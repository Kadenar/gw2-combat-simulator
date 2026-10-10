import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { petDerivedConditionMetadata } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import {
  beastSkillUsed,
  castCompleted,
  strike,
  strikeEffectsApplied
} from '#gw2/professions/ranger/core/mechanics/combat.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Owns Child of Earth's live tuning and trait behavior. */
export const childOfEarth = defineTrait({
  triggers: [
    onTriggerPoint(castCompleted, {
      when: (_runtime, input: TriggerPointInput<typeof castCompleted>) => input.skill.type === 'Heal',
      run: (runtime, input: TriggerPointInput<typeof castCompleted>) => triggerChildOfEarth(runtime, input.skill)
    })
  ],
  id: TRAIT.CHILD_OF_EARTH,
  name: 'Child of Earth',
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 20,
    pulseInterval: 2,
    maximumStacks: 5,
    effects: [
      {
        name: 'Immobilized',
        type: 'condition',
        condition: 'Immobilized',
        duration: 1,
        stacks: 1
      },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', duration: 2, stacks: 1 },
      { name: 'Slow', type: 'condition', condition: 'Slow', duration: 1, stacks: 1 }
    ]
  }
});

/** Owns Poison Master's live tuning and trait behavior. */
export const poisonMaster = defineTrait({
  lifetime: { eventHandlers: { 'ranger.beast-skill-used': handleRangerBeastSkillUsed } },
  triggers: [
    onTriggerPoint(strike, {
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof strike>) => triggerPoisonMaster(runtime, input.event)
    }),
    onTriggerPoint(beastSkillUsed, {
      when: (_runtime, input: TriggerPointInput<typeof beastSkillUsed>) => input.poisonMaster,
      run: (runtime, input: TriggerPointInput<typeof beastSkillUsed>) =>
        applyPoisonMasterBeastSkill(runtime, input.skill)
    })
  ],
  id: TRAIT.POISON_MASTER,
  name: 'Poison Master',
  balance: {
    conditionDamageMultiplier: 1.25,
    effects: [{ name: 'Poisoned', type: 'condition', condition: 'Poisoned', duration: 8, stacks: 2 }]
  },
  modifierRules: [
    {
      order: 13,
      id: 'ranger.poison-master',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.POISON_MASTER),
          'conditionDamageMultiplier'
        ),
      // The damage bonus is Ranger-owned; the separately triggered pet attack also resolves from Ranger stats.
      when: (context) => context.condition === 'Poisoned' && isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Arachnophobia's live tuning and trait behavior. */
export const arachnophobia = defineTrait({
  triggers: [
    onTriggerPoint(strikeEffectsApplied, {
      run: (runtime, input: TriggerPointInput<typeof strikeEffectsApplied>) =>
        triggerArachnophobia(runtime, input.event)
    })
  ],
  id: TRAIT.ARACHNOPHOBIA,
  name: 'Arachnophobia',
  balance: {
    // Torment belongs to the triggering spider/devourer pet; pet damage is excluded from this preview.
    damagePreviewAttribution: 'summon',
    attributeBonus: 150,
    weaponAttributeBonus: 225,
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 3, stacks: 1 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.ARACHNOPHOBIA, [
    { kind: 'flat', to: 'Expertise', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Carnivore's live tuning and trait behavior. */
export const carnivore = defineTrait({
  id: TRAIT.CARNIVORE,
  name: 'Carnivore',
  balance: {
    internalCooldown: 0.25,
    // Resolve and display the siphon separately, using base damage plus Power without weapon or armor scaling.
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 3255,
        flatStrikePowerCoeff: 0.05,
        damageBreakdownName: 'Life Siphon - Carnivore',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      order: 0,
      emit: TRAIT.CARNIVORE,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.CARNIVORE), 'strike', 'Strike')),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.CARNIVORE,
        skillName: 'Carnivore',
        name: 'Carnivore',
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Natural Vigor's live tuning and trait behavior. */
export const naturalVigor = defineTrait({
  id: TRAIT.NATURAL_VIGOR,
  name: 'Natural Vigor',
  balance: {
    vigorRegenerationMultiplier: 0.25
  }
});

/** Owns Ambidexterity's live tuning and trait behavior. */
export const ambidexterity = defineTrait({
  id: TRAIT.AMBIDEXTERITY,
  name: 'Ambidexterity',
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120,
    rechargeMultiplier: 0.8
  },
  rechargeRules: [
    {
      order: 4,
      when: (_runtime, skill) => ['Dagger', 'Torch'].includes(String(skill.weapon)),
      multiplier: { profile: TRAIT.AMBIDEXTERITY, field: 'rechargeMultiplier' }
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.AMBIDEXTERITY);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(
            profile,
            weapons.some((weapon) => ['Dagger', 'Mace', 'Torch'].includes(weapon))
              ? 'weaponAttributeBonus'
              : 'attributeBonus'
          ),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Survival Instincts's live tuning and trait behavior. */
export const survivalInstincts = defineTrait({
  id: TRAIT.SURVIVAL_INSTINCTS,
  name: 'Survival Instincts',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.15 },
  modifierRules: [
    {
      order: 14,
      id: 'ranger.survival-instincts',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SURVIVAL_INSTINCTS), 'damageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Core Ranger Wilderness Survival condition and control-triggered trait behavior. */

// This trait owns Lesser Muddy Terrain's field delivery, including independently scheduled pulses.
// On an eligible heal, claim Lesser Muddy Terrain's recharge and emit the initial
// immobilize followed by the profile-defined Muddy Terrain condition pulses.
function triggerChildOfEarth(context: RangerRuntime, skill: RangerSkill): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.CHILD_OF_EARTH);
  const immobilized = requireEffect(profile, 'condition', 'Immobilized');
  // Pulse conditions keep their own identities, so removing one never rebinds another.
  const pulses = [requireEffect(profile, 'condition', 'Crippled'), requireEffect(profile, 'condition', 'Slow')].filter(
    (effect) => effect !== undefined
  );
  // The cooldown gates the lesser field; with every packet removed there is nothing to gate.
  if (!immobilized && !pulses.length) return;
  if (!context.procs.claim(TRAIT.CHILD_OF_EARTH, 'ranger.core.childOfEarth', context.time)) return;
  const at = context.time;
  if (immobilized)
    emitTraitProfile(context, TRAIT.CHILD_OF_EARTH, TRAIT.CHILD_OF_EARTH, undefined, {
      at: at,
      fullEnd: at,
      effect: { type: 'condition', name: 'Immobilized' },
      attribution: {
        source: 'Trait',
        actorType: 'effect',
        skillId: TRAIT.CHILD_OF_EARTH,
        skillName: 'Child of Earth',
        name: 'Lesser Muddy Terrain - Immobilized',
        triggeredBy: skill.name,
        sourceId: TRAIT.CHILD_OF_EARTH
      }
    });
  const applications = balanceProfileNumber(profile, 'maximumStacks');
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  for (let application = 0; application < applications; application += 1) {
    // The field owns its pulse count and cadence; the selected effects own each condition application.
    emitTraitProfile(context, TRAIT.CHILD_OF_EARTH, TRAIT.CHILD_OF_EARTH, undefined, {
      at: at + application * interval,
      effects: (effect) => pulses.includes(effect as (typeof pulses)[number]),
      attribution: { skillId: TRAIT.CHILD_OF_EARTH, skillName: 'Child of Earth', triggeredBy: skill.name },
      transform: (packet) => ({ ...packet, name: 'Lesser Muddy Terrain - ' + packet.condition })
    });
  }
}

/** Applies the trait at the accepted Beast-skill boundary. */
function applyPoisonMasterBeastSkill(context: RangerRuntime, skill: RangerSkill): void {
  const notBeforeCombat =
    !context.hasExplicitCombatStart || (context.combatStartTime != null && context.time >= context.combatStartTime);
  if (notBeforeCombat) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'ranger.beast-skill-used',
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.POISON_MASTER,
        actorType: 'effect',
        skillId: skill.id,
        skillName: skill.name
      }
    });
  }
}

function triggerPoisonMaster(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  if (!state.poisonMasterPetAttackReady || !isPetStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, TRAIT.POISON_MASTER);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The armed pet attack exists only to deliver poison, so a removed packet leaves it armed.
  if (!poison) return;
  state.poisonMasterPetAttackReady = false;
  emitTraitProfile(context, TRAIT.POISON_MASTER, TRAIT.POISON_MASTER, undefined, {
    at: event.at,
    fullEnd: event.at,
    effect: { type: 'condition', name: 'Poisoned' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.POISON_MASTER,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.POISON_MASTER,
      skillName: 'Poison Master',
      name: 'Poison Master - Poisoned',
      triggeredBy: event.skillName
    }
  });
}

function triggerArachnophobia(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPetStrike(event) || (event.skillId !== ID.SPIT && event.skillId !== ID.TWIN_DARTS)) return;
  // Split the per-attack duration across Twin Darts while preserving each packet's authored condition and pet ownership.
  const divisor = event.skillId === ID.TWIN_DARTS ? Number(event.totalHits || 2) : 1;
  emitTraitProfile(context, TRAIT.ARACHNOPHOBIA, TRAIT.ARACHNOPHOBIA, undefined, {
    at: event.at,
    effect: { type: 'condition', name: 'Torment' },
    attribution: {
      source: isPetStrike(event) ? 'ranger-pet' : 'Trait',
      actorType: isPetStrike(event) ? 'summon' : 'effect',
      ownerActorType: isPetStrike(event) ? undefined : 'player',
      skillId: TRAIT.ARACHNOPHOBIA,
      skillName: 'Arachnophobia',
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      ...petDerivedConditionMetadata(context, event),
      name: 'Arachnophobia - ' + packet.condition,
      duration: Number(packet.duration) / divisor
    })
  });
}

function handleRangerBeastSkillUsed(context: RangerResolverContext, _event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.POISON_MASTER)) {
    professionCoreState(context).poisonMasterPetAttackReady = true;
  }
}
