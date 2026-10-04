import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';

/** A profession selects its live pool and tuning; shared operations never assume Core owns endurance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The shared registry erases profession state; each owner declares its concrete TContext.
export interface EndurancePolicy<TContext = MechanicContext<any>> {
  state(context: TContext): { endurance: number; enduranceUpdatedAt: number };
  maximum(context: unknown): number;
  regenerationRate(context: TContext, vigor: boolean, at: number): number;
  regenerationBoundaries?(context: TContext): readonly number[];
}
