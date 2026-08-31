import { createEventReactions } from '#gw2/platform/engine/profession/contract.js';

import type {
  Gw2ResolverReaction,
  Gw2ResolverReactionContributions,
  Gw2ResolverReactionRegistry,
  Gw2ResolverReactions,
  Gw2ResolverEvent,
  Gw2ResolverRuntime,
  Gw2ResolverStage
} from '#gw2/platform/resolver/types.js';

type AuthoringHandler = (...args: never[]) => unknown;

interface AuthoringHook {
  readonly id: string;
  readonly order?: number;
  readonly handler: AuthoringHandler;
}

type AuthoringSource = AuthoringHandler | AuthoringHook | readonly (AuthoringHandler | AuthoringHook)[];

export const GW2_RESOLVER_STAGES: readonly Gw2ResolverStage[] = Object.freeze([
  'aura.applied',
  'combo.resolved',
  'buff.applied',
  'damage.resolved',
  'condition.applied',
  'condition-tick.resolved',
  'control.resolved',
  'blind.resolved',
  'peitha.resolved',
  'weakness-vulnerability.resolved',
  'weapon-set.changed',
  'food-proc.created'
]);

const STAGES = new Set<string>(GW2_RESOLVER_STAGES);

function assertStage(value: string): asserts value is Gw2ResolverStage {
  if (!STAGES.has(value)) {
    throw new TypeError(`Unknown GW2 resolver stage: ${value}.`);
  }
}

function assertAuthoringHook(value: unknown, label: string): void {
  if (typeof value === 'function') return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a function or ordered hook.`);
  }

  const hook = value as Partial<AuthoringHook>;
  if (!String(hook.id || '').trim() || typeof hook.handler !== 'function') {
    throw new TypeError(`${label} must have an id and handler.`);
  }

  if (hook.order != null && !Number.isFinite(Number(hook.order))) {
    throw new TypeError(`${label} order must be finite.`);
  }
}

/**
 * Validates a direct GW2 reaction declaration without widening its specialized
 * handler signatures. Ordered hook collections remain supported because the
 * engine profession composer normalizes them before resolver construction.
 */
export function defineGw2ResolverReactions<const T extends Readonly<Record<string, AuthoringSource>>>(
  reactions: T & Record<Exclude<keyof T, Gw2ResolverStage>, never>
): Readonly<T> {
  if (!reactions || typeof reactions !== 'object' || Array.isArray(reactions)) {
    throw new TypeError('GW2 resolver reactions must be an object.');
  }

  for (const [stage, source] of Object.entries(reactions)) {
    assertStage(stage);
    const hooks = Array.isArray(source) ? source : [source];
    hooks.forEach((hook, index) => assertAuthoringHook(hook, `GW2 resolver reaction ${stage}[${index}]`));
  }

  return Object.freeze({ ...reactions });
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

  const sources = Object.fromEntries(
    GW2_RESOLVER_STAGES.flatMap((stage) => {
      const hooks = [...(contributions[stage] || [])];
      const profession = professionReactions[stage];
      if (profession) {
        hooks.push({
          id: `profession.${stage}`,
          order: 0,
          handler: profession
        });
      }

      return hooks.length ? [[stage, hooks]] : [];
    })
  );
  const dispatchers = createEventReactions(sources);

  return Object.freeze({
    dispatch(stage: Gw2ResolverStage, context: Gw2ResolverRuntime, event: Gw2ResolverEvent, details = {}) {
      assertStage(stage);
      const dispatcher = dispatchers[stage] as Gw2ResolverReaction | undefined;
      return dispatcher?.(context, event, details);
    }
  });
}
