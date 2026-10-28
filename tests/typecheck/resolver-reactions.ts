import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { ProfessionDefinition } from '#gw2/platform/profession-definition/types.js';
import type { MechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverReactionRegistry, Gw2ResolverReactions } from '#gw2/platform/resolver/types.js';

// Notification results cannot be consumed as patches; the pre-hit stage remains a transform.
export function checkReactionResults(
  registry: Gw2ResolverReactionRegistry,
  runtime: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  reactions: Gw2ResolverReactions
) {
  const updates: Record<string, unknown> | void = registry.dispatch('damage.resolving', runtime, event);
  const notification: void = registry.dispatch('damage.resolved', runtime, event);
  reactions['damage.resolved']?.(runtime, event, {}) satisfies void;
  runtime.dispatchReaction('damage.resolved', event) satisfies void;
  // @ts-expect-error Notification dispatch does not return an event patch.
  const patch: Record<string, unknown> = registry.dispatch('buff.applied', runtime, event);
  return { updates, notification, patch };
}

export function checkMechanicReaction(services: MechanicCombatServices, event: Gw2ResolverEvent) {
  services.react('aura.applied', event) satisfies void;
}

// Planning projection accepts its observation input directly, not an ordered modifier descriptor.
export const projection: ProfessionDefinition<{ count: number }> = {
  id: 'projection',
  name: 'Projection',
  resources: { projectPlanningState: ({ profession }) => ({ count: profession.count }) }
};

export const invalidProjection: ProfessionDefinition = {
  id: 'invalid-projection',
  name: 'Invalid projection',
  resources: {
    // @ts-expect-error Projection is a single callback, never an ordered hook list.
    projectPlanningState: [() => ({})]
  }
};
