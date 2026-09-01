/**
 * Public Core Warrior trait dispatcher.
 *
 * Trait-line modules own individual effects; this module keeps base mechanics,
 * task handlers, and the cross-line ordering contracts used by every caller.
 */
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import type { ScheduledTask } from '#gw2/platform/engine/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/content/professions/warrior/data/ids.js';
import { gainWarriorEndurance } from '#gw2/content/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import { gainWarriorAdrenaline, warriorGainsAdrenalineOnHit } from '#gw2/content/professions/warrior/resources.js';
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSimulationEvent,
  WarriorSkill
} from '#gw2/content/professions/warrior/types.js';
import {
  applyBloodlust,
  applyBurstPrecision,
  applyFurious,
  applyFuriousBurst,
  applyOpportunist,
  applySignetMasteryCastComplete,
  applySunderingBurst,
  armBurstPrecision,
  modifyWarriorArmsAttributes,
  reactToWarriorDamage,
  warriorArmsModifierRules,
  warriorArmsCriticalCount
} from '#gw2/content/professions/warrior/core/traits/arms.js';
import {
  applyAggressiveOnslaught,
  applyBodyBlow,
  applyBraveStrideCastComplete,
  applyBuildingMomentum,
  applyPeakPerformanceCastStart,
  applyRecklessDodge,
  BRAVE_STRIDE_MOVEMENT_SKILL_IDS,
  grantBerserkersPower,
  grantBerserkersPowerOnFirstHit,
  modifyWarriorStrengthAttributes,
  reactToWarriorBuff,
  warriorStrengthModifierRules
} from '#gw2/content/professions/warrior/core/traits/strength.js';
import {
  advanceEmpowerAllies,
  applyLegSpecialist,
  applyMarchingOrders,
  applyMartialCadence,
  applyMartialCadenceWeaponSwap,
  applyPhalanxStrength,
  applySoldiersComfort,
  modifyWarriorTacticsAttributes,
  warriorTacticsModifierRules
} from '#gw2/content/professions/warrior/core/traits/tactics.js';
import {
  applyCullTheWeak,
  applyMercilessHammer,
  applyStalwartStrength,
  applyThickSkinCastStart,
  warriorDefenseModifierRules
} from '#gw2/content/professions/warrior/core/traits/defense.js';
import {
  applyBurstMastery,
  applyVersatileRage,
  warriorDisciplineModifierRules
} from '#gw2/content/professions/warrior/core/traits/discipline.js';

export {
  applyMartialCadenceWeaponSwap,
  applyRecklessDodge,
  armBurstPrecision,
  BRAVE_STRIDE_MOVEMENT_SKILL_IDS,
  grantBerserkersPower,
  grantBerserkersPowerOnFirstHit,
  modifyWarriorArmsAttributes,
  modifyWarriorStrengthAttributes,
  modifyWarriorTacticsAttributes,
  reactToWarriorBuff,
  reactToWarriorDamage,
  warriorArmsModifierRules,
  warriorDefenseModifierRules,
  warriorDisciplineModifierRules,
  warriorStrengthModifierRules,
  warriorTacticsModifierRules
};

// Arm Burst Precision before applying Burst Mastery's refund and Swiftness.
export function applyWarriorBurstSpendTraits(
  context: WarriorCastContext,
  skill: WarriorSkill,
  adrenalineSpent: number,
  options: {
    readonly resourceSpent?: number;
    readonly resourceRefundRate?: number;
  } = {}
): void {
  armBurstPrecision(context, skill, adrenalineSpent);
  applyBurstMastery(context, skill, adrenalineSpent, options);
}

// Restore ammo without erasing an active cast lockout or exposing a zero-charge skill early.
function restoreAmmo(context: WarriorSchedulerContext, skill: WarriorSkill, count: number, at: number): number {
  const ammo = context.cooldownController.refreshAmmo(skill, at);
  if (!ammo) return 0;
  const missing = Math.max(0, ammo.maximum - ammo.charges);
  const restored = Math.min(missing, Math.max(0, count));
  if (!restored) return 0;

  const mirroredRecharge = ammo.nextRechargeAt;
  const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
  const lastAction = [...context.events]
    .reverse()
    .find((event) => event.type === 'action' && event.skillId === skill.id);
  const lastActionEnd = Number(lastAction?.endsAt || 0);
  const lockoutReadyAt =
    lastActionEnd +
    context.rechargeDurationFor(skill, lastActionEnd, {
      ammoCastLockout: true
    });
  if (ammo.charges === 0 && mirroredRecharge != null && readyAt <= mirroredRecharge + context.epsilon) {
    context.state.cooldowns.delete(skill.id);
  }

  ammo.charges += restored;
  if (ammo.charges >= ammo.maximum) ammo.nextRechargeAt = null;
  context.cooldownController.refreshAmmo(skill, at);
  if (lockoutReadyAt > at + context.epsilon) context.state.cooldowns.set(skill.id, lockoutReadyAt);
  return restored;
}

