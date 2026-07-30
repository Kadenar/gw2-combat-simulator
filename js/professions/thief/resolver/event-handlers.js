function handleThiefState(context, event) {
  const incoming = structuredClone(event.state || {});
  const sameMistburnGeneration =
    Number(incoming.mistburnGeneration || 0)
    === Number(context.profession.mistburnGeneration || 0);
  const sameSpiderVenomGeneration =
    Number(incoming.spiderVenomGeneration || 0)
    === Number(context.profession.spiderVenomGeneration || 0);
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
    ...(
      sameMistburnGeneration
      && Number(incoming.mistburnExpiresAt || 0) > event.at
        ? {
            mistburnCharges: context.profession.mistburnCharges || 0,
          }
        : {}
    ),
    ...(
      sameSpiderVenomGeneration
      && Number(incoming.spiderVenomExpiresAt || 0) > event.at
        ? {
            spiderVenomCharges:
              context.profession.spiderVenomCharges || 0,
          }
        : {}
    ),
  };
  Object.assign(context.profession, incoming, preserved);
}
export const thiefResolverEventHandlers = Object.freeze({
  "thief.state": handleThiefState,
});

