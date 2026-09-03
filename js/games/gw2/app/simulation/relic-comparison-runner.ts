import { buildChartSeries } from '#gw2/app/rotation/result/model.js';
import { buildRelicComparisonModel } from '#gw2/app/simulation/relic-comparison.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Runs one user-selected relic simulation against the equipped relic already on screen. */
export class RelicComparisonRunner {
  readonly app: ProfessionAppState;
  timer: ReturnType<typeof setTimeout> | null;
  requestId: number;
  comparisonRelic: string;
  initialStacks: number;

  constructor(app: ProfessionAppState) {
    this.app = app;
    this.timer = null;
    this.requestId = 0;
    this.comparisonRelic = '';
    this.initialStacks = 0;
  }

  /** Keeps a valid selection, preferring Thorns as the initial comparison when available. */
  selectedComparisonRelic(requested = this.comparisonRelic): string {
    const alternatives = this.app.relicNames.filter((name) => name !== this.app.build.relic);
    return alternatives.includes(requested)
      ? requested
      : alternatives.includes('Thorns')
        ? 'Thorns'
        : (alternatives[0] ?? '');
  }

  /** Publishes picker availability without paying for another simulation. */
  schedule(): void {
    const app = this.app;
    this.requestId += 1;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const results = app.results;
    if (!results) return;

    this.comparisonRelic = this.selectedComparisonRelic();
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app, this.comparisonRelic) : null;
    if (!request) {
      results.relicComparisonAvailable = false;
      results.relicComparisonStale = false;
      results.relicComparisonError = '';
      results.relicComparison = undefined;
      results.relicComparisonOpponent = '';
      results.relicComparisonTarget = '';
      return;
    }

    results.relicComparisonAvailable = true;
    results.relicComparisonInitialStacks = this.initialStacks;
    results.relicComparisonStale = false;
    results.relicComparisonError = '';
    if (
      results.relicComparison &&
      (results.relicComparison.opponentRelic !== request.opponentRelic ||
        results.relicComparison.targetRelic !== request.comparisonRelic)
    ) {
      results.relicComparison = undefined;
    }

    results.relicComparisonOpponent = request.opponentRelic;
    results.relicComparisonTarget = request.comparisonRelic;
  }

  /** Runs the selected comparison and applies opening stacks only when its target is Thorns. */
  run(comparisonRelic: string = this.comparisonRelic, initialStacks: number = this.initialStacks): void {
    const app = this.app;
    const requestId = ++this.requestId;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;

    const results = app.results;
    if (!results) return;
    this.comparisonRelic = this.selectedComparisonRelic(String(comparisonRelic || ''));
    this.initialStacks = Math.min(10, Math.max(0, Math.trunc(Number(initialStacks) || 0)));
    results.relicComparisonInitialStacks = this.initialStacks;
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app, this.comparisonRelic) : null;
    if (!request) {
      this.schedule();
      app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));
      return;
    }

    const opponentResult = results;
    results.relicComparisonAvailable = true;
    results.relicComparisonStale = true;
    results.relicComparisonError = '';
    results.relicComparisonOpponent = request.opponentRelic;
    results.relicComparisonTarget = request.comparisonRelic;
    app.adapter.presentation.render(app, app.adapter.presentation.createViewModel(app));

    this.timer = setTimeout(() => {
      this.timer = null;
      if (requestId !== this.requestId || !app.results) return;
      try {
        const targetResult = app.adapter.simulateBuild(request.rotation, {
          ...request.baseConfig,
          relic: request.comparisonRelic,
          ...(request.comparisonRelic === 'Thorns' ? { initialThornsStacks: this.initialStacks } : null)
        });
        const opponentSeries = buildChartSeries(opponentResult);
        const targetSeries = buildChartSeries(targetResult);
        const model = buildRelicComparisonModel({
          opponentRelic: request.opponentRelic,
          targetRelic: request.comparisonRelic,
          durationMs: Math.max(opponentSeries.durationMs, targetSeries.durationMs),
          opponentDps: opponentSeries.dps,
          targetDps: targetSeries.dps
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
