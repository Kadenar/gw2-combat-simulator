import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  isActivePetStrike,
  isPetStrike,
  isPlayerStrike,
  petDerivedConditionMetadata
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerOwningPetState } from '#gw2/professions/ranger/core/mechanics/actor-state.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { activePetFamily, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';

import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import {
  isBeastSkill,
  castCompleted,
  strike,
  strikeEffectsApplied
} from '#gw2/professions/ranger/core/mechanics/combat.js';
import { rangerPetByName } from '#gw2/professions/ranger/data/pets.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';
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
  name: 'Child of Earth'
});

/** Owns Poison Master's live tuning and trait behavior. */
export const poisonMaster = defineTrait({
  lifetime: { eventHandlers: { 'ranger.poison-master-armed': handlePoisonMasterGrant } },
  triggers: [
    {
      // Command activation arms the receiving pet before its first hit, including pulses from an ongoing attack.
      on: 'castStart',
      when: (_runtime, cast) => isBeastSkill(cast.skill),
      run: (runtime, cast) => applyPoisonMasterBeastSkill(runtime, cast.skill)
    },
    onTriggerPoint(strike, {
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof strike>) => triggerPoisonMaster(runtime, input.event)
    }),
    {
      // Merged F3 retains its commitment boundary; merged family skills do not arm Poison Master.
      on: 'castCommit',
      when: (runtime: MechanicQueriesOf<RangerRuntime>, cast) =>
        rangerMerged(runtime.profession) &&
        Boolean(cast.skill.beastmodeSkill) &&
        cast.skill.id === rangerPetByName(runtime.profession.core.activePet).beastmodeSkillIds.at(-1),
      run: (runtime, cast) => applyPoisonMasterBeastSkill(runtime, cast.skill)
    }
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
      factor: (context) => balanceNumberFromContext(context, TRAIT.POISON_MASTER, 'conditionDamageMultiplier'),
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
  // Live pet queries may lack a snapshot; captured packet Expertise replaces this later.
  attributes(context) {
    const profile = requireBalanceProfileFromContext(context, TRAIT.ARACHNOPHOBIA);
    const familyBonus =
      rangerPetEvent(context) && ['spider', 'devourer'].includes(activePetFamily(context))
        ? balanceProfileNumber(profile, 'weaponAttributeBonus')
        : 0;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(profile, 'attributeBonus') + familyBonus,
          feedsConversions: 'none'
        }
      ]
    };
  }
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
  attributes: ({ balanceContext: profileContext, loadout, weaponSet }) => {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceNumberFromContext(
            profileContext,
            TRAIT.AMBIDEXTERITY,
            weapons.some((weapon) => ['Dagger', 'Mace', 'Torch'].includes(weapon ?? ''))
              ? 'weaponAttributeBonus'
              : 'attributeBonus'
          ),
          feedsConversions: 'none'
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
      amount: (context) => balanceNumberFromContext(context, TRAIT.SURVIVAL_INSTINCTS, 'damageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Core Ranger Wilderness Survival condition and control-triggered trait behavior. */

// This trait owns Lesser Muddy Terrain's field delivery, including independently scheduled pulses.
// On an eligible heal, claim Lesser Muddy Terrain's recharge and emit the initial
// immobilize followed by the profile-defined Muddy Terrain condition pulses.
function triggerChildOfEarth(context: RangerRuntime, skill: RangerSkill): void {
  // A trait trigger invokes one independently patchable skill and shares that skill's recharge.
  const proc = context.helpers.skillsById.get(ID.LESSER_MUDDY_TERRAIN)!;

  if (!proc.effects?.length || context.cooldownController.isOnCooldown(proc.id, context.time)) return;

  context.cooldownController.startRecharge(proc, context.time);
  invokeTraitSkill(context, TRAIT.CHILD_OF_EARTH, proc.id, {
    type: 'action',
    source: 'Trait',
    sourceId: proc.id,
    at: context.time,
    skillId: skill.id,
    skillName: skill.name,
    actorType: 'player'
  });
}

/** Pet activation captures its recipient; merged Beast skills retain their existing commitment boundary. */
function applyPoisonMasterBeastSkill(context: RangerRuntime, skill: RangerSkill): void {
  const petCommand = isBeastSkill(skill);
  const notBeforeCombat =
    !context.hasExplicitCombatStart || (context.combatStartTime != null && context.time >= context.combatStartTime);

  if (petCommand || notBeforeCombat) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'ranger.poison-master-armed',
        at: context.time,
        source: 'Trait',
        sourceId: TRAIT.POISON_MASTER,
        actorType: 'effect',
        ...(petCommand ? { summonOwner: rangerPetCompanionId(context) } : {}),
        skillId: skill.id,
        skillName: skill.name
      }
    });
  }
}

function triggerPoisonMaster(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = professionCoreState(context);
  // Player and pet hold separate grants; either route retains the trait's player-scaled poison.
  const merged = rangerMerged(context.profession);
  // Ranger-owned Cloud/vine packets retain pet provenance, but cannot spend the companion's next-strike grant.
  const actor = merged
    ? isPlayerStrike(event) && Number(event.coefficient) > 0
      ? state.player
      : null
    : isActivePetStrike(context, event)
      ? state.pet
      : null;

  if (!actor?.poisonMasterReady) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.POISON_MASTER);
  const poison = requireEffect(profile, 'condition', 'Poisoned');

  // The armed pet attack exists only to deliver poison, so a removed packet leaves it armed.
  if (!poison) return;

  actor.poisonMasterReady = false;
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

function handlePoisonMasterGrant(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.POISON_MASTER)) {
    const state = professionCoreState(context);
    // A delayed grant can only reach the companion that accepted the command, never a newer incarnation.
    const actor = event.summonOwner ? rangerOwningPetState(state.pet, event.summonOwner) : state.player;

    if (actor) actor.poisonMasterReady = true;
  }
}
