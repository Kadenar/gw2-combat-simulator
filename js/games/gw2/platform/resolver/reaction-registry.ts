import type {
  Gw2ResolverReactionContributions,
  Gw2ResolverReactionRegistry,
  Gw2ResolverReactions,
  Gw2ResolverStage
} from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

export const GW2_RESOLVER_STAGES: readonly Gw2ResolverStage[] = Object.freeze([
  'aura.applied',
  'combo.resolved',
  'buff.applied',
  'damage.resolving',
  'damage.resolved',
  'condition.applied',
  'condition-tick.resolved',
  'control.resolved'
]);

const STAGES = new Set<string>(GW2_RESOLVER_STAGES);

function assertStage(value: string): asserts value is Gw2ResolverStage {
  if (!STAGES.has(value)) {
    throw new TypeError(`Unknown GW2 resolver stage: ${value}.`);
  }
}

function assertKnownStages(value: object, label: string): void {
  for (const stage of Object.keys(value)) {
    try {
      assertStage(stage);
    } catch {
      throw new TypeError(`${label} contains unknown stage: ${stage}.`);
    }
  }
}

/** Module and registry composition share patch propagation; notifications never forward returned objects. */
export function composeGw2Reactions<TContext>(
  sources: readonly Gw2ResolverReactions<TContext>[]
): Gw2ResolverReactions<TContext> {
  for (const source of sources) assertKnownStages(source, 'GW2 reactions');

  const notifications = Object.fromEntries(
    GW2_RESOLVER_STAGES.flatMap((stage) => {
      if (stage === 'damage.resolving') return [];

      const handlers = sources.flatMap((source) => (source[stage] ? [source[stage]] : []));
      return handlers.length
        ? [
            [
              stage,
              (context: TContext, event: Gw2ResolverEvent, details: Record<string, unknown>) => {
                for (const handler of handlers) handler(context, event, details);
              }
            ]
          ]
        : [];
    })
  );
  const transforms = sources.flatMap((source) => (source['damage.resolving'] ? [source['damage.resolving']] : []));

  if (!transforms.length) return Object.freeze(notifications);

  return Object.freeze({
    ...notifications,
    'damage.resolving'(context: TContext, event: Gw2ResolverEvent, details: Record<string, unknown>) {
      let updates: Record<string, unknown> | undefined;
      for (const transform of transforms) {
        const next = transform(context, updates ? { ...event, ...updates } : event, details);

        if (next) updates = { ...updates, ...next };
      }

      return updates;
    }
  });
}

/** Composes profession and common GW2 hooks into one immutable dispatcher. */
export function createGw2ResolverReactionRegistry({
  professionReactions = {},
  contributions = {}
}: {
  readonly professionReactions?: Gw2ResolverReactions;
  readonly contributions?: Gw2ResolverReactionContributions;
} = {}): Readonly<Gw2ResolverReactionRegistry> {
  assertKnownStages(professionReactions, 'GW2 profession reactions');
  assertKnownStages(contributions, 'GW2 reaction contributions');

  const sources = GW2_RESOLVER_STAGES.flatMap((stage) => {
    const hooks = [...(contributions[stage] || [])];
    const profession = professionReactions[stage];

    if (profession) {
      hooks.push({
        id: `profession.${stage}`,
        order: 0,
        handler: profession
      });
    }

    const ids = new Set<string>();
    for (const hook of hooks) {
      if (ids.has(hook.id)) throw new TypeError(`Duplicate reaction ${stage} hook id: ${hook.id}.`);

      if (typeof hook.handler !== 'function') throw new TypeError(`Invalid reaction ${stage} handler: ${hook.id}.`);

      ids.add(hook.id);
    }

    // Stable sorting preserves declaration order on ties, including the profession's position.
    return hooks.sort((left, right) => left.order - right.order).map((hook) => ({ [stage]: hook.handler }));
  });
  const dispatchers = composeGw2Reactions<Gw2ResolverRuntime>(sources);

  return Object.freeze({
    dispatch(stage: Gw2ResolverStage, context: Gw2ResolverRuntime, event: Gw2ResolverEvent, details = {}) {
      assertStage(stage);
      const dispatcher = dispatchers[stage];
      return dispatcher?.(context, event, details);
    }
  });
}
