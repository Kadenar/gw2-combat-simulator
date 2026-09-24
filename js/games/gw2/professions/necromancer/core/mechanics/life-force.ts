import { grantResource, refreshResource, type ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { resourceDepletion } from '#gw2/platform/profession-definition/mechanics.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { consumeSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitTransitionLockout } from '#gw2/platform/skills/transition-delays.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot, emitNecromancerLifeForce } from '#gw2/professions/necromancer/family-state.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
/** Life Force tuning, passive eligibility, and form exit consequences. */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import {
  gainNecromancerLifeForce,
  purgeTimedState
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { runNecromancerShroudExit } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

import { observeTargetConditionCount } from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';
import { castWasInterrupted, gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';

// Start the entry skill's post-exit recharge in base units so later Alacrity changes affect it.
function setShroudRecharge(
  context: NecromancerSchedulerContext,
  entryId: SkillId | null | undefined,
  at: number
): void {
  if (entryId != null) {
    // Precombat shroud toggles prepare traits without imposing an artificial wait before the opener.
    if (context.hasExplicitCombatStart && (context.combatStartTime == null || at < context.combatStartTime)) {
      context.cooldownController.clear(entryId);
      return;
    }

    const skill = context.catalog.skillsById.get(entryId);
    if (skill) context.cooldownController.startRecharge(skill, at, 10);
  }
}

/** Exits the active life-force shroud, starts its recharge, and emits exit effects and state. */
export function leaveShroud(context: NecromancerSchedulerContext, at: number, reason = 'shroud-exit'): void {
  const state = professionCoreState(context);
  const shroud = state.activeShroud;
  if (!shroud || shroud === 'lich') return;
  emitTransitionLockout(context, 'shroudExitMs', at);
  // Clear transform and flip state before callbacks observe the exit.
  const entryId = state.activeShroudEntryId;
  const exitId = state.activeShroudExitId;
  state.activeShroud = '';
  state.activeShroudEntryId = null;
  state.activeShroudExitId = null;
  state.activeShroudProfileId = '';
  if (exitId != null) {
    consumeSkillFlip(state.availableFlips, exitId);
  }

  // Specialization callbacks run before shared exit traits and the visible weapon transition.
  runNecromancerShroudExit(context);
  refreshResource(context, 'lifeForce', true, at);
  context.cooldownController.clear(ID.ISOLATE);
  setShroudRecharge(context, entryId, at);
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.SOUL_BARBS,
      actorType: 'player',
      kind: 'necromancer-soul-barbs',
      duration: balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SOUL_BARBS), 'duration'),
      stacks: 1
    });
  }

  context.emit({
    type: 'weapon_set',
    at,
    source: 'necromancer',
    sourceId: `necromancer.${reason}`,
    actorType: 'player',
    weaponSet: context.state.activeWeaponSet,
    shroudSwap: true
  });
  emitNecromancerStateSnapshot(context, at, reason, {
    dedupeAcrossSourceIds: true
  });
}

function activeSignetOfUndeath(context: NecromancerSchedulerContext): boolean {
  return selectedSkillNameSet(context.config.selectedSkills).has('Signet of Undeath');
}

function activeSignetOfVampirism(context: NecromancerSchedulerContext): boolean {
  return selectedSkillNameSet(context.config.selectedSkills).has('Signet of Vampirism');
}

interface AlliedOpportunity {
  type: string;
  sourceId: SkillId;
  interval: number;
}

// Each trait has an independent cadence; the resolver still owns per-ally siphon eligibility and damage.
export const alliedAttackOpportunities = timedEffect<NecromancerSchedulerContext, AlliedOpportunity>({
  id: 'necromancer.allied-attack-opportunity',
  priority: -200,
  nextAt: (_context, at, captured) => at + captured.interval,
  effectsAt(context, at, { type, sourceId }) {
    const allies = gw2AlliedPlayerAssumptions(context.config);
    if (!hasTrait(context, sourceId) || !allies.count || !allies.strikesPerSecond) return false;
    for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
      context.emit({
        type,
        at,
        source: 'Trait',
        sourceId,
        actorType: 'effect',
        skillName: `Allied Player ${allyIndex} Attack`,
        allyIndex
      });
    }
  }
});

