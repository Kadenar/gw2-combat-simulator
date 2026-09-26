import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import { canonicalTime } from '#kernel/core/clock.js';
import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';

/** Delayed boons sample live duration and companions; retired clones cannot publish their pending packets. */
export function emitMesmerPacket(runtime: MesmerRuntime, event: SimulationEventBase): SimulationEvent | null {
  const ownerId =
    typeof event.summonOwner === 'string' && event.summonOwner.startsWith('mesmer.clone:')
      ? event.summonOwner
      : event.metadata?.cloneId != null
        ? `mesmer.clone:${event.metadata.cloneId}`
        : null;
  if (canonicalTime(event.at) > runtime.time && (event.type === 'buff' || ownerId)) {
    runtime.schedule(
      'mesmer.packet',
      event.at,
      event,
      ownerId ? { id: ownerId, generation: 0 } : undefined,
      Number(event.priority ?? 0)
    );
    return null;
  }

  if (event.type === 'buff' && event.fixedDuration !== true) {
    event = {
      ...event,
      duration: gw2ResolverBoonDuration(runtime, event as Gw2ResolverEvent, String(event.kind), Number(event.duration))
    };
  }

  return runtime.emit(event);
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
