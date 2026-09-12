import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/state.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
/**
 * Life-force resource clock and cast finalization.
 *
 * `advanceNecromancerState` integrates shroud drain and depletion, signet
 * passives, Eternal Life regeneration, and Lich expiry, while delegating elite
 * resource clocks to their owners. `leaveShroud` handles recharge, Soul Barbs,
 * and weapon transitions. `finalizeNecromancerCast` advances the clock and
 * applies skill life-force gains after a cast.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { syncNecromancerResources } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/core/profiles.js';
import {
  gainNecromancerLifeForce,
  purgeTimedState
} from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import {
  runNecromancerResourceAdvance,
  runNecromancerShroudExit
} from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  NecromancerCastContext,
  NecromancerConfig,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

import {
  observeTargetConditionCount,
  type NecromancerSchedulerFeedback
} from '#gw2/professions/necromancer/core/mechanics/scheduler-feedback.js';

// Each scheduler run consumes observed strike gains exactly once, including gains at time zero.
const resourceFeedbackCursors = new WeakMap<object, number>();

function targetBoonCount(config: NecromancerConfig): number {
  if (config.target?.boonless) return 0;
  if (Array.isArray(config.target?.boons)) return config.target.boons.length;
  return Math.max(0, Number(config.target?.boonCount || 1));
}

function alacrityRecharge(context: NecromancerSchedulerContext, duration: number, at: number): number {
  return duration / (context.hasBuff?.('alacrity', at) ? 1.25 : 1);
}

// Start the entry skill's post-exit recharge, applying alacrity at the exit timestamp.
function setShroudRecharge(
  context: NecromancerSchedulerContext,
  entryId: SkillId | null | undefined,
  at: number
): void {
  if (entryId != null) {
    context.state.cooldowns.set(entryId, at + alacrityRecharge(context, 10, at));
  }
}

/** Exits the active life-force shroud, starts its recharge, and emits exit effects and state. */
export function leaveShroud(context: NecromancerSchedulerContext, at: number, reason = 'shroud-exit'): void {
  const state = professionCoreState(context);
  const shroud = state.activeShroud;
  if (!shroud || shroud === 'lich') return;
  // Clear transform and flip state before callbacks observe the exit.
  const entryId = state.activeShroudEntryId;
  const exitId = state.activeShroudExitId;
  state.activeShroud = '';
  state.activeShroudEntryId = null;
  state.activeShroudExitId = null;
  state.activeShroudProfileId = '';
  state.shroudEnteredAt = 0;
  if (exitId != null) {
    delete state.availableFlips[exitId];
  }

  // Specialization callbacks run before shared exit traits and the visible weapon transition.
  runNecromancerShroudExit(context, at, reason);
  context.state.cooldowns.delete(ID.ISOLATE);
  setShroudRecharge(context, entryId, at);
  if (hasTrait(context, TRAIT.SOUL_BARBS)) {
    emitSkillBuff(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.SOUL_BARBS,
      actorType: 'player',
      kind: 'necromancer-soul-barbs',
      duration: 15,
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

// Preserve each trait's attack cursor across advances; per-ally events only trigger resolver-owned siphons.
function emitAlliedAttackOpportunities(
  context: NecromancerSchedulerContext,
  start: number,
  end: number,
  {
    type,
    sourceId,
    cursor,
    minimumInterval = 0
  }: {
    type: string;
    sourceId: SkillId;
    cursor: string;
    minimumInterval?: number;
  }
): void {
  if (!hasTrait(context, sourceId)) return;
  const allies = gw2AlliedPlayerAssumptions(context.config);
  if (!allies.count || !allies.strikesPerSecond) return;
  const combatStart = context.hasExplicitCombatStart ? context.combatStartTime : 0;
  if (combatStart == null || end < combatStart - context.epsilon) return;

  // Respect both the trait cooldown and the configured aggregate ally strike rate.
  const state = professionCoreState(context);
  const interval = Math.max(minimumInterval, 1 / allies.strikesPerSecond);
  const windowStart = Math.max(start, combatStart);
  let nextAt = Number(state.traitProcReadyAt[cursor] || 0);
  if (!(nextAt > windowStart + context.epsilon)) nextAt = windowStart + interval;
  while (nextAt <= end + context.epsilon) {
    for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1) {
      context.emit({
        type,
        at: nextAt,
        source: 'Trait',
        sourceId,
        actorType: 'effect',
        skillName: `Allied Player ${allyIndex} Attack`,
        allyIndex
      });
    }

    nextAt += interval;
  }

  state.traitProcReadyAt[cursor] = nextAt;
}

/** Advances every Core and registered specialization resource clock to one authoritative timestamp. */
export function advanceNecromancerState(context: NecromancerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const start = Number(state.lastResourceAt || 0);
  const end = Math.max(start, Number(target || 0));
  purgeTimedState(state, end);
  emitAlliedAttackOpportunities(context, start, end, {
    type: 'necromancer.vampiric-presence-allied-hit',
    sourceId: TRAIT.VAMPIRIC_PRESENCE,
    cursor: 'vampiricPresenceAlliedNextAt',
    minimumInterval: Number(balanceProfileFromContext(context, PROFILE.vampiricPresence)?.cooldown ?? 0.5)
  });
  emitAlliedAttackOpportunities(context, start, end, {
    type: 'necromancer.taste-for-blood-allied-hit',
    sourceId: TRAIT.OVERFLOWING_THIRST,
    cursor: 'tasteForBloodAlliedNextAt'
  });

  const undeath = activeSignetOfUndeath(context)
    ? balanceProfileFromContext(context, PROFILE.signetOfUndeathPassive)
    : undefined;
  const vampirism = activeSignetOfVampirism(context)
    ? balanceProfileFromContext(context, PROFILE.signetOfVampirismPassive)
    : undefined;
  const undeathInterval = Number(undeath?.pulseInterval ?? 3);
  const vampirismInterval = Number(vampirism?.pulseInterval ?? 3);
  const eternalLife = hasTrait(context, TRAIT.ETERNAL_LIFE);
  const feedback = context.config._schedulerFeedback as NecromancerSchedulerFeedback | undefined;
  const gains = feedback?.lifeForceGains || [];
  // The resolver supplies gains in time order. Keep our position across advances so overlapping or repeated
  // requests cannot grant the same strike's life force twice.
  let gainIndex = resourceFeedbackCursors.get(context.state) || 0;
  let at = start;

  // Drain before each discrete gain, expiry, or depletion so wait partitioning cannot change capped resources.
  // Example: 100 LF, 3 LF/sec drain, and +4 LF at t=3 gives 91 + 4 = 95 at t=3, then 92 at t=4.
  // Adding the pulse before draining the whole four seconds would discard it at the cap and incorrectly give 88.
  while (true) {
    // The previous iteration drained up to `at`; apply all strike gains due there before choosing another boundary.
    // This also handles gains at the initial timestamp, when no time needs to elapse.
    while (gainIndex < gains.length && gains[gainIndex].at <= at + context.epsilon) {
      const gain = gains[gainIndex++];
      // Apply gains at their timestamps, but publish state at the advance boundary: specialization clocks may already
      // hold cast-end state, which must not leak into earlier hits through a backdated full snapshot.
      gainNecromancerLifeForce(context, gain.amount, at);
    }

    // Check AFTER gains so a gain exactly at `end` still applies. This is the exit from while (true).
    if (at >= end) break;
    // Recompute after each boundary: depletion or Lich expiry may have changed which resource rules are active.
    const shroudProfile = balanceProfileFromContext(context, state.activeShroudProfileId || PROFILE.shroud);
    const rate =
      state.activeShroud && state.activeShroud !== 'lich'
        ? (state.maximumLifeForce * Number(shroudProfile?.lifeForceDrain || 0)) / 100
        : 0;
    // Infinity excludes inactive clocks from Math.min; nonpositive pulse intervals disable recurring pulses.
    const nextUndeath = undeath && undeathInterval > 0 ? state.signetNextLifeForceAt : Infinity;
    const nextVampirism = vampirism && vampirismInterval > 0 ? state.vampirismNextAt : Infinity;
    const nextRegeneration = eternalLife && !state.activeShroud ? Math.floor(at + context.epsilon) + 1 : Infinity;
    // Stop at the earliest event or the requested end, including the exact instant drain would exhaust life force.
    // Math.max prevents a stale pulse cursor from moving time backward; its branch below advances that cursor.
    const next = Math.max(
      at,
      Math.min(
        end,
        nextUndeath,
        nextVampirism,
        nextRegeneration,
        state.activeShroud === 'lich' ? state.lichEndsAt : Infinity,
        rate > 0 ? at + state.lifeForce / rate : Infinity,
        gains[gainIndex]?.at ?? Infinity
      )
    );

    // Integrate only this slice before applying gains at its endpoint, so each gain sees the capacity drain created.
    runNecromancerResourceAdvance(context, at, next);
    state.lifeForce = Math.max(0, state.lifeForce - rate * (next - at));
    syncNecromancerResources(state);
    // Depletion takes precedence over a simultaneous pulse: later gains do not automatically re-enter shroud.
    if (rate > 0 && state.lifeForce <= context.epsilon) {
      state.lifeForce = 0;
      leaveShroud(context, next, 'life-force-depleted');
    }

    // Clear the transform before its exit refund so subsequent iterations cannot refund it again.
    if (state.activeShroud === 'lich' && state.lichEndsAt <= next + context.epsilon) {
      state.activeShroud = '';
      state.lichEndsAt = 0;
      delete state.availableFlips[ID.EXIT_LICH_FORM];
      gainNecromancerLifeForce(context, 15, next);
    }

    if (nextRegeneration <= next + context.epsilon) {
      const threshold = state.maximumLifeForce * 0.66;
      // Eternal Life fills only below its threshold; resources earned elsewhere remain intact.
      if (state.lifeForce < threshold) {
        state.lifeForce = Math.min(threshold, state.lifeForce + state.maximumLifeForce * 0.03);
      }
    }

    // Evaluate the recharge exception after exits, using the form actually active at this pulse's timestamp.
    const passiveWhileRecharging = hasTrait(context, TRAIT.SIGNETS_OF_SUFFERING) && Boolean(state.activeShroud);
    if (nextUndeath <= next + context.epsilon) {
      // The starting boundary belongs to the previous advance. Skip it, and suppress recharge-time pulses unless
      // Signets of Suffering permits them; epsilon tolerates floating-point rounding at the boundary.
      if (
        nextUndeath > start + context.epsilon &&
        (Number(context.state.cooldowns.get(ID.SIGNET_OF_UNDEATH) || 0) <= next + context.epsilon ||
          passiveWhileRecharging)
      ) {
        gainNecromancerLifeForce(context, Number(undeath?.lifeForceGain || 0), next);
      }

      // Advance even when suppressed so the next iteration cannot revisit this pulse indefinitely.
      state.signetNextLifeForceAt += undeathInterval;
    }

    if (nextVampirism <= next + context.epsilon) {
      if (
        nextVampirism > start + context.epsilon &&
        (Number(context.state.cooldowns.get(ID.SIGNET_OF_VAMPIRISM) || 0) <= next + context.epsilon ||
          passiveWhileRecharging)
      ) {
        const strike = balanceProfileEffect(vampirism, 'strike');
        const skill = context.catalog.skillsById.get(ID.SIGNET_OF_VAMPIRISM);
        if (skill)
          emitSkillDamage(context, skill, {
            at: next,
            name: 'Signet of Vampirism - Passive Life Siphon',
            coefficient: 0,
            skillWeapon: 'Unequipped',
            flatStrikeBase: Number(strike?.flatStrikeBase || 0),
            flatStrikePowerCoeff: Number(strike?.flatStrikePowerCoeff || 0),
            noCrit: strike?.noCrit === true,
            damageKind: String(strike?.damageKind || '')
          });
      }

      state.vampirismNextAt += vampirismInterval;
    }

    // Continue from the boundary just processed. A boundary at the same time still consumes a cursor or exits a form;
    // otherwise time advances toward `end`. Strike gains at `next` are applied at the top of the loop.
    at = next;
  }

  resourceFeedbackCursors.set(context.state, gainIndex);

  // Save both cursors and publish the complete state at the requested time, ready for the next scheduler decision.
  state.lastResourceAt = end;
  syncNecromancerResources(state);
  emitNecromancerStateSnapshot(context, end, 'advance', {
    dedupeAcrossSourceIds: true
  });
}

/** Applies a completed skill's fixed and trait-dependent life-force gains. */
export function applySkillLifeForceGain(context: NecromancerCastContext, skill: NecromancerSkill): void {
  let amount = Number(skill.lifeForceGain || 0);
  if (skill.categories?.includes('Mark') && hasTrait(context, TRAIT.SOUL_MARKS)) {
    amount += 3;
  }

  if (new Set<string | number>([ID.FEAST_OF_CORRUPTION, ID.DEVOURING_DARKNESS]).has(skill.id)) {
    amount += Math.min(5, observeTargetConditionCount(context, context.effectiveEnd));
  }

  // Dark Pact's fixed gain is conditional on having at least one target boon to remove.
  if (skill.id === ID.DARK_PACT && targetBoonCount(context.config) === 0) {
    amount = 0;
  }

  if (amount > 0) {
    gainNecromancerLifeForce(context, amount, context.effectiveEnd, 'skill-life-force');
  }
}

/** Advances state after a cast, applies completed-cast gains, and commits shroud entry cooldown state. */
export function finalizeNecromancerCast(context: NecromancerCastContext, skill: NecromancerSkill): void {
  advanceNecromancerState(context, context.effectiveEnd);
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  applySkillLifeForceGain(context, skill);
  const state = professionCoreState(context);
  if (state.pendingShroudEntryId === skill.id) {
    context.state.cooldowns.set(skill.id, Number.POSITIVE_INFINITY);
    delete state.pendingShroudEntryId;
  }

  emitNecromancerStateSnapshot(context, context.effectiveEnd, 'after-cast', { dedupeAcrossSourceIds: true });
}

/** Restores the shared Core resource pool and clears simulated self-conditions after a cooldown reset. */
export function resetNecromancerResources(context: NecromancerSchedulerContext): void {
  const state = professionCoreState(context);
  state.lifeForce = state.maximumLifeForce;
  state.resource = state.lifeForce;
  state.selfConditions = [];
  emitNecromancerStateSnapshot(context, context.state.time, 'cooldown-reset', { dedupeAcrossSourceIds: true });
}
