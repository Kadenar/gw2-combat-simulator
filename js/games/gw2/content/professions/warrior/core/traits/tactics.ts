/** Owns imperative Tactics trait effects while the public dispatcher preserves cross-line ordering. */
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/warrior/core/profiles.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';

export function applyMartialCadenceWeaponSwap(context: WarriorCastContext, at: number): void {
  if (hasTrait(context, TRAIT.MARTIAL_CADENCE)) professionCoreState(context).soldierFocusReadyAt = at;
}

// Convert Crippled into Immobilized after the ordered control reactions.
export function applyLegSpecialist(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (event.type !== 'condition' || event.condition !== 'Crippled' || !hasTrait(context, TRAIT.LEG_SPECIALIST)) return;
  const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.legSpecialist), 'condition');
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
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 1)
  });
}

// Mirror self Might to allies without recursively consuming the mirrored packet.
export function applyPhalanxStrength(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (
    event.type !== 'buff' ||
    event.kind !== 'might' ||
    event.affectsSelf === false ||
    event.sourceId === TRAIT.PHALANX_STRENGTH ||
    !hasTrait(context, TRAIT.PHALANX_STRENGTH)
  ) {
    return;
  }

  emitSkillBuff(context, {
    skill:
      context.catalog.skillsById.get(event.skillId ?? '') ||
      ({ id: TRAIT.PHALANX_STRENGTH, name: 'Phalanx Strength' } as WarriorSkill),
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.PHALANX_STRENGTH,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Phalanx Strength',
    kind: 'might',
    boon: 'might',
    duration: 5,
    stacks: 1,
    recipients: 'allies',
    affectsSelf: false
  });
}

// Start Soldier's Focus and emit its base Might packet on the first eligible burst hit.
export function applyMarchingOrders(context: WarriorSchedulerContext, event: WarriorSimulationEvent): boolean {
  const state = professionCoreState(context);
  if (!hasTrait(context, TRAIT.MARCHING_ORDERS) || !isInternalCooldownReady(event.at, state.soldierFocusReadyAt)) {
    return false;
  }

  const marchingOrders = balanceProfileFromContext(context, PROFILE.marchingOrders);
  const might = balanceProfileEffect(marchingOrders, 'boon');
  state.soldierFocusReadyAt = event.at + Number(marchingOrders?.internalCooldown || 10);
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
    duration: Number(might?.duration || 15),
    stacks: Number(might?.stacks || 3),
    recipients: 'party'
  });
  return true;
}

export function applySoldiersComfort(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.SOLDIERS_COMFORT)) return;
  const protection = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.soldiersComfort), 'boon');
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
    duration: Number(protection?.duration || 4),
    stacks: Number(protection?.stacks || 1),
    recipients: 'party'
  });
}

export function applyMartialCadence(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  if (!hasTrait(context, TRAIT.MARTIAL_CADENCE)) return;
  const stability = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.martialCadence), 'boon');
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
    duration: Number(stability?.duration || 3),
    stacks: Number(stability?.stacks || 1),
    recipients: 'party'
  });
}

// Pulse Empower Allies after base Signet of Rage advancement has completed.
export function advanceEmpowerAllies(context: WarriorSchedulerContext, target: number): void {
  if (!hasTrait(context, TRAIT.EMPOWER_ALLIES)) return;
  const state = professionCoreState(context);
  const empowerAllies = balanceProfileFromContext(context, PROFILE.empowerAllies);
  const might = balanceProfileEffect(empowerAllies, 'boon');
  const sourceSkill = { id: TRAIT.EMPOWER_ALLIES, name: 'Empower Allies' } as WarriorSkill;
  const interval = Number(empowerAllies?.pulseInterval || 10);
  while (state.empowerAlliesNextAt <= target + context.epsilon) {
    const at = state.empowerAlliesNextAt;
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.EMPOWER_ALLIES,
      actorType: 'effect',
      name: 'Empower Allies',
      kind: 'might',
      boon: 'might',
      stacks: Number(might?.stacks || 5),
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'might', Number(might?.duration || 10)),
      recipients: 'party'
    });
    state.empowerAlliesNextAt += interval;
  }
}
