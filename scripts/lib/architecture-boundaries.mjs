// Lint and platform graph validation share one list of simulation implementation modules.
export const simulationImplementationPattern =
  '^#gw2/platform/simulation/(?:runtime|coordinator|internal-work|combat-execution|simulate|bind-mechanic-context|task-scheduler|occurrence-completion)\\.js$';
