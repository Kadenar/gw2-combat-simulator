import { captureAnalysisFixture } from '#tests/helpers/analysis-requests.js';

/** Standalone contribution checks explicitly score their baseline before requesting omission comparisons. */
export function modifierContributionRequest(app, adapter) {
  const snapshot = captureAnalysisFixture(app, adapter);
  const baseline = snapshot.baseline({ collectChartData: false, comparePatch: false });
  const { result } = adapter.calculateBaselineSimulation(baseline);
  return snapshot.modifiers(result.dps);
}

/** Candidate and comparison-config checks never merge scores, so they skip the baseline simulation. */
export function modifierComparisonRequest(app, adapter) {
  return captureAnalysisFixture(app, adapter).modifiers(0);
}
