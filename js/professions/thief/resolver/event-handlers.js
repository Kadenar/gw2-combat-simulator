function handleThiefState(context, event) {
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
  };
  Object.assign(context.profession, structuredClone(event.state || {}), preserved);
}
export const thiefResolverEventHandlers = Object.freeze({
  "thief.state": handleThiefState,
});

