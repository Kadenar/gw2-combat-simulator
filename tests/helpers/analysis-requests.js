/** Request tests capture only simulation inputs; presentation state and browser visibility cannot affect preparation. */
export function captureAnalysisFixture(source, adapter = source.adapter) {
  return adapter.captureAnalysis({
    build: source.build,
    patch: source.patch,
    simulationSettings: source.simulationSettings,
    scenario: source.workspace?.scenario,
    damageDiagnostics: source.damageDiagnostics
  });
}