export function startAlliedAttackOpportunities(context: NecromancerSchedulerContext, at: number): void {
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!allies.count || !allies.strikesPerSecond) return;
  for (const [type, sourceId, minimumInterval] of [
    [
      'necromancer.vampiric-presence-allied-hit',
      TRAIT.VAMPIRIC_PRESENCE,
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.vampiricPresence), 'cooldown')
    ],
    ['necromancer.taste-for-blood-allied-hit', TRAIT.OVERFLOWING_THIRST, 0]
  ] as const) {
    if (!hasTrait(context, sourceId)) continue;
    const interval = Math.max(minimumInterval, 1 / allies.strikesPerSecond);
    alliedAttackOpportunities.start(context, { key: type, at: at + interval, captured: { type, sourceId, interval } });
  }
}

/** Shared depletion ends the current shroud before simultaneous passive pulses can refill it. */
export const lifeForceDepletion = resourceDepletion({
  id: 'necromancer.life-force-depleted',
  priority: -300,
  clock: (context: NecromancerSchedulerContext) => professionCoreState(context).lifeForce,
  depleted: (context: NecromancerSchedulerContext, at: number) => leaveShroud(context, at, 'life-force-depleted')
});

/** Core owns percentage tuning and form eligibility; the engine owns the active drain segment. */
export const necromancerLifeForce: ResourcePolicy<NecromancerSchedulerContext> = {
  kind: 'continuous',
  state: (context) => professionCoreState(context).lifeForce,
  // Capacity bonuses reduce fixed Scourge costs; all resource observations remain percentages.
  maximum: () => 100,
  initial: (context, maximum) => (maximum * Number(context.config.initialResource ?? 100)) / 100,
  recovery(context) {
    const state = professionCoreState(context);
    return state.activeShroud && state.activeShroud !== 'lich'
      ? (-state.lifeForce.maximum *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context, state.activeShroudProfileId || PROFILE.shroud),
            'lifeForceDrain'
          )) /
          100
      : 0;
  },
  depletion: lifeForceDepletion,
  nextChange(context, cost) {
    const state = professionCoreState(context);
    const eternal =
      hasTrait(context, TRAIT.ETERNAL_LIFE) &&
      !state.activeShroud &&
      cost <=
        state.lifeForce.maximum *
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ETERNAL_LIFE), 'threshold')
        ? lifeForcePassives.nextAt(context, 'eternal-life')
        : Infinity;
    const undeath =
      activeSignetOfUndeath(context) &&
      balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.signetOfUndeathPassive), 'lifeForceGain') >
        0
        ? lifeForcePassives.nextAt(context, 'undeath')
        : Infinity;
    // Retry surviving hit reactions without crediting their conditional grants early.
    return Math.min(
      eternal,
      undeath,
      context.tasks.nextAt('necromancer.life-force-hit'),
      context.tasks.nextAt('necromancer.greatsword-life-force'),
      context.tasks.nextAt('necromancer.scourge.nourishing-ashes')
    );
  },
  changed: (context, at) => emitNecromancerLifeForce(context, at, 'life-force')
};

type Passive = 'eternal-life' | 'undeath' | 'vampirism';
/** Passive eligibility is evaluated at each pulse; authored phase survives suppression and capped grants. */
export const lifeForcePassives = timedEffect<
  NecromancerSchedulerContext,
  { passive: Passive; interval: number; deadline: number }
>({
  id: 'necromancer.resource-passive',
  priority: -10,
  nextAt: (_context, _at, captured) => {
    captured.deadline += captured.interval;
    return gw2CooldownReadyAt(captured.deadline);
  },
  effectsAt(context, at, { passive }) {
    const state = professionCoreState(context);
    if (passive === 'eternal-life') {
      if (state.activeShroud) return;
      const profile = requireBalanceProfileFromContext(context, TRAIT.ETERNAL_LIFE);
      const missing = Math.max(
        0,
        state.lifeForce.maximum * balanceProfileNumber(profile, 'threshold') - state.lifeForce.value
      );
      grantResource(
        context,
        'lifeForce',
        Math.min(missing, (state.lifeForce.maximum * balanceProfileNumber(profile, 'lifeForceGain')) / 100)
      );
    } else {
      const id = passive === 'undeath' ? ID.SIGNET_OF_UNDEATH : ID.SIGNET_OF_VAMPIRISM;
      const recharging = Number(context.state.cooldowns.get(id) || 0) > at + EPSILON;
      if (recharging && !(hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING) && state.activeShroud)) return;
      const profile = requireBalanceProfileFromContext(
        context,
        passive === 'undeath' ? PROFILE.signetOfUndeathPassive : PROFILE.signetOfVampirismPassive
      );
      if (passive === 'undeath') gainNecromancerLifeForce(context, balanceProfileNumber(profile, 'lifeForceGain'), at);
      else {
        const strike = requireEffect(profile, 'strike', 'Signet of Vampirism - Passive Life Siphon');
        const skill = context.catalog.skillsById.get(id);
        if (strike && skill)
          emitSkillDamage(context, skill, {
            at,
            name: 'Signet of Vampirism - Passive Life Siphon',
            coefficient: 0,
            skillWeapon: 'Unequipped',
            flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
            flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
            noCrit: strike.noCrit === true,
            damageKind: String(strike.damageKind || '')
          });
      }
    }

    emitNecromancerLifeForce(context, at, passive);
  }
});

