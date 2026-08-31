import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import { storeStolenSkillChoices } from '#gw2/content/professions/thief/core/mechanics/steal.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type {
  ThiefCastContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  ThiefSkill
} from '#gw2/content/professions/thief/types.js';
import { deadeyeState } from '#gw2/content/professions/thief/specializations/deadeye/state.js';
import { applyMaleficentSeven } from '#gw2/content/professions/thief/specializations/deadeye/traits/index.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/scheduler/types.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';

import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/specializations/deadeye/profiles.js';

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
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const state = deadeyeState.from(context);
  state.maximumMalice = hasTrait(context.config, TRAIT.MALEFICENT_SEVEN)
    ? Number(resources?.minimumStacks || 7)
    : Number(resources?.maximumStacks || 5);
  state.malice = Math.min(state.malice, state.maximumMalice);
  // Malice gains a bonus stack on a critical hit (deterministic path), so the scheduler must know crit probability up front
  (context.schedulerPolicy as Gw2SchedulerPolicy).requireCriticalFacts();
}

export function observeDeadeyeScheduledEvent(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    typeof event.activationId !== 'string'
  ) {
    return;
  }

  const skill = skillForEvent(context, event);
  if (!skill || (!skill.malicious && !isInitiativeAttack(skill))) return;
  // Negative priority ensures the task runs after all damage events for this activation have been appended
  context.tasks.schedule({
    type: 'thief.deadeye-malice-hit',
    at: event.at,
    priority: -50,
    ownerId: event.activationId,
    payload: { eventOrder: event.eventOrder }
  });
}

function gainInitiativeAttackMalice(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  const state = deadeyeState.from(context);
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const tracker = { progress: state.maliceCriticalProgress, readyAt: 0 };
  const criticalApplication = advanceScheduledCriticalProc(context, event, { id: 'thief.deadeye.malice' }, tracker);
  state.maliceCriticalProgress = tracker.progress;
  const criticalMalice = criticalApplication?.quantity || 0;

  state.malice = Math.min(
    state.maximumMalice,
    state.malice + Number(resources?.resourceGain || 1) + criticalMalice * Number(resources?.playerStacks || 1)
  );
  applyMaleficentSeven(context, event.at);
  emitStateSnapshot(context, 'thief', event.at, 'malice', snapshotThiefState(context.state.profession));
}

function consumeMaliciousAttackMalice(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  const state = deadeyeState.from(context);
  if (hasTrait(context.config, TRAIT.MALICIOUS_INTENT)) {
    // Malicious Intent grants 2 malice on consumption before zeroing it out, allowing Maleficent Seven to trigger one final time
    state.malice = Math.min(
      state.maximumMalice,
      state.malice + Number(balanceProfileFromContext(context, PROFILE.maliciousIntent)?.resourceGain || 2)
    );
    applyMaleficentSeven(context, event.at);
    emitStateSnapshot(context, 'thief', event.at, 'malicious-intent', snapshotThiefState(context.state.profession));
  }

  state.malice = 0;
  state.maleficentSevenTriggered = false;
  emitStateSnapshot(context, 'thief', event.at, 'malice-spent', snapshotThiefState(context.state.profession));
}

export function resolveDeadeyeMaliceHit(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<{ readonly eventOrder?: number }>
): void {
  const event = context.eventByOrder(Number(task.payload.eventOrder)) as ThiefSimulationEvent | undefined;
  const activationId = event?.activationId;
  if (!event || typeof activationId !== 'string' || !markedAt(context, task.at)) {
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

function updateSilentScope(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = deadeyeState.from(context);
  if (
    skill.id !== ID.DODGE ||
    !hasTrait(context.config, TRAIT.SILENT_SCOPE) ||
    state.malice <= Number(balanceProfileFromContext(context, PROFILE.silentScope)?.threshold || 3)
  ) {
    return;
  }

  // Silent Scope grants one out-of-stealth stealth-attack charge, expiring 3s after the dodge ends
  state.stealthAttackCharges = 1;
  state.stealthAttackExpiresAt =
    context.effectiveEnd + Number(balanceProfileFromContext(context, PROFILE.silentScope)?.durationMultiplier || 3);
  emitStateSnapshot(
    context,
    'thief',
    context.effectiveEnd,
    'silent-scope',
    snapshotThiefState(context.state.profession)
  );
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
      detail: 'activated'
    });
    emitStateSnapshot(context, 'thief', at, 'deadeye-relic', snapshotThiefState(context.state.profession));
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
