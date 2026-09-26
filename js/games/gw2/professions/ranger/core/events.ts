import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boons.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Delayed boons sample duration at application, while ordinary packets retain their causal queue time. */
export function emitRangerBuff(runtime: RangerRuntime, event: SimulationEventBase): void {
  if (event.at > runtime.time) {
    runtime.schedule('ranger.buff', event.at, event);
    return;
  }

  const kind = String(event.kind ?? '');
  runtime.emit({
    ...event,
    type: 'buff',
    duration: isStandardBoon(kind)
      ? gw2ResolverBoonDuration(runtime, event as Gw2ResolverEvent, kind, Number(event.duration))
      : event.duration
  });
}

/** Cast and trait effects supply their own attribution; pet ownership is captured by the pet producer. */
export function rangerEvent(
  fields: Pick<SimulationEventBase, 'at'> & Partial<SimulationEventBase>,
  type: string
): Gw2ResolverEvent {
  return {
    source: 'ranger',
    sourceId: fields.skillId ?? 'ranger',
    actorType: 'player',
    name: fields.skillName,
    ...fields,
    type
  } as Gw2ResolverEvent;
}

/** A proc's total coefficient is divided into ordered hits, each with an independent resolved-hit fact. */
export function emitRangerDamage(runtime: RangerRuntime, event: SimulationEventBase): void {
  const hits = Math.max(1, Math.trunc(Number(event.hits ?? 1)));
  for (let index = 1; index <= hits; index++)
    runtime.emit({
      ...event,
      type: 'damage',
      coefficient: Number(event.coefficient) / hits,
      hits: 1,
      hitIndex: event.hitIndex ?? index,
      totalHits: event.totalHits ?? hits
    });
}
