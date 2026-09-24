import { armSkillFlip, expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { eventReaction, scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
/** Initializes Core Mesmer runtime and owns shared scheduler lifecycle and task dispatch so events resolve in order. */
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { gw2ConfiguredWeaponSet, gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSchedulerContext, MesmerSchedulerTask } from '#gw2/professions/mesmer/types.js';
import { createMesmerRuntime } from '#gw2/professions/mesmer/core/mechanics/runtime-controller.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { restartSignetIllusionsPassive } from '#gw2/professions/mesmer/core/mechanics/signets.js';
import {
  emitFencersFinesseStacks,
  recordFencersFinesseProc,
  triggerChaoticInterruption,
  triggerDazzling,
  triggerMasterOfFragmentation,
  triggerThePledge
} from '#gw2/professions/mesmer/core/traits/index.js';
import { scheduleMesmerTrackedHits } from '#gw2/professions/mesmer/core/mechanics/tracked-hits.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

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

  const initial = boundedNumber(config.initialResource || 0, 0, 0, runtime.resourceDefinition.maximum);
  runtime.resources.gainResources(0, initial, gw2PrimaryWeapon(config, 1), 'initial', {
    kind: 'initial'
  });
  for (const skill of context.catalog.skills) {
    if (context.maximumAmmoFor(skill) > 0) {
      context.cooldownController.ensureAmmo(skill, 0);
    }
  }

  for (const skill of context.catalog.skills) {
    if (skill.armedAtStart && skill.flipParentId && context.maximumAmmoFor(skill)) {
      armSkillFlip(professionCoreState(state).availableFlips, skill.id, 0);
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
  target = canonicalTime(target);
  for (const [skillId, window] of Object.entries(profession.availableFlips)) {
    // The natural image expiry must consume its payload before ordinary pruning can discard it.
    if (Number(skillId) === ID.ABSTRACTION && window.expiresAt === target) continue;
    expireSkillFlip(profession.availableFlips, skillId, target);
  }
}

/**
 * Observes shared combat-start, control, bleeding, and critical-hit candidates
 * and schedules chronological processing where required.
 */
export function observeMesmerEvent(context: MesmerSchedulerContext, event: SimulationEvent): void {
  const runtime = context.mesmerRuntime;
  if (!runtime) return;
  triggerThePledge(context, event);
  triggerMasterOfFragmentation(context, event);
  if (event.type === 'control' && !missesTarget(event)) {
    const skillId = Number(event.skillId);
    const skillName = String(event.skillName || event.name || 'Control effect');
    triggerDazzling(context, event, skillId, skillName);

    // Cooldowns can change between scheduling and impact, so delayed control
    // packets must evaluate the recharge against state at their actual hit time.
    if (event.at > context.state.time + EPSILON) {
      chaoticInterruptionReaction.onEventScheduled.handler(context, event);
    } else {
      triggerChaoticInterruption(context, event, skillName);
    }
  }

  if (event.type === 'combat_start') {
    professionCoreState(context).hasExplicitCombatStart = true;
    professionCoreState(context).combatStartTime = event.at;
    restartSignetIllusionsPassive(context, event.at);
  }

  if (event.type === 'damage') {
    const skill = runtime.skillsById.get(Number(event.skillId));
    if (skill && skill.handlerId !== 'mesmer.phantasm' && isGw2PlayerActorEvent(event)) {
      // Default-scheduled sword and tracked-hit packets drive Mesmer state at their canonical impact timestamps.
      const firstFencerTriggerAt = emitFencersFinesseStacks(
        {
          traits: runtime.traits,
          addEvent: runtime.addEvent,
          addTraitProc: runtime.addTraitProc,
          balanceProfile: runtime.balanceProfile
        },
        skill,
        [event.at],
        1
      );
      if (Number(event.hitIndex || 1) === 1) {
        recordFencersFinesseProc(
          { traits: runtime.traits, addEvent: runtime.addEvent, addTraitProc: runtime.addTraitProc },
          skill,
          firstFencerTriggerAt
        );
      }

      if (skill.trackedHitDamage) {
        trackedHitReaction.onEventScheduled.handler(context, event);
      }
    }
  }

  mesmerCriticalTraitReaction.onEventScheduled.handler(context, event);
}

/** Capture only annotations; critical outcomes must come from the canonical event at execution. */
export const mesmerCriticalTraitReaction = eventReaction<
  MesmerSchedulerContext,
  SimulationEvent,
  {
    readonly eventOrder: number;
    readonly metadata: SimulationEvent['metadata'];
  }
>({
  id: 'mesmer.critical-traits',
  missingEvent: 'error',
  select(context, event) {
    const runtime = context.mesmerRuntime;
    if (!runtime || event.type !== 'damage') return null;
    const tracksCriticalTrait =
      (runtime.traits.has(TRAIT.MASTER_FENCER) &&
        isGw2PlayerActorEvent(event) &&
        Number(event.coefficient) > 0 &&
        event.noCrit !== true &&
        event.canCrit !== false) ||
      (runtime.traits.has(TRAIT.SHARPER_IMAGES) && ['clone', 'phantasm'].includes(String(event.summonKind || '')));
    if (!tracksCriticalTrait) return null;
    return {
      at: Math.max(context.state.time, event.at),
      priority: -40,
      ownerId: event.metadata?.cloneId == null ? null : `mesmer.clone:${event.metadata.cloneId}`,
      payload: { eventOrder: Number(event.eventOrder), metadata: event.metadata }
    };
  },
  execute(context, event, _at, captured) {
    // A queued candidate can be cancelled or rejected as precombat before its critical result is sampled.
    if (event.type !== 'damage' || event.cancelled === true || missesTarget(event)) return;
    if (context.hasExplicitCombatStart && (context.combatStartTime == null || event.at < context.combatStartTime))
      return;
    mesmerRuntimeFor(context).criticalTraits.process({
      ...event,
      metadata: { ...captured.metadata, ...event.metadata }
    });
  }
});

/** Future control packets evaluate cooldown state at impact; immediate control remains synchronous. */
export const chaoticInterruptionReaction = scheduledReaction<
  MesmerSchedulerContext,
  SimulationEvent,
  {
    readonly skillId: number;
    readonly skillName: string;
  }
>({
  id: 'mesmer.chaotic-interruption',
  select: (_context, event) => ({
    at: event.at,
    payload: { skillId: Number(event.skillId), skillName: String(event.skillName || event.name || 'Control effect') }
  }),
  execute(context, at, payload) {
    triggerChaoticInterruption(
      context,
      { type: 'control', at, source: 'Skill', sourceId: payload.skillId, actorType: 'player' },
      payload.skillName
    );
  }
});

/** Hit-window bookkeeping uses the observed skill and impact time, independent of later packet replacement. */
export const trackedHitReaction = scheduledReaction<
  MesmerSchedulerContext,
  SimulationEvent,
  { readonly skillId: SkillId }
>({
  id: 'mesmer.tracked-hit',
  select: (_context, event) => ({
    at: event.at,
    priority: -45,
    ownerId: event.activationId,
    payload: { skillId: Number(event.skillId) }
  }),
  execute(context, at, payload) {
    const runtime = mesmerRuntimeFor(context);
    const skill = runtime.skillsById.get(payload.skillId);
    if (skill) scheduleMesmerTrackedHits(context.state, runtime.addDamage, skill, [at]);
  }
});

/** Emits a future party boon only when its dynamic companion audience can be selected. */
export function handlePartyBuffTask(context: MesmerSchedulerContext, task: MesmerSchedulerTask<'partyBuff'>): void {
  context.emit(task.payload.event);
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
