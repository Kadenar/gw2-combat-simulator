import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { timedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { advanceDiscreteResource } from '#gw2/platform/combat/resources/clock.js';
import { consumeCharge, expireCharges, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { EPSILON } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
/**
 * @fileoverview Implements Firebrand tome cast gating, shared page
 * regeneration and spending, tome state replay, and Ashes of the Just damage
 * reactions.
 */

import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { selectedGuardianSpecialization } from '#gw2/professions/guardian/core/mechanics/availability.js';
import { emitGuardianEvent } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

/**
 * Determines whether a tome page or Stow Tome is compatible with the currently
 * active Firebrand tome. Unrelated skills return ready so every hook follows
 * the structured availability contract.
 *
 * Whether the relevant tome skill is castable.
 */
export function tomeStateAvailability(context: GuardianPrecastContext, skill: GuardianSkill): AvailabilityResult {
  const activeTome = firebrandState.from(context).activeTome;
  if (skill.type === 'Weapon' && activeTome) {
    return denyCast('guardian.tome-weapon-lockout', `${skill.name} is unavailable — stow the active tome first.`);
  }

  if (skill.tome) {
    // A tome-page skill is only valid when the matching tome is open; returning
    // false here (wrong or no tome) causes the scheduler to skip it entirely
    // rather than waiting (page gating via tomePageAvailability handles waits).
    if (selectedGuardianSpecialization(context) !== 'Firebrand') {
      return denyCast(
        'guardian.firebrand-specialization',
        `${skill.name} is unavailable — requires the Firebrand specialization.`
      );
    }

    return activeTome === skill.tome
      ? CAST_READY
      : denyCast(
          'guardian.tome-inactive',
          `${skill.name} is unavailable — requires the ${skill.tome} tome to be active.`
        );
  }

  if (skill.name === 'Stow Tome') {
    return activeTome
      ? CAST_READY
      : denyCast('guardian.tome-inactive', `${skill.name} is unavailable — requires an active tome.`);
  }

  return CAST_READY;
}

/**
 * Tome page cost is a regenerating resource, so an insufficient balance is a
 * wait rather than a permanent denial. Once the open tome and specialization
 * match (handled as permanent gating by tomeStateAvailability), the scheduler can
 * pause until the next page lands instead of discarding the cast.
 *
 * Ready or a retry descriptor when pages are insufficient.
 */
export function tomePageAvailability(context: GuardianPrecastContext, skill: GuardianSkill): AvailabilityResult {
  const state = firebrandState.from(context);
  if (!skill.tome || selectedGuardianSpecialization(context) !== 'Firebrand' || state.activeTome !== skill.tome)
    return CAST_READY;
  const pageCost = Math.max(1, Number(skill.pageCost ?? 1));
  if (state.tomePages >= pageCost) return CAST_READY;
  // Pages only ever regenerate upward, so waiting for the scheduled page is a
  // terminating condition. A non-finite next page (regeneration not started)
  // leaves retryAt null so the denial stays final rather than looping forever.
  const reason = `${skill.name} is unavailable — requires ${pageCost} tome page${pageCost === 1 ? '' : 's'}.`;
  return Number.isFinite(state.nextTomePageAt)
    ? retryCast(state.nextTomePageAt, 'guardian.tome-pages', reason)
    : denyCast('guardian.tome-pages', reason);
}

/**
 * Closes the active tome and emits the state transition consumed by the
 * resolver.
 */
function stowTome(context: GuardianCastContext, skill: GuardianSkill): void {
  firebrandState.from(context).activeTome = '';
  // Reset Swift Scholar bookkeeping on stow; the streak only counts consecutive
  // pages within a single uninterrupted tome session.
  firebrandState.from(context).swiftScholarTome = '';
  firebrandState.from(context).swiftScholarCount = 0;
  emitGuardianEvent(context, skill, 'weapon_set', {
    weaponSet: context.state.activeWeaponSet,
    weaponLine: null
  });
  emitGuardianEvent(context, skill, 'guardian.tome-stowed', {
    activeTome: ''
  });
}

/**
 * Pays a completed tome skill's page cost and applies bonuses; only an explicit stow closes the tome.
 */
export function completeTomePage(context: GuardianCastContext, skill: GuardianSkill): void {
  // Page costs and bonuses follow the scheduler's commitment decision, including committed aftercast cancels.
  if (skill.handlerId !== 'guardian.tome-page' || context.action.cancelled) return;
  const state = firebrandState.from(context);
  const pageCost = Math.max(1, Number(skill.pageCost ?? 1));
  // The first spend starts regeneration; later spends and refunds preserve its cadence, even at the cap.
  if (!Number.isFinite(state.nextTomePageAt) && state.tomePageInterval > 0) {
    state.nextTomePageAt = context.effectiveEnd + state.tomePageInterval;
  }

  state.tomePages = Math.max(0, state.tomePages - pageCost);
  const pageGain = Number(context.eventByOrder(Number(context.action.eventOrder))?.tomePageRefund ?? 0);
  if (pageGain > 0) {
    state.tomePages = Math.min(state.maximumTomePages, state.tomePages + pageGain);
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

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.LEGENDARY_LORE)) {
    const legendaryLoreProfile = requireBalanceProfileFromContext(context, PROFILE.legendaryLore);
    const boon = requireEffect(
      legendaryLoreProfile,
      'boon',
      skill.tome === 'justice' ? 'might' : skill.tome === 'resolve' ? 'regeneration' : 'protection'
    );
    if (boon) {
      emitSkillBuff(context, {
        at: context.effectiveEnd,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.LEGENDARY_LORE,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Legendary Lore',
        kind: String(boon.boon || ''),
        stacks: effectNumber(legendaryLoreProfile, boon, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          String(boon.boon || ''),
          effectNumber(legendaryLoreProfile, boon, 'duration')
        )
      });
    }
  }

  emitGuardianEvent(context, skill, 'guardian.tome-page-used', {
    tome: skill.tome,
    pageCost,
    pagesRemaining: state.tomePages,
    activeTome: state.activeTome,
    nextTomePageAt: state.nextTomePageAt
  });
}

/** Schedules tome effects separately so page spending waits for chronological cast completion. */
function useTomePage(context: GuardianCastContext, skill: GuardianSkill): void {
  if (context.action.cancelled) return;
  const state = firebrandState.from(context);
  // The cast belongs to its starting tome session; stowing cannot erase its earned completion refund.
  if (state.swiftScholarTome !== skill.tome) {
    state.swiftScholarTome = String(skill.tome || '');
    state.swiftScholarCount = 0;
  }

  state.swiftScholarCount += 1;

  const swiftScholarProfile = requireBalanceProfileFromContext(context, PROFILE.swiftScholar);
  if (state.swiftScholarCount >= balanceProfileNumber(swiftScholarProfile, 'minimumStacks')) {
    state.swiftScholarCount = 0;
    context.replaceEvent(context.action, {
      tomePageRefund: balanceProfileNumber(swiftScholarProfile, 'resourceGain')
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST) {
    // Both supplied EVTCs grant Ashes during the animation, independently of its cancellation cutoff.
    const at = context.start + 0.56;

    const ashesProfile = requireBalanceProfileFromContext(context, PROFILE.ashes);
    const burn = requireEffect(ashesProfile, 'condition', 'Burning');
    const ashesBuff = requireEffect(ashesProfile, 'buff', 'ashes-of-the-just');
    const might = requireEffect(ashesProfile, 'boon', 'might');
    if (might) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Might',
        kind: 'might',
        stacks: effectNumber(ashesProfile, might, 'stacks'),
        duration: gw2SchedulerBoonDuration(context, skill, 'might', effectNumber(ashesProfile, might, 'duration')),
        audience: { recipients: 'party' as const }
      });
    }

    if (!ashesBuff || !burn) return;
    const ashesDuration = effectNumber(ashesProfile, ashesBuff, 'duration');
    // Self and allied charges share the same authored burn packet.
    const burnDuration = effectNumber(ashesProfile, burn, 'duration');
    const burnStacks = effectNumber(ashesProfile, burn, 'stacks');
    state.ashes = grantCharges(
      balanceProfileNumber(ashesProfile, 'maximumStacks'),
      gw2EffectExpiresAt(at, ashesDuration)
    );
    state.ashesBurnDuration = burnDuration;
    emitGuardianEvent(context, skill, 'guardian.ashes-granted', {
      at,
      // Detach the grant so later scheduler consumption cannot rewrite the application event.
      ashes: { ...state.ashes },
      ashesBurnDuration: state.ashesBurnDuration
    });
    emitSkillBuff(context, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Ashes of the Just',
      kind: 'ashes-of-the-just',
      stacks: state.ashes.charges,
      duration: ashesDuration,
      audience: { recipients: 'party' as const }
    });
    const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
      start: at,
      duration: state.ashes.expiresAt - at,
      maximumPerAlly: state.ashes.charges,
      internalCooldown: balanceProfileNumber(ashesProfile, 'internalCooldown')
    });
    for (let index = 0; index < alliedProcs.length; index += 1) {
      const proc = alliedProcs[index];
      emitSkillCondition(context, {
        skill,
        at: proc.at,
        sourceId: 'guardian.ashes-of-the-just',
        name: `Ashes of the Just — Ally ${proc.allyIndex} Burning`,
        condition: String(burn.condition),
        stacks: burnStacks,
        duration: burnDuration,
        activationId: `${context.reservationId}:ally:${proc.allyIndex}:${proc.procIndex}`,
        metadata: { triggeredByAlly: proc.allyIndex }
      });
    }

    context.emit({
      type: 'guardian.ashes-expired',
      at: state.ashes.expiresAt,
      // Consume charges on expiry-tick strikes before removing the remaining effect.
      priority: 10,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name
    });
  }
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
 */
