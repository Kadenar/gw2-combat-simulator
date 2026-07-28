function handleEngineerState(context, event) {
  const preserved = {
    traitProcReadyAt: context.profession.traitProcReadyAt || {},
  };
  Object.assign(context.profession, structuredClone(event.state || {}), preserved);
}

export const engineerResolverEventHandlers = Object.freeze({
  "engineer.state": handleEngineerState,
});

