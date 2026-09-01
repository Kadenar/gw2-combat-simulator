/** Runs the large Core Mesmer illusion subsystem on the scheduler phase. */
import { EPSILON } from '#kernel/core/clock.js';
import { clamp } from '#gw2/platform/combat/numeric.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2ConfiguredWeaponSet, gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import type { MesmerSchedulerContext } from '#gw2/content/professions/mesmer/types.js';
import { createMesmerRuntime } from '#gw2/content/professions/mesmer/core/mechanics/illusions/controller.js';
import { mesmerRuntimeFor } from '#gw2/content/professions/mesmer/core/mechanics/runtime.js';
import { restartSignetIllusionsPassive } from '#gw2/content/professions/mesmer/core/skills/signets.js';
import { triggerChaoticInterruption, triggerDazzling } from '#gw2/content/professions/mesmer/core/traits/index.js';
import type { MesmerExpectedProcCandidate } from '#gw2/content/professions/mesmer/core/mechanics/illusions/types.js';
import type { MesmerSchedulerTask } from '#gw2/content/professions/mesmer/state/types.js';

/**
 * Initializes the per-simulation Mesmer runtime, weapon set, resource pool,
 * ammo, persistent flips, critical-fact requirements, and passive tasks.
 */
export function initializeMesmerScheduler(context: MesmerSchedulerContext): void {
  if (context.state.activeWeaponSet === 2 && gw2ConfiguredWeaponSet(context.config, 2).every((weapon) => !weapon)) {
    context.state.activeWeaponSet = 1;
  }

  const runtime = createMesmerRuntime(context);
  context.mesmerRuntime = runtime;
  const { state, config } = context;
  if (runtime.traits.has(TRAIT.SHARPER_IMAGES) || runtime.traits.has(TRAIT.MASTER_FENCER)) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }

  const initial = clamp(Number(config.initialResource || 0), 0, runtime.resourceDefinition.maximum);
  runtime.resources.gainResources(0, initial, gw2PrimaryWeapon(config, 1), 'initial', {
    kind: 'initial'
  });
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }

  for (const skill of context.catalog.skills) {
    if (skill.armedAtStart && skill.mesmerMechanic?.flipParentId && context.maximumAmmoFor(skill)) {
      professionCoreState(state).availableFlips[skill.id] = {
        availableAt: 0,
        expiresAt: Infinity
      };
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }

  restartSignetIllusionsPassive(context, 0);
}

/**
 * Expires shared flip-skill windows as scheduler time advances.
 */
export function advanceMesmerScheduler(context: MesmerSchedulerContext, target: number): void {
  const profession = professionCoreState(context);
  for (const [skillId, flip] of Object.entries(profession.availableFlips)) {
    if (flip.expiresAt < target - EPSILON) {
      delete profession.availableFlips[skillId];
      if (Number(skillId) === ID.COUNTERSPELL) {
        profession.counterspellAvailable = false;
      }
    }
  }
}

/**
 * Observes shared combat-start, control, bleeding, and critical-hit candidates
 * and schedules chronological processing where required.
 */
export function observeMesmerEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = context.mesmerRuntime;
  if (!runtime) return;
  if (event.type === 'control') {
    const skillId = Number(event.skillId);
    const skillName = String(event.skillName || event.name || 'Control effect');
    triggerDazzling(context, event, skillId, skillName);

    // Cooldowns can change between scheduling and impact, so delayed control
    // packets must evaluate the recharge against state at their actual hit time.
    if (event.at > context.state.time + EPSILON) {
      context.tasks.schedule({
        type: 'mesmer.chaotic-interruption',
        at: event.at,
        payload: { skillId, skillName }
      });
    } else {
      triggerChaoticInterruption(context, event, skillName);
    }
  }

  if (event.type === 'combat_start') {
    professionCoreState(context).hasExplicitCombatStart = true;
    professionCoreState(context).combatStartTime = event.at;
    restartSignetIllusionsPassive(context, event.at);
  }

  let candidate: MesmerExpectedProcCandidate | null = null;
  if (event.type === 'damage') {
    const tracksCriticalTrait =
      (runtime.traits.has(TRAIT.MASTER_FENCER) &&
        isGw2PlayerActorEvent(event) &&
        Number(event.coefficient) > 0 &&
        event.noCrit !== true &&
        event.canCrit !== false) ||
      (runtime.traits.has(TRAIT.SHARPER_IMAGES) && (event.source === 'Clone' || event.source === 'Phantasm'));

    if (!tracksCriticalTrait) return;
    candidate = {
      type: 'hit',
      at: event.at,
      event,
      cloneId: event.cloneId
    };
  }

  if (!candidate) return;
  context.tasks.schedule({
    type: 'mesmer.expected-proc',
    at: Math.max(context.state.time, event.at),
    priority: -40,
    ownerId: event.cloneId == null ? null : `mesmer.clone:${event.cloneId}`,
    payload: candidate
  });
}

/**
 * Dispatches a scheduled clone attack to the illusion controller.
 */
export function handleCloneAttackTask(context: MesmerSchedulerContext, task: MesmerSchedulerTask<'cloneAttack'>): void {
  mesmerRuntimeFor(context).cloneAttackScheduler.handleTask(task.payload.cloneId, task.at);
}

/**
 * Applies a delayed clone or blade resource gain.
 */
export function handleResourceGainTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'resourceGain'>
): void {
  const runtime = mesmerRuntimeFor(context);
  const { count, weapon, reason, cause } = task.payload;
  const sourceSkill = runtime.skillsById.get(Number(cause?.sourceSkillId));
  const resolvesMaximumCloneOutcome =
    runtime.resourceDefinition.singular === 'clone' &&
    runtime.actions.currentResource() >= runtime.resourceDefinition.maximum &&
    Boolean(sourceSkill?.maxCloneEffects?.length);
  if (resolvesMaximumCloneOutcome && sourceSkill) {
    // The resource packet owns the outcome: at impact time it either creates a clone or emits the skill's at-cap effect.
    for (const effect of sourceSkill.maxCloneEffects || []) {
      runtime.addCondition(sourceSkill.name, task.at, { ...effect, name: effect.condition }, 'Player');
    }

    return;
  }

  runtime.resources.gainResources(task.at, count, weapon, reason, cause);
}

/**
 * Resolves delayed critical trait procs. Deterministic mode uses critical-hit
 * probability; stochastic mode consumes the canonical sampled hit fact.
 */
export function handleExpectedProcTask(
  context: MesmerSchedulerContext,
  task: MesmerSchedulerTask<'expectedProc'>
): void {
  const runtime = mesmerRuntimeFor(context);
  const payloadEvent = task.payload.type === 'hit' ? task.payload.event : null;
  const canonicalEvent = payloadEvent ? context.eventByOrder(Number(payloadEvent.eventOrder)) : null;
  // The trigger materializer runs first and replaces the canonical event with
  // its sampled `didCrit` fact. Preserve Mesmer-only annotations from the
  // original candidate (such as a skill-derived `blade` flag).
  const event = payloadEvent ? { ...payloadEvent, ...(canonicalEvent || {}) } : null;
  runtime.expected.process(task.payload.type === 'hit' && event ? { ...task.payload, event } : task.payload);
}
