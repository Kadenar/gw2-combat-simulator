import type { SkillId } from '#gw2/platform/skills/types.js';

/**
 * A gameplay boundary owned by one mechanic. The mechanic decides that the boundary happened and fires it; its order
 * list is the complete listener sequence, so the reactions to one boundary read in one place instead of in a dispatcher.
 */
export interface TriggerPoint<TInput extends object = object> {
  readonly kind: 'trigger-point';
  readonly id: string;
  readonly order: readonly SkillId[];
  /** Type witness for listener inputs; never present at runtime. */
  readonly input?: TInput;
}

/** The read-only input a point's listeners receive. */
export type TriggerPointInput<TPoint> = TPoint extends TriggerPoint<infer TInput> ? TInput : never;

const POINT_ID = /^[a-z]+\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Declare a point beside its mechanic; trait IDs keep the order list free of trait-code imports. */
export function defineTriggerPoint<TInput extends object>(id: string, order: readonly SkillId[]): TriggerPoint<TInput> {
  if (typeof id !== 'string' || !POINT_ID.test(id))
    throw new TypeError(`Trigger point ${id} must be named <profession>.<boundary>.`);
  if (!Array.isArray(order) || !order.length) throw new TypeError(`Trigger point ${id} requires a listener order.`);
  const listed = new Set<string>();
  for (const trait of order) {
    if (
      !['string', 'number'].includes(typeof trait) ||
      !String(trait).trim() ||
      (typeof trait === 'number' && !Number.isFinite(trait))
    )
      throw new TypeError(`Trigger point ${id} lists an invalid trait.`);
    if (listed.has(String(trait))) throw new TypeError(`Trigger point ${id} lists trait ${trait} twice.`);
    listed.add(String(trait));
  }

  return Object.freeze({ kind: 'trigger-point', id, order: Object.freeze([...order]) });
}

/** Distinguish point listeners from listeners on platform stages, which are named by string. */
export function isTriggerPoint(value: unknown): value is TriggerPoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<TriggerPoint>).kind === 'trigger-point' &&
    typeof (value as Partial<TriggerPoint>).id === 'string'
  );
}
