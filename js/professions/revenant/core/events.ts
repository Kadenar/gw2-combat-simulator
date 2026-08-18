import { professionCoreState } from '../../../platform/engine/profession.js';
import type { RevenantResolverContext, RevenantResolverEvent } from '../types.js';

export function handleRevenantState(context: RevenantResolverContext, event: RevenantResolverEvent): void {
  const core = professionCoreState(context);
  const specialization = context.profession.specialization.state;
  const preserved = {
    traitProcReadyAt: core.traitProcReadyAt || {}
  };
  for (const [key, value] of Object.entries(event.state || {})) {
    const owner = Object.hasOwn(specialization, key) ? specialization : core;
    (owner as Record<string, unknown>)[key] = structuredClone(value);
  }
  Object.assign(core, preserved);
}