// Preserve cast completion order: Signet Mastery, Peitha, then Brave Stride.
export function completeWarriorSkill(context: WarriorCastContext, skill: WarriorSkill): void {
  applySignetMasteryCastComplete(context, skill);
  if (skill.shadowstepSkill && context.config.relic === 'Peitha') {
    context.emit({
      type: 'peitha',
      at: context.effectiveEnd,
      source: 'Warrior',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Relic of Peitha'
    });
  }

  applyBraveStrideCastComplete(context, skill);
}

/** Runs Core Warrior mechanics owned by one completed skill activation. */
export const warriorCoreSkillMechanicHandlers = Object.freeze({
  'warrior.core.reload-rifle': ({ context, at }: { context: WarriorSchedulerContext; at: number }): void => {
    // Rifle Butt restores one count to other rifle ammo skills and readies every rifle burst.
    for (const skill of context.catalog.skills) {
      if (skill.weapon === 'Rifle' && skill.ammo) restoreAmmo(context, skill, 1, at);
      if (skill.id === ID.KILL_SHOT || skill.id === ID.GUN_FLAME) context.state.cooldowns.delete(skill.id);
    }
  },
  'warrior.core.reset-crushing-blow': ({ context }: { context: WarriorSchedulerContext }): void => {
    context.state.cooldowns.delete(ID.CRUSHING_BLOW);
  },
  'warrior.core.reset-fierce-blow': ({ context }: { context: WarriorSchedulerContext }): void => {
    context.state.cooldowns.delete(ID.FIERCE_BLOW);
  },
  'warrior.core.restore-endurance': ({
    context,
    trigger,
    at
  }: {
    context: WarriorSchedulerContext;
    trigger: { readonly count?: number };
    at: number;
  }): void => {
    gainWarriorEndurance(context, trigger.count ?? 100, at);
  },
  'warrior.core.restore-dragons-roar-ammo': ({
    context,
    trigger,
    at
  }: {
    context: WarriorSchedulerContext;
    trigger: { readonly count?: number };
    at: number;
  }): void => {
    const skill = context.catalog.skillsById.get(ID.DRAGONS_ROAR) as WarriorSkill | undefined;
    if (skill) restoreAmmo(context, skill, trigger.count ?? 3, at);
  }
});

// Preserve cast-start order: Thick Skin, then Peak Performance.
export function beginWarriorSkill(context: WarriorCastContext, skill: WarriorSkill): void {
  applyThickSkinCastStart(context, skill);
  applyPeakPerformanceCastStart(context, skill);
}

// Keep Keen Strike's base critical Might ahead of all Arms trait reactions.
function applyKeenStrikeCriticalMight(
  context: WarriorSchedulerContext,
  event: WarriorSimulationEvent,
  criticals: number
): void {
  if (criticals <= 0 || event.skillId !== ID.KEEN_STRIKE) return;
  emitSkillBuff(context, {
    skill:
      context.catalog.skillsById.get(event.skillId ?? '') ||
      ({ id: ID.KEEN_STRIKE, name: 'Keen Strike — Critical Might' } as WarriorSkill),
    cause: event,
    at: event.at,
    source: 'Trait',
    sourceId: ID.KEEN_STRIKE,
    actorType: 'effect',
    skillId: event.skillId,
    skillName: event.skillName,
    name: 'Keen Strike — Critical Might',
    kind: 'might',
    boon: 'might',
    duration: 5,
    stacks: 1,
    recipients: 'self'
  });
}

// Request critical facts before any line-specific runtime logic can schedule work.
export function initializeWarriorTraits(context: WarriorSchedulerContext): void {
  const weapons = [...gw2ConfiguredWeaponSet(context.config, 1), ...gw2ConfiguredWeaponSet(context.config, 2)].map(
    String
  );
  if (
    weapons.includes('Dagger') ||
    hasTrait(context, TRAIT.BLOODLUST) ||
    hasTrait(context, TRAIT.FURIOUS) ||
    hasTrait(context, TRAIT.SUNDERING_BURST)
  ) {
    (
      context.schedulerPolicy as unknown as {
        requireCriticalFacts?: () => void;
      }
    ).requireCriticalFacts?.();
  }
}

