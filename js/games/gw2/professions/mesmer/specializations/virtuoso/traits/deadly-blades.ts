import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';

import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import type { MesmerCastContext, MesmerSchedulerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';

/** Activates Deadly Blades only after a successfully resolved Virtuoso Bladesong. */
export function resolveDeadlyBlades(context: MesmerCastContext, resolution: MesmerShatterResolution): void {
  const runtime = mesmerRuntimeFor(context);
  if (!runtime.traits.has(TRAIT.DEADLY_BLADES)) return;

  const at = resolution.at;
  const deadlyBladesProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_BLADES);
  runtime.addEvent({
    type: 'buff',
    at,
    // Deadly Blades starts after the Bladesong's same-time resolution work.
    priority: 5,
    kind: 'deadly-blades',
    stacks: 1,
    duration: balanceProfileNumber(deadlyBladesProfile, 'durationMultiplier')
  });
  runtime.addTraitProc('Deadly Blades', at, resolution.skill.name);
}

/** Resolve blade-critical effects from the canonical hit after shared critical materialization. */
export const deadlyBladesReaction = eventReaction<MesmerSchedulerContext>({
  id: 'mesmer.deadly-blades-critical',
  order: 20,
  missingEvent: 'error',
  select(context, event) {
    const runtime = mesmerRuntimeFor(context);
    if (event.type !== 'damage' || !isGw2PlayerActorEvent(event) || !runtime.traits.has(TRAIT.DEADLY_BLADES))
      return null;
    const skill = runtime.skillsById.get(Number(event.skillId));
    if ((!event.metadata?.blade && !skill?.blade) || event.noCrit || event.canCrit === false) return null;
    return {
      at: Math.max(context.state.time, event.at),
      priority: -40,
      ownerId: event.metadata?.cloneId == null ? null : `mesmer.clone:${event.metadata.cloneId}`,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, canonicalEvent) {
    // Skill-derived eligibility survives replacement, but explicit canonical flags win.
    const event = { ...canonicalEvent };
    if (!Object.hasOwn(event.metadata ?? {}, 'blade')) event.metadata = { ...event.metadata, blade: true };
    const deadlyBladesProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_BLADES);
    const deadlyBlades = requireEffect(deadlyBladesProfile, 'condition', 'Vulnerability');
    if (!deadlyBlades) return;
    // Vulnerability follows the same sampled-or-weighted critical fact as Jagged
    // Mind, but remains a separate trait-owned condition application.
    const application = advanceScheduledCriticalProc(context, event, {
      id: 'mesmer.virtuoso.deadly-blades',
      materialization: 'weighted'
    });
    if (!application) return;

    emitSkillCondition(context, {
      cause: event,

      at: event.at,
      name: 'Deadly Blades — Vulnerability',
      skillName: event.skillName,
      condition: 'Vulnerability',
      stacks: application.quantity * Number(deadlyBlades.stacks),
      duration: Number(deadlyBlades.duration),
      source: 'Trait',
      sourceId: TRAIT.DEADLY_BLADES,
      actorType: 'effect',
      ownerActorType: 'player',
      sourceSkill: event.skillName
    });
  }
});
