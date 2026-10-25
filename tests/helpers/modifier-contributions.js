/** Standalone contribution checks explicitly score their baseline before requesting omission comparisons. */
export function modifierContributionRequest(app, adapter) {
  const baseline = adapter.baselineSimulationRequest(app);
  const { result } = adapter.calculateBaselineSimulation(baseline);
  return adapter.modifierContributionRequest(app, result.dps);
}

/** Candidate and comparison-config checks never merge scores, so they skip the baseline simulation. */
export function modifierComparisonRequest(app, adapter) {
  return adapter.modifierContributionRequest(app, 0);
}
