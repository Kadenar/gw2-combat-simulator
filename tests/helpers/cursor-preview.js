/** Supplies detached accepted inputs for tests that replace preview execution or exercise the real runtime. */
import { captureAnalysisFixture } from '#tests/helpers/analysis-requests.js';

export function cursorPreviewCapture(rotation, baseConfig = {}) {
  const request = structuredClone({ rotation, baseConfig });
  return () => ({ inputs: { baseline: () => structuredClone(request) } });
}

export function prepareCursorPreviewFixture(app) {
  const inputs = captureAnalysisFixture(app);
  app.analysis.capture = () => ({ inputs });

  if (!app.analysis.state.results) {
    app.analysis.state.results = app.adapter.calculateBaselineSimulation(
      inputs.baseline({ collectChartData: false, comparePatch: false })
    ).result;
  }

  return app;
}
