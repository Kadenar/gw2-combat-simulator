import type { ResourceClock } from '#gw2/platform/combat/resources/clock.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';

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