function handleTomeStowed(context: GuardianResolverContext): void {
  firebrandState.from(context).activeTome = '';
}

/**
 * Replays a tome page resource snapshot into resolver state.
 */
function handleTomePageUsed(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  firebrandState.from(context).tomePages = Number(event.pagesRemaining || 0);
  // Resource snapshots neither close an exhausted tome nor reopen one explicitly stowed during the animation.
  firebrandState.from(context).nextTomePageAt = Number(
    event.nextTomePageAt ?? firebrandState.from(context).nextTomePageAt
  );
}

/** Arms charges at their application event; later page snapshots cannot restore consumed charges. */
function handleAshesGranted(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = firebrandState.from(context);
  if (!event.ashes) throw new TypeError('Ashes application requires a charge grant.');
  state.ashes = grantCharges(event.ashes.charges, event.ashes.expiresAt);
  state.ashes.readyAt = event.ashes.readyAt ?? 0;
  state.ashesBurnDuration = Number(event.ashesBurnDuration ?? state.ashesBurnDuration);
}

function handleAshesExpired(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  expireCharges(firebrandState.from(context).ashes, event.at);
}

/**
 * Resolver handlers for Firebrand tome timeline events.
 */
export const guardianTomeEventHandlers = Object.freeze({
  'guardian.tome-stowed': handleTomeStowed,
  'guardian.tome-page-used': handleTomePageUsed,
  'guardian.ashes-granted': handleAshesGranted,
  'guardian.ashes-expired': handleAshesExpired
});

