import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type {
  Gw2ResolverDispatchArgs,
  Gw2ResolverReactionContributions,
  Gw2ResolverReactionHook,
  Gw2ResolverReactionRegistry,
  Gw2ResolverReactionResult,
  Gw2ResolverReactions,
  Gw2ResolverStage,
  Gw2ResolverStageDetails
} from '#gw2/platform/resolver/types.js';

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

/** Share stage admission with declaration compilers so unknown keys cannot become silent no-ops. */
export function isGw2ResolverStage(value: unknown): value is Gw2ResolverStage {
  return typeof value === 'string' && STAGES.has(value);
}

function assertStage(value: string): asserts value is Gw2ResolverStage {
  if (!isGw2ResolverStage(value)) {
    throw new TypeError(`Unknown GW2 resolver stage: ${value}.`);
  }
}

/** Validate authored keys before typed traversal so wrappers cannot silently discard unsupported stages. */
function gw2ReactionStages(value: object, label = 'GW2 reactions'): Gw2ResolverStage[] {
  return Object.keys(value).map((stage) => {
    try {
      assertStage(stage);
      return stage;
    } catch {
      throw new TypeError(`${label} contains unknown stage: ${stage}.`);
    }
  });
}

/** Bind or filter handlers without losing their stage-specific payloads or silently dropping unknown keys. */
export function mapGw2Reactions<TSource, TTarget>(
  reactions: Gw2ResolverReactions<TSource>,
  map: <Stage extends Gw2ResolverStage>(
    stage: Stage,
    handler: NonNullable<Gw2ResolverReactions<TSource>[Stage]>
  ) =>
    | ((
        context: TTarget,
        event: Gw2ResolverEvent,
        details: Gw2ResolverStageDetails[Stage]
      ) => Gw2ResolverReactionResult<Stage>)
    | undefined
): Gw2ResolverReactions<TTarget> {
  return Object.fromEntries(
    gw2ReactionStages(reactions).flatMap(<Stage extends Gw2ResolverStage>(stage: Stage) => {
      const handler = reactions[stage];
      const mapped = handler ? map(stage, handler) : undefined;
      return mapped ? [[stage, mapped]] : [];
    })
  );
}

/** Compile ordered handlers once; only pre-hit transforms forward patches, while notifications discard results. */
function composeStage<TContext, Stage extends Gw2ResolverStage>(
  stage: Stage,
  handlers: readonly NonNullable<Gw2ResolverReactions<TContext>[Stage]>[]
): Gw2ResolverReactions<TContext>[Stage] {
  if (!handlers.length) return undefined;

  // Stage and handlers are gathered together; only the transform stage may return accumulated updates.
  const composed = (context: TContext, event: Gw2ResolverEvent, details: Gw2ResolverStageDetails[Stage]) => {
    let updates: Record<string, unknown> | undefined;
    for (const handler of handlers) {
      const next = handler(context, updates ? { ...event, ...updates } : event, details);

      if (stage === 'damage.resolving' && next) updates = { ...updates, ...next };
    }

    return updates;
  };

  return composed as NonNullable<Gw2ResolverReactions<TContext>[Stage]>;
}

/** Modules contribute independent stage sets; gather each stage before sharing the dispatch compiler. */
export function composeGw2Reactions<TContext>(
  sources: readonly Gw2ResolverReactions<TContext>[]
): Gw2ResolverReactions<TContext> {
  for (const source of sources) gw2ReactionStages(source, 'GW2 reactions');

  return Object.freeze(
    Object.fromEntries(
      GW2_RESOLVER_STAGES.flatMap(<Stage extends Gw2ResolverStage>(stage: Stage) => {
        const handlers = sources.flatMap((source) => (source[stage] ? [source[stage]] : []));
        const dispatcher = composeStage(stage, handlers);
        return dispatcher ? [[stage, dispatcher]] : [];
      })
    )
  );
}

/** Composes profession and common GW2 hooks into one immutable dispatcher. */
export function createGw2ResolverReactionRegistry({
  professionReactions = {},
  contributions = {}
}: {
  readonly professionReactions?: Gw2ResolverReactions;
  readonly contributions?: Gw2ResolverReactionContributions;
} = {}): Readonly<Gw2ResolverReactionRegistry> {
  gw2ReactionStages(professionReactions, 'GW2 profession reactions');
  gw2ReactionStages(contributions, 'GW2 reaction contributions');

  const dispatchers: Gw2ResolverReactions = Object.fromEntries(
    GW2_RESOLVER_STAGES.flatMap(<Stage extends Gw2ResolverStage>(stage: Stage) => {
      const hooks: Gw2ResolverReactionHook<Stage>[] = [...(contributions[stage] || [])];
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
      const handlers = hooks.sort((left, right) => left.order - right.order).map((hook) => hook.handler);
      const dispatcher = composeStage<Gw2ResolverRuntime, Stage>(stage, handlers);
      return dispatcher ? [[stage, dispatcher]] : [];
    })
  );

  // Narrow the correlated call once at dispatch; no handler receives another stage's payload.
  function dispatch<Args extends Gw2ResolverDispatchArgs>(...args: Args): Gw2ResolverReactionResult<Args[0]>;
  function dispatch(...[stage, context, event, details]: Gw2ResolverDispatchArgs): Record<string, unknown> | void {
    assertStage(stage);
    switch (stage) {
      case 'aura.applied':
      case 'combo.resolved':
      case 'buff.applied':
      case 'damage.resolving':
        return dispatchers[stage]?.(context, event, details);
      case 'damage.resolved':
        return dispatchers[stage]?.(context, event, details);
      case 'condition.applied':
        return dispatchers[stage]?.(context, event, details);
      case 'condition-tick.resolved':
        return dispatchers[stage]?.(context, event, details);
      case 'control.resolved':
        return dispatchers[stage]?.(context, event, details);
      default:
        // A newly declared stage must gain a dispatch branch before the registry can compile.
        throw new TypeError(`Unhandled GW2 resolver stage: ${stage satisfies never}.`);
    }
  }

  return Object.freeze({ dispatch });
}