/** Start only selected, enabled passive producers; recurrence belongs to the existing timed-effect scheduler. */
export function initializeLifeForcePassives(context: NecromancerSchedulerContext): void {
  for (const [passive, enabled, profileId] of [
    ['eternal-life', hasTrait(context, TRAIT.ETERNAL_LIFE), TRAIT.ETERNAL_LIFE],
    ['undeath', activeSignetOfUndeath(context), PROFILE.signetOfUndeathPassive],
    ['vampirism', activeSignetOfVampirism(context), PROFILE.signetOfVampirismPassive]
  ] as const) {
    if (!enabled) continue;
    const interval = balanceProfileNumber(requireBalanceProfileFromContext(context, profileId), 'pulseInterval');
    if (interval > 0)
      lifeForcePassives.start(context, {
        key: passive,
        at: gw2CooldownReadyAt(interval),
        captured: { passive, interval, deadline: interval }
      });
  }
}

/** Lich expiry is an exact form deadline, independent of resource observations. */
export const lichLifetime = timedEffect<NecromancerSchedulerContext, Record<string, never>>({
  id: 'necromancer.lich-expiry',
  priority: -20,
  effectsAt(context, at) {
    const state = professionCoreState(context);
    if (state.activeShroud !== 'lich' || state.lichEndsAt > at) return;
    state.activeShroud = '';
    state.lichEndsAt = 0;
    consumeSkillFlip(state.availableFlips, ID.EXIT_LICH_FORM);
    refreshResource(context, 'lifeForce');
    gainNecromancerLifeForce(context, 15, at, 'lich-exit');
    // Form expiry changes more than the pool; publish that transition explicitly.
    emitNecromancerStateSnapshot(context, at, 'lich-exit', { dedupeAcrossSourceIds: true });
  }
});

/** Resource advancement is engine-owned; observations publish the pool without leaking planned cast state. */
export function advanceNecromancerState(context: NecromancerSchedulerContext, target: number): void {
  purgeTimedState(professionCoreState(context), target);
  emitNecromancerLifeForce(context, target, 'advance');
}

/** Applies a completed skill's fixed and trait-dependent life-force gains. */
export function scheduleSkillLifeForceGain(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (castWasInterrupted(context)) return;
  let amount = Number(skill.lifeForceGain || 0);
  if (skill.categories?.includes('Mark') && hasTrait(context, TRAIT.SOUL_MARKS)) {
    amount += balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SOUL_MARKS), 'lifeForceGain');
  }

  // Read the same per-condition gain and cap that the selected skill exposes in its tooltip.
  if (Number(skill.lifeForcePerCondition) > 0) {
    const maximum = Number(skill.maximumConditions);
    amount +=
      Math.min(maximum, observeTargetConditionCount(context, context.effectiveEnd, maximum)) *
      Number(skill.lifeForcePerCondition);
  }

  if (amount > 0) {
    gainNecromancerLifeForce(context, amount, context.effectiveEnd, 'skill-life-force');
  }
}

/** Applies completed-cast gains and commits shroud recharge at the scheduler completion boundary. */
export function finalizeNecromancerCast(context: NecromancerCastContext, skill: NecromancerSkill): void {
  if (castWasInterrupted(context)) return;
  const state = professionCoreState(context);
  if (state.pendingShroudEntryId === skill.id) {
    context.cooldownController.setReadyAt(skill.id, Number.POSITIVE_INFINITY);
    delete state.pendingShroudEntryId;
  }

  emitNecromancerStateSnapshot(context, context.effectiveEnd, 'after-cast', { dedupeAcrossSourceIds: true });
}

/** Restores the shared Core resource pool and clears simulated self-conditions after a cooldown reset. */
export function resetNecromancerResources(context: NecromancerSchedulerContext): void {
  const state = professionCoreState(context);
  grantResource(context, 'lifeForce', state.lifeForce.maximum);
  state.selfConditions = [];
  emitNecromancerStateSnapshot(context, context.state.time, 'cooldown-reset', { dedupeAcrossSourceIds: true });
}