// Materialize Keen Strike, Bloodlust, Furious, then Sundering Burst at priority -40.
export function handleWarriorArmsCriticalTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as {
    readonly eventOrder?: number;
    readonly firstBurstHit?: boolean;
  } | null;
  const event = context.eventByOrder(Number(payload?.eventOrder)) as WarriorSimulationEvent | undefined;
  if (!event) return;
  const criticals = warriorArmsCriticalCount(context, event);
  applyKeenStrikeCriticalMight(context, event, criticals);
  applyBloodlust(context, event);
  applyFurious(context, event, criticals);
  applySunderingBurst(context, event, Boolean(payload?.firstBurstHit), criticals);
}

// Route canonical events through the preserved cross-line and base-mechanic sequence.
export function observeWarriorEvent(context: WarriorSchedulerContext, event: WarriorSimulationEvent): void {
  const state = professionCoreState(context);
  if (event.type === 'combat_start') state.signetOfRageNextAt = event.at + 3;

  applyOpportunist(context, event);

  if (event.type === 'control' && event.actorType === 'player') {
    state.targetControlledUntil = Math.max(state.targetControlledUntil, event.at + Number(event.duration || 1));
  }

  applyMercilessHammer(context, event);
  applyStalwartStrength(context, event);
  applyBodyBlow(context, event);
  applyAggressiveOnslaught(context, event);
  applyLegSpecialist(context, event);
  applyPhalanxStrength(context, event);

  if (
    event.type === 'damage' &&
    (event.actorType === 'player' || event.canTriggerCriticalTraits === true) &&
    Number(event.coefficient) > 0
  ) {
    const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
    if (skill?.burst) {
      const activationKey = String(event.activationId || `${event.skillId}:${event.at}`);
      if (!state.burstHitActivations[activationKey]) {
        state.burstHitActivations[activationKey] = true;
        applyCullTheWeak(context, event);
        applyBurstPrecision(context, event, skill, activationKey);
        applyBuildingMomentum(context, event);
        if (applyMarchingOrders(context, event)) {
          applySoldiersComfort(context, event);
          applyMartialCadence(context, event);
        }
      }
    }

    const armsActivationKey = String(event.activationId || `${event.skillId}:${event.at}`);
    const armsBurstKey = `arms:${armsActivationKey}`;
    const firstBurstHit = Boolean(skill?.burst) && !state.burstHitActivations[armsBurstKey];
    if (firstBurstHit) state.burstHitActivations[armsBurstKey] = true;
    const tracksArmsCritical =
      event.skillId === ID.KEEN_STRIKE ||
      hasTrait(context, TRAIT.BLOODLUST) ||
      hasTrait(context, TRAIT.FURIOUS) ||
      (firstBurstHit && hasTrait(context, TRAIT.SUNDERING_BURST));
    if (tracksArmsCritical) {
      context.tasks.schedule({
        type: 'warrior.arms-critical',
        at: Math.max(context.state.time, event.at),
        priority: -40,
        payload: {
          eventOrder: Number(event.eventOrder),
          firstBurstHit
        }
      });
    }
  }

  if (
    !warriorGainsAdrenalineOnHit(context) ||
    event.type !== 'damage' ||
    (event.actorType !== 'player' && event.source !== 'Sigil') ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }

  context.tasks.schedule({
    type: 'warrior.adrenaline-hit',
    at: event.at,
    payload: { amount: Math.max(1, Number(event.hits || 1)) }
  });
}

// Advance the base Signet of Rage pulse before Tactics' Empower Allies pulse.
export function advanceWarriorTraits(context: WarriorSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const selected = selectedSkillNameSet(context.config.selectedSkills);
  if (selected.has('Signet of Rage')) {
    while (state.signetOfRageNextAt > 0 && state.signetOfRageNextAt <= target + context.epsilon) {
      const at = state.signetOfRageNextAt;
      const cooldownReadyAt = Number(context.state.cooldowns.get(ID.SIGNET_OF_RAGE) || 0);
      if (cooldownReadyAt <= at + context.epsilon) gainWarriorAdrenaline(context, 2);
      state.signetOfRageNextAt += 3;
    }
  }

  advanceEmpowerAllies(context, target);
}

/** Applies Martial Cadence, Versatile Rage, then Furious Burst on weapon swap. */
export function applyWarriorWeaponSwapTraits(context: WarriorCastContext, skill: WarriorSkill): void {
  applyMartialCadenceWeaponSwap(context, context.effectiveEnd);
  applyVersatileRage(context);
  applyFuriousBurst(context, skill);
}
