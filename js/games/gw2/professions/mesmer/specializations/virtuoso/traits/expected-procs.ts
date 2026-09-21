import { eventReaction, scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import { virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';

const PROC_PROGRESS_TOLERANCE = 1e-9;

/** Bloodsong consumes the observed bleeding stacks at their application timestamp. */
export const bloodsongReaction = scheduledReaction<
  MesmerSchedulerContext,
  SimulationEvent,
  { readonly stacks: number }
>({
  id: 'mesmer.bloodsong',
  order: 30,
  select(context, event) {
    if (
      event.type !== 'condition' ||
      event.condition !== 'Bleeding' ||
      !mesmerRuntimeFor(context).traits.has(TRAIT.BLOODSONG)
    )
      return null;
    return {
      at: Math.max(context.state.time, event.at),
      priority: -40,
      ownerId: event.metadata?.cloneId == null ? null : `mesmer.clone:${event.metadata.cloneId}`,
      payload: { stacks: event.stacks }
    };
  },
  execute(context, at, payload) {
    const runtime = mesmerRuntimeFor(context);
    const state = virtuosoState.from(context);
    state.bloodsongProgress += Number(payload.stacks || 0);
    const profile = balanceProfileFromContext(context, TRAIT.BLOODSONG);
    const threshold = Number(profile?.threshold ?? 5);
    // A disabled threshold must not enqueue an unbounded number of blade gains.
    while (threshold > 0 && state.bloodsongProgress >= threshold - PROC_PROGRESS_TOLERANCE) {
      state.bloodsongProgress -= threshold;
      runtime.resources.queueResources(
        at,
        Number(profile?.resourceGain ?? 1),
        runtime.activePrimaryWeapon(),
        'Bloodsong',
        { traitId: TRAIT.BLOODSONG, traitName: 'Bloodsong' }
      );
    }
  }
});

/** Jagged Mind reads canonical hit facts while retaining the observed skill's blade eligibility. */
export const jaggedMindReaction = eventReaction<MesmerSchedulerContext>({
  id: 'mesmer.virtuoso-expected-proc',
  order: 30,
  missingEvent: 'error',
  select(context, event) {
    const runtime = mesmerRuntimeFor(context);
    if (event.type !== 'damage' || !runtime.traits.has(TRAIT.JAGGED_MIND)) return null;
    const skill = runtime.skillsById.get(Number(event.skillId));
    if ((!event.metadata?.blade && !skill?.blade) || event.noCrit === true || event.canCrit === false) return null;
    return {
      at: Math.max(context.state.time, event.at),
      priority: -40,
      ownerId: event.metadata?.cloneId == null ? null : `mesmer.clone:${event.metadata.cloneId}`,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, canonicalEvent) {
    const runtime = mesmerRuntimeFor(context);
    const event = { ...canonicalEvent };
    if (!Object.hasOwn(event.metadata ?? {}, 'blade')) event.metadata = { ...event.metadata, blade: true };
    // Jagged Mind applies fractional expected stacks directly in deterministic
    // mode, while stochastic mode consumes the canonical sampled critical fact.
    const application = advanceScheduledCriticalProc(context, event, {
      id: 'mesmer.virtuoso.jagged-mind',
      materialization: 'weighted'
    });
    if (!application) return;
    const effect = balanceProfileEffect(balanceProfileFromContext(context, TRAIT.JAGGED_MIND), 'condition');
    emitSkillCondition(context, {
      cause: event,

      at: event.at,
      name: `${event.name} — Jagged Mind`,
      skillName: event.skillName,
      parentSkillName: event.parentSkillName,
      condition: 'Bleeding',
      duration: Number(effect?.duration ?? 4),
      stacks: application.quantity * Number(effect?.stacks ?? 1),
      source: event.source,
      sourceId: TRAIT.JAGGED_MIND,
      actorType: event.actorType
    });
    runtime.addTraitProc('Jagged Mind', event.at, event.skillName);
  }
});
