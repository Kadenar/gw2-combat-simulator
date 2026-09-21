import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { ScheduledTask, ScheduledTaskInput, SchedulerTaskAccess } from '#gw2/platform/execution/types.js';

type ReactionSelection<TPayload> = Omit<ScheduledTaskInput<TPayload>, 'type' | 'payload'> & {
  readonly payload: TPayload;
};

interface ReactionContext {
  readonly tasks: SchedulerTaskAccess;
}

interface ReactionDefinition<TContext, TEvent, TPayload> {
  readonly id: string;
  readonly order?: number;
  readonly initialize?: (context: TContext) => void;
  readonly select: (context: TContext, event: TEvent) => ReactionSelection<TPayload> | null;
  readonly execute: (context: TContext, at: number, payload: TPayload) => void;
}

/** Captures one chronological reaction; definitions own callbacks and the existing queue owns ordering and cancellation. */
export function scheduledReaction<TContext extends ReactionContext, TEvent, TPayload extends object>(
  definition: ReactionDefinition<TContext, TEvent, TPayload>
) {
  if (!definition.id.trim()) throw new TypeError('Scheduled reactions require an id.');
  const handler = (context: TContext, task: ScheduledTask<TPayload>): void => {
    if (task.payload == null) throw new TypeError(`Reaction ${definition.id} requires a payload.`);
    definition.execute(context, task.at, task.payload);
  };

  return Object.freeze({
    initialize: definition.initialize
      ? [{ id: `${definition.id}.initialize`, order: definition.order ?? 0, handler: definition.initialize }]
      : [],
    onEventScheduled: Object.freeze({
      id: definition.id,
      order: definition.order ?? 0,
      handler(context: TContext, event: TEvent): boolean {
        const selection = definition.select(context, event);
        if (!selection) return false;
        context.tasks.schedule({ ...selection, type: definition.id });
        return true;
      }
    }),
    taskHandlers: Object.freeze({ [definition.id]: handler })
  });
}

/** Resolves event identity only at execution so replacements supply current facts without replaying a captured event. */
export function eventReaction<
  TContext extends ReactionContext & { eventByOrder(order: number): SimulationEvent | undefined },
  TEvent extends SimulationEvent = SimulationEvent,
  TPayload extends { readonly eventOrder: number } = { readonly eventOrder: number }
>(
  definition: Omit<ReactionDefinition<TContext, TEvent, TPayload>, 'execute'> & {
    readonly missingEvent: 'skip' | 'error';
    readonly execute: (context: TContext, event: SimulationEvent, at: number, payload: TPayload) => void;
  }
) {
  return scheduledReaction({
    ...definition,
    execute(context: TContext, at: number, payload: TPayload) {
      const event = context.eventByOrder(payload.eventOrder);
      if (!event) {
        if (definition.missingEvent === 'error') {
          throw new TypeError(`Reaction ${definition.id} requires a scheduled event (${payload.eventOrder}).`);
        }

        return;
      }

      definition.execute(context, event, at, payload);
    }
  });
}
