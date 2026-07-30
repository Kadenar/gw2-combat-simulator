export const seconds = (ms) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

export const professionEndState = (result) =>
  result?.endState?.profession || {};

export const activeSpecialization = (app) =>
  app.adapter.eliteSpecialization(app.build);
