/** Owns imperative Defense trait effects while the public dispatcher preserves cross-line ordering. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { gainWarriorAdrenaline } from '#gw2/content/professions/warrior/resources.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/core/profiles.js';
import {
  warriorBoonActive,
  warriorEventSkill,
  warriorTargetControlled
} from '#gw2/content/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';

// Apply Thick Skin before any other cast-start trait logic.
export function applyThickSkinCastStart(context: WarriorCastContext, skill: WarriorSkill): void {
  if (skill.type !== 'Heal' || !hasTrait(context, TRAIT.THICK_SKIN)) return;
  emitSkillBuff(context, {
    at: context.start,
    source: 'Trait',
    sourceId: TRAIT.THICK_SKIN,
    actorType: 'effect',
    skillId: skill.id,
    skillName: skill.name,
    name: 'Thick Skin',
    kind: 'protection',
    boon: 'protection',
    stacks: 1,
    duration: gw2SchedulerBoonDuration(context, skill, 'protection', 3)
  });
}

// Grant Merciless Hammer adrenaline after target-control state is updated.
export function applyMercilessHammer(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== 'player' || !hasTrait(context, TRAIT.MERCILESS_HAMMER)) return;
  gainWarriorAdrenaline(
    context,
    Number(balanceProfileFromContext(context, PROFILE.mercilessHammer)?.resourceGain || 7)
  );
}

// Grant Stalwart Strength stability once per internal-cooldown window.
export function applyStalwartStrength(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.type !== 'control' || event.actorType !== 'player' || !hasTrait(context, TRAIT.STALWART_STRENGTH)) return;
  const state = professionCoreState(context);
  if (!isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.stalwartStrength || 0))) return;
  const profile = balanceProfileFromContext(context, PROFILE.stalwartStrength);
  const stability = balanceProfileEffect(profile, 'boon');
  state.traitProcReadyAt.stalwartStrength = event.at + Number(profile?.internalCooldown || 0.25);
  emitSkillBuff(context, {
    skill:
      context.catalog.skillsById.get(event.skillId ?? '') ||
      ({ id: TRAIT.STALWART_STRENGTH, name: 'Stalwart Strength' } as WarriorSkill),
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.STALWART_STRENGTH,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Stalwart Strength',
    kind: 'stability',
    boon: 'stability',
    duration: Number(stability?.duration || 5),
    stacks: Number(stability?.stacks || 1),
    audience: { recipients: 'self' as const }
  });
}

// Apply Cull the Weak only once per burst activation and ICD window.
export function applyCullTheWeak(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.CULL_THE_WEAK) ||
    !isInternalCooldownReady(event.at, Number(state.traitProcReadyAt.cullTheWeak || 0))
  ) {
    return;
  }

  state.traitProcReadyAt.cullTheWeak = event.at + 5;
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.CULL_THE_WEAK,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Cull the Weak — Weakness',
    condition: 'Weakness',
    stacks: 1,
    duration: 3.5
  });
}

export const warriorDefenseModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.cull-the-weak',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.CULL_THE_WEAK) && targetConditionActive(context, 'Weakness')
  },
  {
    id: 'warrior.merciless-hammer',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.MERCILESS_HAMMER) &&
      ['Hammer', 'Mace'].includes(
        String(
          context.event?.skillWeapon ||
            warriorEventSkill(context)?.skillWeapon ||
            warriorEventSkill(context)?.weapon ||
            ''
        )
      ) &&
      warriorTargetControlled(context)
  },
  {
    id: 'warrior.stalwart-strength',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.STALWART_STRENGTH) && warriorBoonActive(context, 'stability')
  }
]);
