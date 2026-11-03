import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { MechanicContext, MechanicQueryContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { ProfessionDefinition } from '#gw2/platform/profession-definition/types.js';
import type { createEffectDelivery } from '#gw2/platform/resolver/effect-delivery.js';
import type { EffectReactionRegistry } from '#gw2/platform/resolver/effect-reactions.js';
import type { MechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { mapGw2Reactions } from '#gw2/platform/resolver/reaction-registry.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type {
  Gw2ResolverReactionRegistry,
  Gw2ResolverReactions,
  Gw2ResolverStage,
  Gw2ResolverStageDetails
} from '#gw2/platform/resolver/types.js';

// Notification results cannot be consumed as patches; the pre-hit stage remains a transform.
export function checkReactionResults(
  registry: Gw2ResolverReactionRegistry,
  runtime: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  reactions: Gw2ResolverReactions,
  details: NativeResolvedDamageDetails
) {
  const updates: Record<string, unknown> | void = registry.dispatch('damage.resolving', runtime, event, undefined);
  const notification: void = registry.dispatch('damage.resolved', runtime, event, details);
  reactions['damage.resolved']?.(runtime, event, details) satisfies void;
  // Context mapping retains each stage's payload and return type through the shared wrapper.
  const mapped = mapGw2Reactions<Gw2ResolverRuntime, { runtime: Gw2ResolverRuntime }>(
    reactions,
    (_stage, handler) => (context, actual, facts) => handler(context.runtime, actual, facts)
  );
  mapped['damage.resolved']?.({ runtime }, event, details) satisfies void;
  mapped['damage.resolving']?.({ runtime }, event, undefined) satisfies Record<string, unknown> | void;
  // @ts-expect-error Mapping cannot erase the required damage facts.
  mapped['damage.resolved']?.({ runtime }, event, {});
  // @ts-expect-error Mapping cannot attach damage facts to a control notification.
  mapped['control.resolved']?.({ runtime }, event, details);
  runtime.dispatchReaction('damage.resolved', event, details) satisfies void;
  // @ts-expect-error Notification dispatch does not return an event patch.
  const patch: Record<string, unknown> = registry.dispatch('buff.applied', runtime, event, undefined);
  return { updates, notification, patch };
}

export function checkMechanicReaction(services: MechanicCombatServices, event: Gw2ResolverEvent) {
  services.react('aura.applied', event, undefined) satisfies void;
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

// Every entry point must preserve the pairing, including forwarding a stage whose value is not narrowed yet.
export function checkStagePayloads(
  registry: Gw2ResolverReactionRegistry,
  runtime: Gw2ResolverRuntime,
  services: MechanicCombatServices,
  event: Gw2ResolverEvent,
  damage: NativeResolvedDamageDetails,
  condition: Gw2ResolverStageDetails['condition.applied'],
  stage: Gw2ResolverStage,
  effects: EffectReactionRegistry<object>,
  mechanics: { mechanics: MechanicContext; mechanicQueries: MechanicQueryContext },
  delivery: ReturnType<typeof createEffectDelivery>
) {
  registry.dispatch('condition.applied', runtime, event, condition) satisfies void;
  services.react('damage.resolved', event, damage) satisfies void;
  effects.dispatch(mechanics, 'damage.resolved', event, damage);
  delivery.react(registry, 'damage.resolved', runtime, event, damage) satisfies void;
  // @ts-expect-error Damage dispatch requires resolved-hit facts.
  registry.dispatch('damage.resolved', runtime, event);
  // @ts-expect-error Empty details cannot stand in for a resolved hit.
  registry.dispatch('damage.resolved', runtime, event, {});
  // @ts-expect-error Chance alone cannot stand in for the sampled hit.
  registry.dispatch('damage.resolved', runtime, event, { criticalChance: 1 });
  // @ts-expect-error Condition details do not satisfy the damage stage.
  registry.dispatch('damage.resolved', runtime, event, condition);
  // @ts-expect-error Boon notifications have no hit payload.
  registry.dispatch('buff.applied', runtime, event, damage);
  // @ts-expect-error A union stage cannot accept an independently chosen damage payload.
  registry.dispatch(stage, runtime, event, damage);
  // @ts-expect-error The runtime facade must require the same resolved facts.
  runtime.dispatchReaction('damage.resolved', event, {});
  // @ts-expect-error The mechanic facade must require the same resolved facts.
  services.react('damage.resolved', event, {});
  // @ts-expect-error Forwarding cannot decouple a union stage from its payload.
  services.react(stage, event, damage);
  // @ts-expect-error Effect dispatch cannot accept fictitious hit facts for condition applications.
  effects.dispatch(mechanics, 'condition.applied', event, damage);
  // @ts-expect-error Delivery cannot erase the stage/detail pairing.
  delivery.react(registry, 'damage.resolved', runtime, event, {});
}
