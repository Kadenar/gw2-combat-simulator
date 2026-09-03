import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { targetConditionStacks as configuredTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { requiredShroud } from '#gw2/professions/necromancer/core/mechanics/availability.js';
import { gainNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  cloneNecromancerAttributes,
  necromancerActiveShroud,
  necromancerEventSkill,
  necromancerTargetChilled
} from '#gw2/professions/necromancer/core/traits/modifiers.js';
import { ensurePermanentIceFieldAssumption } from '#gw2/professions/necromancer/specializations/reaper/mechanics/combos.js';

import { REAPER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type {
  NecromancerCastContext,
  NecromancerCastModifierContext,
  NecromancerSchedulerContext,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import { reaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';

/** Reduces every active Reaper Shroud cooldown when Reaper's Onslaught sees Life Reap land. */
function reduceShroudCooldowns(context: NecromancerSchedulerContext, at: number): void {
  const reduction = Number(balanceProfileFromContext(context, PROFILE.reapersOnslaught)?.rechargeReduction || 1);
  for (const candidate of context.catalog.skills || []) {
    if (candidate.shroud !== 'reaper') continue;
    const readyAt = Number(context.state.cooldowns.get(candidate.id) || 0);
    if (!(readyAt > at + context.epsilon)) continue;
    const reduced = Math.max(at, readyAt - reduction);
    // Delete rather than set to 0 so the cooldown map stays clean and future lookups default correctly.
    if (reduced <= at + context.epsilon) {
      context.state.cooldowns.delete(candidate.id);
    } else {
      context.state.cooldowns.set(candidate.id, reduced);
    }
  }
}

/** Applies Reaper's Onslaught, shout, and completion-gated Chilling Victory cast effects. */
function afterCast(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (skill.id === ID.LIFE_REAP && hasTrait(context, TRAIT.REAPERS_ONSLAUGHT)) {
    // The hit lands at cast midpoint; skip reduction if the cast was cancelled before reaching that point.
    const hitAt = context.start + (context.fullEnd - context.start) / 2;
    if (context.effectiveEnd >= hitAt - context.epsilon) {
      reduceShroudCooldowns(context, hitAt);
    }
  }

  if (skill.categories?.includes('Shout') && hasTrait(context, TRAIT.AUGURY_OF_DEATH)) {
    const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.auguryOfDeath), 'strike');
    emitSkillDamage(context, skill, {
      at: context.effectiveEnd,
      name: 'Augury of Death',
      source: 'Trait',
      sourceId: TRAIT.AUGURY_OF_DEATH,
      actorType: 'effect',
      coefficient: 0,
      skillWeapon: 'Unequipped',
      flatStrikeBase: Number(effect?.flatStrikeBase || 276),
      flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff || 0.02),
      noCrit: true,
      damageKind: 'life-steal'
    });
  }

  // Chilling Victory only procs on full completion; interrupted casts don't generate life force.
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const state = reaperState.from(context);
  if (
    hasTrait(context, TRAIT.CHILLING_VICTORY) &&
    requiredShroud(skill) === 'reaper' &&
    isInternalCooldownReady(context.effectiveEnd, Number(state.chillingVictoryReadyAt || 0)) &&
    // Configured Chilled on target stands in for "target is chilled" since scheduler has no live condition state.
    context.config?.target?.conditions?.Chilled
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.chillingVictory);
    gainNecromancerLifeForce(context, Number(profile?.lifeForceGain || 1), context.effectiveEnd, 'chilling-victory');
    state.chillingVictoryReadyAt = context.effectiveEnd + Number(profile?.cooldown || 1);
  }
}

/** Seeds assumed combo fields and applies Blighter's Boon life force to scheduled player boons. */
function onEventScheduled(context: NecromancerSchedulerContext, event: NecromancerSimulationEvent): void {
  ensurePermanentIceFieldAssumption(context, event);
  if (event.type === 'buff' && event.actorType === 'player' && hasTrait(context, TRAIT.BLIGHTERS_BOON)) {
    gainNecromancerLifeForce(
      context,
      Number(balanceProfileFromContext(context, PROFILE.blightersBoon)?.lifeForceGain || 1),
      event.at,
      'blighters-boon'
    );
  }
}

export const reaperSchedulerHooks = Object.freeze({
  afterCast,
  onEventScheduled
});

/** Applies Reaper's Onslaught ferocity while Reaper Shroud is active. */
function modifyReaperAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const result = cloneNecromancerAttributes(attributes);
  if (hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) && necromancerActiveShroud(context) === 'reaper') {
    result.ferocity += Number(balanceProfileFromContext(context, PROFILE.reapersOnslaught)?.attributeBonus || 300);
  }

  return result;
}

/** Applies Reaper's Onslaught attack speed without exceeding the shared Quickness cap. */
function modifyReaperCastDuration(context: NecromancerCastModifierContext, duration: number): number {
  // Reaper's Onslaught grants +50% attack speed in Reaper Shroud, but quickness already covers that cap so they don't stack.
  return hasTrait(context, TRAIT.REAPERS_ONSLAUGHT) &&
    professionCoreState(context).activeShroud === 'reaper' &&
    !context.hasBuff?.('quickness', context.start)
    ? duration / Number(balanceProfileFromContext(context, PROFILE.reapersOnslaught)?.quicknessCastMultiplier || 1.5)
    : duration;
}

export const reaperModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    // Reaper Shouts deal double damage to nearby targets (the sole target is assumed nearby unless explicitly set false).
    id: 'necromancer.reaper-shout-melee',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    // order: 100 places this after additive damage buckets so it multiplies the already-summed base.
    order: 100,
    when: (context) =>
      Boolean(
        // Shout doubling belongs to the player's skill packet, not merely an effect that inherits player modifiers.
        isGw2PlayerActorEvent(context.event) &&
        necromancerEventSkill(context)?.categories?.includes('Shout') &&
        context.config?.target?.nearby !== false
      )
  },
  {
    id: 'necromancer.decimate-defenses',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    // Each stack of Vulnerability adds 2% crit chance, capped at 25 stacks (50% max bonus).
    // Falls back to configured static stacks when a live query runtime isn't available.
    parameters: { maximumStacks: 25, criticalChancePerStack: 0.02 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      Math.min(
        parameters.maximumStacks,
        Number(
          context.query?.targetConditionStacks
            ? context.query.targetConditionStacks('Vulnerability', context.time, context.runtime)
            : configuredTargetConditionStacks(context.config || {}, 'Vulnerability', context.time, context.runtime)
        )
      ) * parameters.criticalChancePerStack,
    when: (context) => hasTrait(context, TRAIT.DECIMATE_DEFENSES)
  },
  {
    id: 'necromancer.cold-shoulder',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.COLD_SHOULDER) && necromancerTargetChilled(context)
  },
  {
    id: 'necromancer.soul-eater',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.SOUL_EATER) && context.config?.target?.nearby !== false
  }
]);

export const reaperAttributeRules = Object.freeze({
  modifyAttributes: modifyReaperAttributes,
  modifierRules: reaperModifierRules
});

export const reaperCastRules = Object.freeze({
  modifyCastDuration: modifyReaperCastDuration
});