/**
 * Advances every page tick through the target time, discarding gains above the cap without stopping the timer.
 */
export function advanceTomeState(context: GuardianSchedulerContext, target: number): void {
  const state = firebrandState.from(context);
  // Loop rather than a single add so multiple pages that matured in the same
  // advance window are all credited without needing separate advance calls.
  // A zero authored cadence disables regeneration without disabling spends or refunds.
  if (state.tomePageInterval > 0) {
    const pages = advanceDiscreteResource(
      state.tomePages,
      state.maximumTomePages,
      state.nextTomePageAt,
      state.tomePageInterval,
      target + EPSILON
    );
    state.tomePages = pages.value;
    state.nextTomePageAt = pages.nextAt;
  }

  // Advancing to the deadline precedes its strikes; retain charges until those have resolved.
  expireCharges(state.ashes, target, true);
}

// Page regeneration remains a resource clock; passive Aegis owns a separate fixed cadence.
export function initializeTomeCourage(context: GuardianSchedulerContext): void {
  if (selectedGuardianSpecialization({ config: context.config }) !== 'Firebrand') return;
  const passiveCourageProfile = requireBalanceProfileFromContext(context, PROFILE.passiveCourage);
  if (balanceProfileNumber(passiveCourageProfile, 'pulseInterval') > 0)
    tomeCourage.start(context, { at: 0, captured: {} });
}

export const tomeCourage = timedEffect<GuardianSchedulerContext, object>({
  id: 'guardian.firebrand.passive-courage',
  priority: -200,
  interval: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.passiveCourage), 'pulseInterval'),
  effectsAt(context, at) {
    const courage = context.catalog.skillsById.get(GUARDIAN_SKILL_IDS.TOME_OF_COURAGE);

    const passiveCourageProfile = requireBalanceProfileFromContext(context, PROFILE.passiveCourage);
    const aegis = requireEffect(passiveCourageProfile, 'boon', 'aegis');
    if (!aegis) return false;
    if (!courage) return false;
    // Suppress passive aegis when the virtue is on its dormant cooldown (i.e.
    // the tome was recently activated), unless Stoic Demeanor overrides that
    // suppression window.
    if (
      at >= Number(professionCoreState(context).virtueReadyAt.courage || 0) - EPSILON ||
      hasTrait(context, GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)
    ) {
      emitSkillBuff(context, {
        at,
        source: 'guardian',
        sourceId: courage.id,
        actorType: 'player',
        skillId: courage.id,
        skillName: courage.name,
        name: 'Tome of Courage — Passive Aegis',
        kind: 'aegis',
        stacks: effectNumber(passiveCourageProfile, aegis, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          courage,
          'aegis',
          effectNumber(passiveCourageProfile, aegis, 'duration')
        )
      });
    }
  }
});

/**
 * Consumes an available Ashes of the Just charge on an eligible player strike
 * and applies its burning packet subject to the trigger interval.
 */
export function reactToAshesHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  { hitContext }: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  const ashesProfile = requireBalanceProfileFromContext(context, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  if (!burn) return;
  if (!hitContext || !isGw2PlayerActorEvent(event) || !(Number(event.coefficient) > 0)) return;

  const state = firebrandState.from(context);
  if (!consumeCharge(state.ashes, event.at, balanceProfileNumber(ashesProfile, 'internalCooldown'), true)) return;

  // Ashes burns resolve at charge consumption so same-timestamp condition
  // reactions cannot be reordered behind later damage packets.
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'guardian',
      sourceId: 'guardian.ashes-of-the-just',
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: 'Epilogue: Ashes of the Just',
      name: 'Ashes of the Just — Burning',
      condition: String(burn.condition),
      stacks: effectNumber(ashesProfile, burn, 'stacks'),
      duration: state.ashesBurnDuration
    })
  );
  context.recordProc('profession', 'Ashes of the Just', event.at, event.skillName);
}
