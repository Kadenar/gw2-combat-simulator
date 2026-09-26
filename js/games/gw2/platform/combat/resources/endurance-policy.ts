import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';

/** A profession selects its live pool and tuning; shared operations never assume Core owns endurance. */
export interface EndurancePolicy<TContext = Gw2Runtime<any>> {
  state(context: TContext): { endurance: number; enduranceUpdatedAt: number };
  maximum(context: unknown): number;
  regenerationRate(context: TContext, vigor: boolean, at: number): number;
  regenerationBoundaries?(context: TContext): readonly number[];
}
