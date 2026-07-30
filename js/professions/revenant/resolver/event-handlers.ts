import type {
  RevenantResolverContext,
  RevenantResolverEvent,
} from "../types.js";

function handleRevenantState(
  context: RevenantResolverContext,
  event: RevenantResolverEvent,
): void {
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
  };
  Object.assign(context.profession, structuredClone(event.state || {}), preserved);
}
export const revenantResolverEventHandlers = Object.freeze({
  "revenant.state": handleRevenantState,
});

