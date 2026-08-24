import { firebrandState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
/**
 * @fileoverview Implements Firebrand tome cast gating, shared page
 * regeneration and spending, tome state replay, and Ashes of the Just damage
 * reactions.
 */

import { isGw2PlayerActorEvent } from '../../../../platform/gw2/event-ownership.js';
import { gw2AlliedPlayerAssumptions, gw2AlliedPlayerProcTimeline } from '../../../../platform/gw2/allied-players.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../../data/ids.js';
import { selectedGuardianSpecialization } from '../../core/availability.js';
import { emitGuardianEvent } from '../../core/events.js';
import { guardianBalanceProfile, guardianBalanceProfileEffect } from '../../core/profiles.js';
import { hasGuardianTrait } from '../../core/traits.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { AvailabilityResult } from '../../../../platform/engine/types.js';
import type { Gw2ConditionResolution } from '../../../../platform/gw2/types.js';
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '../../types.js';

interface AshesHitDependencies {
  readonly hitContext?: object;
  readonly applyCondition?: Gw2ConditionResolution['applyCondition'];
}

/**
 * Determines whether a tome page or Stow Tome is compatible with the currently
 * active Firebrand tome. Unrelated skills return no opinion.
 *
 * @param {GuardianPrecastContext} context Cast-validation context.
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean|undefined} Whether the relevant tome skill is castable.
 */
export function validateTomeCast(context: GuardianPrecastContext, skill: GuardianSkill): boolean | undefined {
  // Returning false (not undefined) permanently blocks the skill from casting.
  // Weapon skills are completely locked out while any tome is active.
  if (skill.type === 'Weapon' && firebrandState.from(context).activeTome) {
    return false;
  }

  if (skill.tome) {
    // A tome-page skill is only valid when the matching tome is open; returning
    // false here (wrong or no tome) causes the scheduler to skip it entirely
    // rather than waiting (page gating via tomePageAvailability handles waits).
    return (
      selectedGuardianSpecialization(context) === 'Firebrand' && firebrandState.from(context).activeTome === skill.tome
    );
  }

  if (skill.name === 'Stow Tome') {
    return Boolean(firebrandState.from(context).activeTome);
  }
  // Returning undefined means "no opinion" — the platform's default rules apply.
}

/**
 * Tome page cost is a regenerating resource, so an insufficient balance is a
 * wait rather than a permanent denial. Once the open tome and specialization
 * match (handled as permanent gating by validateTomeCast), the scheduler can
 * pause until the next page lands instead of discarding the cast.
 *
 * @param {GuardianPrecastContext} context Cast-availability context.
 * @param {GuardianSkill} skill Candidate tome skill.
 * @returns {boolean | AvailabilityResult} True when ready, or a retry
 * descriptor when pages are insufficient.
 */
export function tomePageAvailability(
  context: GuardianPrecastContext,
  skill: GuardianSkill
): boolean | AvailabilityResult {
  const state = firebrandState.from(context);
  if (!skill.tome || selectedGuardianSpecialization(context) !== 'Firebrand' || state.activeTome !== skill.tome)
    return true;
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  if (state.tomePages >= pageCost) return true;
  // Pages only ever regenerate upward, so waiting for the scheduled page is a
  // terminating condition. A non-finite next page (tome already at maximum)
  // leaves retryAt null so the denial stays final rather than looping forever.
  const retryAt = Number.isFinite(state.nextTomePageAt) ? state.nextTomePageAt : null;
  return {
    ready: false,
    retryAt,
    code: 'guardian.tome-pages',
    reason: `${skill.name} is unavailable — requires ${pageCost} tome ` + `page${pageCost === 1 ? '' : 's'}.`
  };
}

/**
 * Closes the active tome and emits the state transition consumed by the
 * resolver.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Stow Tome skill.
 * @returns {boolean} Always true to indicate the state-only action completed.
 */
function stowTome(context: GuardianCastContext, skill: GuardianSkill): boolean {
  firebrandState.from(context).activeTome = '';
  // Reset Swift Scholar bookkeeping on stow; the streak only counts consecutive
  // pages within a single uninterrupted tome session.
  firebrandState.from(context).swiftScholarTome = '';
  firebrandState.from(context).swiftScholarCount = 0;
  emitGuardianEvent(context, skill, 'weapon_set', {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    weaponLine: null
  });
  emitGuardianEvent(context, skill, 'guardian.tome-stowed', {
    activeTome: ''
  });
  return true;
}

/**
 * Pays a completed tome skill's page cost, arms Ashes when appropriate, closes
 * an exhausted tome, and emits the resulting resource snapshot.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Tome page skill.
 * @returns {boolean} True when interrupted; false after a completed page use.
 */
function useTomePage(context: GuardianCastContext, skill: GuardianSkill): boolean {
  // Interrupted casts must not spend pages; returning true signals the handler
  // chain that the cast was aborted (consistent with augmentSkill semantics).
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  const state = firebrandState.from(context);
  const pageCost = Math.max(1, Number(skill.pageCost || 1));
  // The regen timer only ticks while below maximum; spending a page from a full
  // pool restarts the interval from this cast rather than from last regen tick.
  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt = context.effectiveEnd + state.tomePageInterval;
  }

  state.tomePages = Math.max(0, state.tomePages - pageCost);
  if (state.swiftScholarTome !== skill.tome) {
    state.swiftScholarTome = String(skill.tome || '');
    state.swiftScholarCount = 0;
  }

  state.swiftScholarCount += 1;
  const swiftScholar = guardianBalanceProfile(context, PROFILE.swiftScholar);
  if (state.swiftScholarCount >= Number(swiftScholar?.minimumStacks || 3)) {
    state.swiftScholarCount = 0;
    const pageGain = Number(swiftScholar?.resourceGain || 1);
    state.tomePages = Math.min(state.maximumTomePages, state.tomePages + pageGain);
    if (state.tomePages >= state.maximumTomePages) {
      state.nextTomePageAt = Number.POSITIVE_INFINITY;
    }

    context.emit({
      type: 'proc',
      procType: 'trait',
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: GUARDIAN_TRAIT_IDS.SWIFT_SCHOLAR,
      actorType: 'effect',
      name: 'Swift Scholar',
      sourceSkill: skill.name,
      detail: `+${pageGain} tome page${pageGain === 1 ? '' : 's'}`
    });
  }

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.LEGENDARY_LORE)) {
    const boon = guardianBalanceProfileEffect(
      guardianBalanceProfile(context, PROFILE.legendaryLore),
      'boon',
      skill.tome === 'justice' ? 0 : skill.tome === 'resolve' ? 1 : 2
    );
    if (boon) {
      context.emit({
        type: 'buff',
        at: context.effectiveEnd,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.LEGENDARY_LORE,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Legendary Lore',
        kind: String(boon.boon || ''),
        stacks: Number(boon.stacks || 1),
        duration: Number(boon.duration || 0)
      });
    }
  }

  if (skill.id === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST) {
    const at = context.effectiveEnd;
    const party = gw2AlliedPlayerAssumptions(context.config);
    const ashes = guardianBalanceProfile(context, PROFILE.ashes);
    const burn = guardianBalanceProfileEffect(ashes, 'condition');
    const ashesBuff = guardianBalanceProfileEffect(ashes, 'buff');
    const might = guardianBalanceProfileEffect(ashes, 'boon');
    const ashesDuration = Number(ashesBuff?.duration || 10);
    state.ashesCharges = Number(ashes?.maximumStacks || ashesBuff?.stacks || 2);
    state.ashesBurnDuration = Number(burn?.duration || 2);
    state.ashesNextTriggerAt = at;
    state.ashesExpiresAt = at + ashesDuration;
    context.emit({
      type: 'buff',
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Ashes of the Just',
      kind: 'ashes-of-the-just',
      stacks: state.ashesCharges,
      duration: ashesDuration,
      recipients: 'party',
      recipientCount: party.count + 1
    });
    context.emit({
      type: 'buff',
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Might',
      kind: 'might',
      stacks: Number(might?.stacks || 8),
      duration: Number(might?.duration || 10),
      recipients: 'party',
      recipientCount: party.count + 1
    });
    const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
      start: at,
      duration: ashesDuration,
      maximumPerAlly: state.ashesCharges,
      internalCooldown: Number(ashes?.internalCooldown || 1)
    });
    for (let index = 0; index < alliedProcs.length; index += 1) {
      const proc = alliedProcs[index];
      context.emit({
        type: 'condition',
        at: proc.at,
        source: 'guardian',
        sourceId: 'guardian.ashes-of-the-just',
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: `Ashes of the Just — Ally ${proc.allyIndex} Burning`,
        condition: String(burn?.condition || 'Burning'),
        stacks: Number(burn?.stacks || 1),
        duration: Number(burn?.duration || 2),
        activationId: `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
        triggeredByAlly: proc.allyIndex
      });
    }

    context.emit({
      type: 'guardian.ashes-expired',
      at: state.ashesExpiresAt,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      ashesExpiresAt: state.ashesExpiresAt
    });
  }

  // Auto-stow when the last page is consumed so the scheduler doesn't need to
  // inject a separate Stow Tome cast; automatic: true marks it as involuntary
  // for the timeline display.
  if (state.tomePages === 0) {
    state.activeTome = '';
    emitGuardianEvent(context, skill, 'weapon_set', {
      weaponSet: context.state.activeWeaponSet,
      mechanicSwap: true,
      weaponLine: null,
      automatic: true
    });
  }

  emitGuardianEvent(context, skill, 'guardian.tome-page-used', {
    tome: skill.tome,
    pageCost,
    pagesRemaining: state.tomePages,
    activeTome: state.activeTome,
    nextTomePageAt: state.nextTomePageAt,
    ...(skill.id === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST
      ? {
          ashesCharges: state.ashesCharges,
          ashesBurnDuration: state.ashesBurnDuration,
          ashesNextTriggerAt: state.ashesNextTriggerAt,
          ashesExpiresAt: state.ashesExpiresAt
        }
      : {})
  });
  return false;
}

/**
 * Raw Firebrand tome callbacks consumed by the central handler registry.
 */
export const guardianTomeSkillHandlers = Object.freeze({
  'guardian.stow-tome': stowTome,
  'guardian.tome-page': useTomePage
});

/**
 * Replays a tome-stowed event into resolver state.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @returns {void}
 */
function handleTomeStowed(context: GuardianResolverContext): void {
  firebrandState.from(context).activeTome = '';
}

/**
 * Replays a tome page resource snapshot into resolver state.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Tome-page-used timeline event.
 * @returns {void}
 */
function handleTomePageUsed(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  firebrandState.from(context).tomePages = Number(event.pagesRemaining || 0);
  firebrandState.from(context).activeTome = String(event.activeTome || '');
  firebrandState.from(context).nextTomePageAt = Number(
    event.nextTomePageAt ?? firebrandState.from(context).nextTomePageAt
  );
  firebrandState.from(context).ashesCharges = Number(event.ashesCharges ?? firebrandState.from(context).ashesCharges);
  firebrandState.from(context).ashesBurnDuration = Number(
    event.ashesBurnDuration ?? firebrandState.from(context).ashesBurnDuration
  );
  firebrandState.from(context).ashesNextTriggerAt = Number(
    event.ashesNextTriggerAt ?? firebrandState.from(context).ashesNextTriggerAt
  );
  firebrandState.from(context).ashesExpiresAt = Number(
    event.ashesExpiresAt ?? firebrandState.from(context).ashesExpiresAt
  );
}

function handleAshesExpired(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // A newer Ashes application extends ashesExpiresAt beyond the queued event
  // time; re-check the stored expiry so a stale expiry event doesn't clear
  // charges that were refreshed by a Quickfire proc after this event was queued.
  if (
    Number(firebrandState.from(context).ashesExpiresAt || 0) <=
    Number(event.at) + Number(context.epsilon || 0.0001)
  ) {
    firebrandState.from(context).ashesCharges = 0;
  }
}

/**
 * Resolver handlers for Firebrand tome timeline events.
 */
export const guardianTomeEventHandlers = Object.freeze({
  'guardian.tome-stowed': handleTomeStowed,
  'guardian.tome-page-used': handleTomePageUsed,
  'guardian.ashes-expired': handleAshesExpired
});

/**
 * Regenerates all tome pages due by the target scheduler time and disables the
 * next-page timer when the resource reaches its maximum.
 *
 * @param {GuardianSchedulerContext} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceTomeState(context: GuardianSchedulerContext, target: number): void {
  const state = firebrandState.from(context);
  // Loop rather than a single add so multiple pages that matured in the same
  // advance window are all credited without needing separate advance calls.
  while (state.tomePages < state.maximumTomePages && state.nextTomePageAt <= target + context.epsilon) {
    state.tomePages += 1;
    state.nextTomePageAt += state.tomePageInterval;
  }

  if (state.tomePages >= state.maximumTomePages) {
    state.nextTomePageAt = Number.POSITIVE_INFINITY;
  }

  if (state.ashesCharges > 0 && state.ashesExpiresAt <= target + context.epsilon) {
    state.ashesCharges = 0;
  }

  // Passive courage aegis is firebrand-only; skip early for other specs to
  // avoid emitting aegis that shouldn't exist on dragonhunter/core guardian.
  if (selectedGuardianSpecialization({ config: context.config }) !== 'Firebrand') return;
  const courage = context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.TOME_OF_COURAGE);
  const passiveCourage = guardianBalanceProfile(context, PROFILE.passiveCourage);
  const aegis = guardianBalanceProfileEffect(passiveCourage, 'boon');
  while (courage && state.nextCourageAegisAt <= target + context.epsilon) {
    const at = state.nextCourageAegisAt;
    // Suppress passive aegis when the virtue is on its dormant cooldown (i.e.
    // the tome was recently activated), unless Stoic Demeanor overrides that
    // suppression window.
    if (
      at >= Number(professionCoreState(context).virtueReadyAt.courage || 0) - context.epsilon ||
      hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)
    ) {
      context.emit({
        type: 'buff',
        at,
        source: 'guardian',
        sourceId: courage.id,
        actorType: 'player',
        skillId: courage.id,
        skillName: courage.name,
        name: 'Tome of Courage — Passive Aegis',
        kind: 'aegis',
        stacks: Number(aegis?.stacks || 1),
        duration: Number(aegis?.duration || 40)
      });
    }

    state.nextCourageAegisAt += Number(passiveCourage?.pulseInterval || 40);
  }
}

/**
 * Consumes an available Ashes of the Just charge on an eligible player strike
 * and applies its burning packet subject to the trigger interval.
 *
 * @param {GuardianResolverContext} context Resolver reaction context.
 * @param {GuardianResolverEvent} event Resolved damage event.
 * @param {AshesHitDependencies} dependencies Resolver helpers.
 * @returns {void}
 */
export function reactToAshesHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext, applyCondition }: AshesHitDependencies = {}
): void {
  const ashes = guardianBalanceProfile(context, PROFILE.ashes);
  const burn = guardianBalanceProfileEffect(ashes, 'condition');
  if (
    !hitContext ||
    typeof applyCondition !== 'function' ||
    !isGw2PlayerActorEvent(event) ||
    !(Number(event.coefficient) > 0)
  )
    return;

  const state = firebrandState.from(context);
  if (
    state.ashesCharges <= 0 ||
    event.at >= state.ashesExpiresAt - Number(context.epsilon || 0.0001) ||
    event.at + Number(context.epsilon || 0.0001) < state.ashesNextTriggerAt
  )
    return;

  applyCondition(context, {
    type: 'condition',
    at: event.at,
    source: 'guardian',
    sourceId: 'guardian.ashes-of-the-just',
    actorType: 'player',
    skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
    skillName: 'Epilogue: Ashes of the Just',
    name: 'Ashes of the Just — Burning',
    condition: String(burn?.condition || 'Burning'),
    stacks: Number(burn?.stacks || 1),
    duration: state.ashesBurnDuration
  });
  state.ashesCharges -= 1;
  state.ashesNextTriggerAt = event.at + Number(ashes?.internalCooldown || 1);
  context.recordProc('profession', 'Ashes of the Just', event.at, event.skillName);
}
