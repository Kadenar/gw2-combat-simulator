import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  balanceProfileNumberFromContext,
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { storeStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type {
  ThiefCastContext,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill
} from '#gw2/professions/thief/types.js';
import { deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { applyMaleficentSeven } from '#gw2/professions/thief/specializations/deadeye/traits/index.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { gainThiefEndurance } from '#gw2/professions/thief/core/mechanics/resource-events.js';

import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';

export const DEADEYE_STOLEN_SKILL_IDS: readonly number[] = Object.freeze([
  ID.STEAL_TIME,
  ID.STEAL_WARMTH,
  ID.STEAL_RESISTANCE,
  ID.STEAL_PRECISION,
  ID.STEAL_HEALTH,
  ID.STEAL_STRENGTH,
  ID.STEAL_DURABILITY,
  ID.STEAL_DEFENSES,
  ID.STEAL_MOBILITY
]);

export function deadeyeStolenSkillGrant(context: ThiefCastContext): {
  readonly skillIds: readonly number[];
  readonly forcedSkillId: number | null;
} {
  // Fire for Effect replaces Deadeye's choice pool with Steal Time, matching the trait's forced stolen skill.
  return hasTrait(context.config, TRAIT.FIRE_FOR_EFFECT)
    ? { skillIds: [ID.STEAL_TIME], forcedSkillId: ID.STEAL_TIME }
    : { skillIds: DEADEYE_STOLEN_SKILL_IDS, forcedSkillId: null };
}

function skillForEvent(context: ThiefSchedulerContext, event: ThiefSimulationEvent): ThiefSkill | undefined {
  return context.catalog.skillsById.get(event.skillId ?? event.sourceId);
}

function isInitiativeAttack(skill: ThiefSkill): boolean {
  // Stealth attacks (malicious or otherwise) gain malice via a separate path; exclude them here to avoid double-counting
  return skill.type === 'Weapon' && Number(skill.initiativeCost || 0) > 0 && !skill.stealthAttack;
}

function markedAt(context: ThiefSchedulerContext, at: number): boolean {
  const state = deadeyeState.from(context);
  return Boolean(state.markedTargetId) && state.markExpiresAt > at;
}

export function initializeDeadeyeMalice(context: ThiefSchedulerContext): void {
  const state = deadeyeState.from(context);
  state.maximumMalice = hasTrait(context.config, TRAIT.MALEFICENT_SEVEN)
    ? balanceProfileNumberFromContext(context, PROFILE.resources, 'minimumStacks')
    : balanceProfileNumberFromContext(context, PROFILE.resources, 'maximumStacks');
  state.malice = Math.min(state.malice, state.maximumMalice);
  // Malice gains a bonus stack on a critical hit (deterministic path), so the scheduler must know crit probability up front
  (context.schedulerPolicy as Gw2SchedulerPolicy).requireCriticalFacts();
}

/** Selects observed candidates and applies the local reaction using canonical impact facts. */
export const deadeyeMaliceReaction = eventReaction<ThiefSchedulerContext, ThiefSimulationEvent>({
  id: 'thief.deadeye-malice-hit',
  order: 20,
  missingEvent: 'skip',
  select(context, event) {
    if (
      event.type !== 'damage' ||
      // A missed strike cannot spend malice or grant its on-hit resource benefit.
      event.offTarget === true ||
      event.actorType !== 'player' ||
      !(Number(event.coefficient) > 0) ||
      typeof event.activationId !== 'string'
    ) {
      return null;
    }

    const skill = skillForEvent(context, event);
    if (!skill || (!skill.malicious && !isInitiativeAttack(skill))) return null;
    // Negative priority ensures the task runs after all damage events for this activation have been appended
    return {
      at: event.at,
      priority: -50,
      ownerId: event.activationId,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, event, at) {
    const activationId = event?.activationId;
    if (typeof activationId !== 'string' || !markedAt(context, at)) {
      return;
    }

    const skill = skillForEvent(context, event);
    if (!skill) return;
    const state = deadeyeState.from(context);
    // Guard against multi-hit skills scheduling multiple tasks for the same activation; only the first should update malice
    if (state.maliceResolvedActivations[activationId]) return;
    state.maliceResolvedActivations[activationId] = true;
    if (skill.malicious) {
      consumeMaliciousAttackMalice(context, event);
    } else if (isInitiativeAttack(skill)) {
      gainInitiativeAttackMalice(context, event);
    }
  }
});

function gainInitiativeAttackMalice(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  const state = deadeyeState.from(context);

  const tracker = { progress: state.maliceCriticalProgress, readyAt: 0 };
  const criticalApplication = advanceScheduledCriticalProc(context, event, { id: 'thief.deadeye.malice' }, tracker);
  state.maliceCriticalProgress = tracker.progress;
  const criticalMalice = criticalApplication?.quantity || 0;

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  state.malice = Math.min(
    state.maximumMalice,
    state.malice +
      balanceProfileNumber(resourcesProfile, 'resourceGain', context) +
      criticalMalice * balanceProfileNumber(resourcesProfile, 'playerStacks', context)
  );
  applyMaleficentSeven(context, event.at);
  emitThiefStateSnapshot(context, event.at, 'malice');
}

function consumeMaliciousAttackMalice(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  const state = deadeyeState.from(context);
  // The first marked hit refunds sword endurance once, before Malicious Intent seeds the next cycle.
  if (event.skillId === ID.MALICIOUS_TACTICAL_STRIKE) {
    gainThiefEndurance(context, Number(event.deadeyeMaliceSnapshot || 0) * 10, event.at, 'malicious-tactical-strike');
  }

  // Spend the attack's malice before Malicious Intent seeds the next malice cycle.
  state.malice = 0;
  state.maleficentSevenTriggered = false;
  emitThiefStateSnapshot(context, event.at, 'malice-spent');

  if (hasTrait(context.config, TRAIT.MALICIOUS_INTENT)) {
    state.malice = Math.min(
      state.maximumMalice,
      state.malice + balanceProfileNumberFromContext(context, PROFILE.maliciousIntent, 'resourceGain')
    );
    applyMaleficentSeven(context, event.at);
    emitThiefStateSnapshot(context, event.at, 'malicious-intent');
  }
}

function updateSilentScope(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = deadeyeState.from(context);
  if (skill.id !== ID.DODGE || !hasTrait(context.config, TRAIT.SILENT_SCOPE)) return;
  const silentScopeProfile = requireBalanceProfileFromContext(context, PROFILE.silentScope);
  if (state.malice <= balanceProfileNumber(silentScopeProfile, 'threshold', context)) return;

  // Silent Scope grants one out-of-stealth stealth-attack charge, expiring 3s after the dodge ends
  state.stealthAttackCharges = 1;
  state.stealthAttackExpiresAt =
    context.effectiveEnd + balanceProfileNumber(silentScopeProfile, 'durationMultiplier', context);
  emitThiefStateSnapshot(context, context.effectiveEnd, 'silent-scope');
}

function updateCantripTraits(context: ThiefCastContext, skill: ThiefSkill): void {
  if (!(skill.categories || []).includes('Cantrip')) return;
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  if (context.config.relic === 'Deadeye') {
    state.deadeyeRelicUntil = at + 8;
    context.emit({
      type: 'proc',
      procType: 'relic',
      at,
      source: 'Relic',
      sourceId: 'relic.deadeye',
      actorType: 'effect',
      name: 'Relic of the Deadeye',
      sourceSkill: skill.name,
      // Publish the same window as the damage modifier for shared relic timers and expiry markers.
      duration: state.deadeyeRelicUntil - at,
      detail: 'activated'
    });
    emitThiefStateSnapshot(context, at, 'deadeye-relic');
  }

  if (hasTrait(context.config, TRAIT.ONE_IN_THE_CHAMBER)) {
    // One in the Chamber recharges the stolen skill on every cantrip use, overwriting any previously stored skill
    const grant = deadeyeStolenSkillGrant(context);
    storeStolenSkillChoices(context, grant.skillIds, grant.forcedSkillId);
  }
}

export function updateDeadeyeCastState(context: ThiefCastContext, skill: ThiefSkill): void {
  updateSilentScope(context, skill);
  updateCantripTraits(context, skill);
}
