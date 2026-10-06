import { splitStrikeHits } from '#gw2/platform/effects/packet-builders.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Cast and trait effects supply their own attribution; pet ownership is captured by the pet producer. */
export function buildRangerPacket(
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
export function buildRangerStrikes(event: SimulationEventBase): SimulationEventBase[] {
  return splitStrikeHits({ ...event, type: 'damage', coefficient: Number(event.coefficient) });
}
