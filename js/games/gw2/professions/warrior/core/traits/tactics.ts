import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
/** Owns imperative Tactics trait effects while the public dispatcher preserves cross-line ordering. */

import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import {
  warriorActiveBoonCount,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/professions/warrior/types.js';

export function applyMartialCadenceWeaponSwap(context: WarriorCastContext, at: number): void {
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) professionCoreState(context).soldierFocusReadyAt = at;
}

// Convert Crippled into Immobilized after the ordered control reactions.
export function applyLegSpecialist(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.type !== 'condition' || event.condition !== 'Crippled' || !hasTrait(context, TRAIT.LEG_SPECIALIST)) return;
  const legSpecialistProfile = requireBalanceProfileFromContext(context, PROFILE.legSpecialist);
  const effect = requireEffect(legSpecialistProfile, 'condition', 'Immobilized');
  if (effect)
    emitSkillCondition(context, {
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.LEG_SPECIALIST,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Leg Specialist — Immobilized',
      condition: 'Immobilized',
      stacks: effectNumber(legSpecialistProfile, effect, 'stacks'),
      duration: effectNumber(legSpecialistProfile, effect, 'duration')
    });
}

// Start Soldier's Focus and emit its base Might packet on the first eligible burst hit.
export function applyMarchingOrders(context: WarriorSchedulerContext, event: WarriorSimulationEvent): boolean {
  const state = professionCoreState(context);
  if (!hasTrait(context, TRAIT.MARCHING_ORDERS) || !isInternalCooldownReady(event.at, state.soldierFocusReadyAt)) {
    return false;
  }

  const marchingOrdersProfile = requireBalanceProfileFromContext(context, PROFILE.marchingOrders);
  const might = requireEffect(marchingOrdersProfile, 'boon', 'might');
  state.soldierFocusReadyAt = event.at + balanceProfileNumber(marchingOrdersProfile, 'internalCooldown');
  if (might)
    emitSkillBuff(context, {
      skill:
        context.catalog.skillsById.get(event.skillId ?? '') ||
        ({ id: TRAIT.MARCHING_ORDERS, name: "Soldier's Focus — Might" } as WarriorSkill),
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MARCHING_ORDERS,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Soldier's Focus — Might",
      kind: 'might',
      boon: 'might',
      duration: effectNumber(marchingOrdersProfile, might, 'duration'),
      stacks: effectNumber(marchingOrdersProfile, might, 'stacks'),
      audience: { recipients: 'party' as const }
    });
  return true;
}

export function applySoldiersComfort(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.SOLDIERS_COMFORT)) return;
  const soldiersComfortProfile = requireBalanceProfileFromContext(context, PROFILE.soldiersComfort);
  const protection = requireEffect(soldiersComfortProfile, 'boon', 'protection');
  if (protection)
    emitSkillBuff(context, {
      skill:
        context.catalog.skillsById.get(event.skillId ?? '') ||
        ({ id: TRAIT.SOLDIERS_COMFORT, name: "Soldier's Comfort" } as WarriorSkill),
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.SOLDIERS_COMFORT,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Soldier's Comfort",
      kind: 'protection',
      boon: 'protection',
      duration: effectNumber(soldiersComfortProfile, protection, 'duration'),
      stacks: effectNumber(soldiersComfortProfile, protection, 'stacks'),
      audience: { recipients: 'party' as const }
    });
}

export function applyMartialCadence(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.MARTIAL_CADENCE)) return;
  const martialCadenceProfile = requireBalanceProfileFromContext(context, PROFILE.martialCadence);
  const stability = requireEffect(martialCadenceProfile, 'boon', 'stability');
  if (stability)
    emitSkillBuff(context, {
      skill:
        context.catalog.skillsById.get(event.skillId ?? '') ||
        ({ id: TRAIT.MARTIAL_CADENCE, name: 'Martial Cadence' } as WarriorSkill),
      cause: event,
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.MARTIAL_CADENCE,
      actorType: 'effect',
      skillId: event.skillId,
      skillName: event.skillName,
      name: 'Martial Cadence',
      kind: 'stability',
      boon: 'stability',
      duration: effectNumber(martialCadenceProfile, stability, 'duration'),
      stacks: effectNumber(martialCadenceProfile, stability, 'stacks'),
      audience: { recipients: 'party' as const }
    });
}

// Keep party Might on its authored cadence, after same-time Signet of Rage gains.
export function initializeEmpowerAllies(context: WarriorSchedulerContext): void {
  if (
    hasTrait(context, TRAIT.EMPOWER_ALLIES) &&
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.empowerAllies), 'pulseInterval') > 0
  )
    empowerAllies.start(context, { at: 0, captured: {} });
}

export const empowerAllies = timedEffect<WarriorSchedulerContext, object>({
  id: 'warrior.empower-allies',
  priority: -210,
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.empowerAllies), 'pulseInterval'),
  effectsAt(context, at) {
    if (!hasTrait(context, TRAIT.EMPOWER_ALLIES)) return false;
    const empowerAlliesProfile = requireBalanceProfileFromContext(context, PROFILE.empowerAllies);
    const might = requireEffect(empowerAlliesProfile, 'boon', 'might');
    if (!might) return false;
    const sourceSkill = { id: TRAIT.EMPOWER_ALLIES, name: 'Empower Allies' } as WarriorSkill;
    if (might)
      emitSkillBuff(context, {
        at,
        source: 'Trait',
        sourceId: TRAIT.EMPOWER_ALLIES,
        actorType: 'effect',
        name: 'Empower Allies',
        kind: 'might',
        boon: 'might',
        stacks: effectNumber(empowerAlliesProfile, might, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          sourceSkill,
          'might',
          effectNumber(empowerAlliesProfile, might, 'duration')
        ),
        audience: { recipients: 'party' as const }
      });
  }
});

// Resolve Tactics-owned attributes without hiding their formulas in the cross-line composer.
export function modifyWarriorTacticsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  if (hasTrait(context, TRAIT.ROARING_REVEILLE) && !staticRulesApplied) {
    const roaringReveilleProfile = requireBalanceProfileFromContext(context, PROFILE.roaringReveille);
    result.concentration += balanceProfileNumber(roaringReveilleProfile, 'attributeBonus');
  }
}

export const warriorTacticsModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.empowered',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { damagePerBoon: 0.01 } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => 1 + warriorActiveBoonCount(context) * parameters.damagePerBoon,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.EMPOWERED)
  },
  {
    id: 'warrior.leg-specialist',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.LEG_SPECIALIST) &&
      ['Crippled', 'Chilled', 'Immobilized'].some((condition) => targetConditionActive(context, condition))
  },
  {
    id: 'warrior.warriors-cunning',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.WARRIORS_CUNNING) && targetHealthFraction(context) > 0.8
  }
]);
