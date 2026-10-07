import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { DiscreteResourceClock, ResourceClock } from '#gw2/platform/combat/resources/clock.js';

/** Profession resource contributions: the policies a profession declares and the live controllers built from them. */

/** Resource keys belong under the existing capability container, never alongside profession state. */
export const RESOURCE_KEYS = [
  'tomePages',
  'arrows',
  'initiative',
  'malice',
  'heat',
  'shadowForce',
  'astralForce',
  'energy',
  'catalystEnergy',
  'motivation',
  'affinity',
  'windForce',
  'adrenaline',
  'flow',
  'dragonCharges',
  'familiarCharges',
  'empoweredCharges',
  'blades',
  'notes',
  'lifeForce'
] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The shared registry erases profession state; each owner declares its concrete TContext.
export interface ResourcePolicy<TContext = MechanicContext<any>> {
  readonly kind: 'continuous' | 'discrete';
  readonly depletion?: { refresh(context: TContext): void; stop(context: TContext): void };
  readonly recoveryMaximum?: (context: TContext) => number;
  readonly changed?: (context: TContext, at: number) => void;
  readonly nextChange?: (context: TContext, cost: number) => number;
  state(context: TContext): ResourceClock | DiscreteResourceClock;
  maximum(context: TContext): number;
  initial(context: TContext, maximum: number): number;
  recovery(context: TContext): number | { interval: number; amount: number; start: 'immediate' | 'first-spend' };
}
export type ResourcePolicies = Partial<Record<ResourceKey, ResourcePolicy>>;

/** Live pools selected by the profession's policies; every mutation settles the old segment before changing it. */
export interface ResourceController {
  initialize(): void;
  advance(): void;
  value(key: ResourceKey): number;
  refresh(key: ResourceKey): void;
  /** Resets and conversions replace the settled balance without restarting recovery or emitting reward semantics. */
  replace(key: ResourceKey, value: number): void;
  grant(key: ResourceKey, value: number): void;
  spend(key: ResourceKey, value: number): void;
  /** The earliest time the pool can pay the cost, or null when recovery never reaches it. */
  readyAt(key: ResourceKey, cost: number): number | null;
}

/** A profession selects its live pool and tuning; shared operations never assume Core owns endurance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The shared registry erases profession state; each owner declares its concrete TContext.
export interface EndurancePolicy<TContext = MechanicContext<any>> {
  state(context: TContext): ResourceClock;
  maximum(context: unknown): number;
  regenerationRate(context: TContext, vigor: boolean, at: number): number;
  regenerationBoundaries?(context: TContext): readonly number[];
}

/** The live endurance pool; readiness projects Vigor-aware regeneration without settling the clock. */
export interface EnduranceController {
  advance(): void;
  readyAt(cost: number): number | null;
  /** Returns false when the profession models no endurance pool. */
  grant(value: number): boolean;
  spend(value: number): void;
}

/** Validate executable declarations before previews call them or simulation initializes live pools. */
export function validateResourcePolicies(resources: ResourcePolicies = {}, endurance?: EndurancePolicy): void {
  for (const key of Object.keys(resources) as ResourceKey[]) {
    if (!RESOURCE_KEYS.includes(key)) throw new TypeError(`Unknown resource policy: ${key}.`);
    const policy = resources[key];
    if (policy == null) continue;
    if (
      !['continuous', 'discrete'].includes(policy.kind) ||
      ['state', 'maximum', 'initial', 'recovery'].some(
        (key) => typeof policy[key as keyof ResourcePolicy] !== 'function'
      )
    )
      throw new TypeError(`Resource policies require kind, state, maximum, initial, and recovery (${key}).`);
  }

  if (
    endurance != null &&
    ['state', 'maximum', 'regenerationRate'].some(
      (key) => typeof endurance[key as keyof EndurancePolicy] !== 'function'
    )
  )
    throw new TypeError('Endurance requires state, maximum, and regenerationRate callbacks.');
}
