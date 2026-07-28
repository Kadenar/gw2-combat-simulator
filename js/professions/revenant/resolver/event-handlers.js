function handleRevenantState(context, event) {
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
  };
  Object.assign(context.profession, structuredClone(event.state || {}), preserved);
}
export const revenantResolverEventHandlers = Object.freeze({
  "revenant.state": handleRevenantState,
});

