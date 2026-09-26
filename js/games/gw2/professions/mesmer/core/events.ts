import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';

/** Clone-owned packets wait under their clone's lifetime, so a retired clone cannot publish its pending packets. */
export function emitMesmerPacket(runtime: MesmerRuntime, event: SimulationEventBase): SimulationEvent | null {
  const ownerId =
    typeof event.summonOwner === 'string' && event.summonOwner.startsWith('mesmer.clone:')
      ? event.summonOwner
      : event.metadata?.cloneId != null
        ? `mesmer.clone:${event.metadata.cloneId}`
        : null;
  return runtime.emitProcedural(event, {
    ...(ownerId ? { owner: { id: ownerId, generation: 0 } } : {}),
    priority: Number(event.priority ?? 0)
  });
}

/** Materializes state-selected profile effects through the same cast attribution as procedural strikes. */
export function emitMesmerEffects(runtime: MesmerRuntime, skill: MesmerSkill, start: number, fullEnd: number): void {
  for (const effect of skill.effects ?? [])
    for (const { event } of materializeSkillEffectApplications({
      skill,
      effect,
      start,
      fullEnd,
      baseEvent: { source: 'Player', sourceId: skill.id, actorType: 'player', skillId: skill.id, skillName: skill.name }
    }))
      mesmerMechanicsFor(runtime).addEvent(event as MesmerEventExtra & { type: string; at: number });
}
