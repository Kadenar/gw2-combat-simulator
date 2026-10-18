import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';

/**
 * Payload provenance carries timing and selected inputs, without creating or resolving a qualifying attack. Authored
 * damage definitions use it to emit their occurrence, so it stays separate from the isolated execution driver.
 */
export function damageInputEvent(runtime: { readonly time: number }): Gw2ResolverEvent {
  return {
    type: 'proc',
    at: runtime.time,
    source: 'Damage preview',
    sourceId: 'damage:occurrence',
    actorType: ACTOR.EFFECT,
    activationId: 'damage:occurrence',
    skillName: 'Damage preview'
  };
}
