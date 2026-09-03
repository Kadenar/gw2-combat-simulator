import { buildChartSeries } from '#gw2/app/rotation/result/model.js';
import { buildRelicComparisonModel } from '#gw2/app/simulation/relic-comparison.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/**
 * Drives the opt-in Relic of Thorns break-even comparison. Unlike the RNG and
 * modifier-contribution runners this needs only a single extra simulation — the
 * opponent curve is the result already on screen, and the two cumulative
 * average-DPS series come straight from the chart transform — so it runs on the
 * main thread behind a `setTimeout(0)` yield rather than a worker pool. It never
 * runs on its own: `schedule` only publishes availability, and `run` fires the
 * extra simulation when the user asks for it.
 */
export class RelicComparisonRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  requestId: number;
  initialStacks: number;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.timer = null;
    this.requestId = 0;
    this.initialStacks = 0;
  }

  /**
   * Publishes whether a comparison is available for the equipped relic and
   * invalidates any in-flight run. Does not simulate — the comparison is opt-in
   * to avoid the cost of a second simulation on every edit.
   */
  schedule(): void {
    const app = this.app;
    this.requestId += 1;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const results = app.results;
    if (!results) return;

    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app) : null;
    if (!request) {
      results.relicComparisonAvailable = false;
      results.relicComparisonStale = false;
      results.relicComparisonError = '';
      results.relicComparison = undefined;
      results.relicComparisonOpponent = '';
      return;
    }

    results.relicComparisonAvailable = true;
    results.relicComparisonInitialStacks = this.initialStacks;
    results.relicComparisonStale = false;
    results.relicComparisonError = '';
    // A cached model is only meaningful for the opponent it was computed against.
    if (results.relicComparison && results.relicComparisonOpponent !== request.opponentRelic) {
      results.relicComparison = undefined;
    }

    results.relicComparisonOpponent = request.opponentRelic;
  }

  /** Runs the single comparison simulation and renders the break-even chart. */
  run(initialStacks: number = this.initialStacks): void {
    const app = this.app;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;

    const results = app.results;
    if (!results) return;
    // User-entered stacks are whole and capped by the relic's in-game maximum.
    this.initialStacks = Math.min(10, Math.max(0, Math.trunc(Number(initialStacks) || 0)));
    results.relicComparisonInitialStacks = this.initialStacks;
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app) : null;
    if (!request) {
      this.schedule();
      app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
      return;
    }

    // The opponent curve is the result already on screen (same deterministic
    // baseline, equipped relic). Capture it before the async yield.
    const opponentResult = results;
    results.relicComparisonAvailable = true;
    results.relicComparisonStale = true;
    results.relicComparisonError = '';
    results.relicComparisonOpponent = request.opponentRelic;
    app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));

    this.timer = setTimeout(() => {
      this.timer = null;
      if (requestId !== this.requestId || !app.results) return;
      try {
        const thornsResult = app.adapter.simulateBuild(request.rotation, {
          ...request.baseConfig,
          relic: request.comparisonRelic,
          initialThornsStacks: this.initialStacks
        });
        const opponentSeries = buildChartSeries(opponentResult);
        const thornsSeries = buildChartSeries(thornsResult);
        const model = buildRelicComparisonModel({
          opponentRelic: request.opponentRelic,
          durationMs: Math.max(opponentSeries.durationMs, thornsSeries.durationMs),
          opponentDps: opponentSeries.dps,
          thornsDps: thornsSeries.dps
        });
        if (requestId !== this.requestId || !app.results) return;
        app.results.relicComparison = model;
        app.results.relicComparisonStale = false;
        app.results.relicComparisonError = '';
        app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
      } catch (error) {
        if (requestId !== this.requestId || !app.results) return;
        app.results.relicComparisonStale = false;
        app.results.relicComparisonError =
          error instanceof Error ? error.message : String(error || 'Relic comparison failed.');
        app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
      }
    }, 0);
  }
}
