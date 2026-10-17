import { calculateRelicComparison } from '#gw2/app/optimizer/relic-comparison/calculate.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Runs one user-selected relic simulation against the equipped relic already on screen. */
export class RelicComparisonRunner {
  readonly app: ProfessionAppState;
  comparisonRelic: string;
  initialStacks: number;
  readonly onUpdate: () => void;

  constructor(app: ProfessionAppState, onUpdate: () => void = () => {}) {
    this.app = app;
    this.comparisonRelic = '';
    this.initialStacks = 0;
    // Let the owning relic panel refresh without rerendering unrelated simulation views.
    this.onUpdate = onUpdate;
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

    const results = app.results;

    if (!results) return;

    this.comparisonRelic = this.selectedComparisonRelic();
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app, this.comparisonRelic) : null;

    if (!request) {
      results.relicComparisonAvailable = false;
      results.relicComparisonError = '';
      results.relicComparison = undefined;
      results.relicComparisonOpponent = '';
      results.relicComparisonTarget = '';
      return;
    }

    results.relicComparisonAvailable = true;
    results.relicComparisonInitialStacks = this.initialStacks;
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

  /** Applies each relic's configured assumptions to its comparison simulation. */
  run(comparisonRelic: string = this.comparisonRelic, initialStacks: number = this.initialStacks): void {
    const app = this.app;

    const results = app.results;

    if (!results) return;

    this.comparisonRelic = this.selectedComparisonRelic(String(comparisonRelic || ''));
    this.initialStacks = Math.min(10, Math.max(0, Math.trunc(Number(initialStacks) || 0)));
    results.relicComparisonInitialStacks = this.initialStacks;
    const request = app.build.rotation.length ? app.adapter.relicComparisonRequest(app, this.comparisonRelic) : null;

    if (!request) {
      this.schedule();
      this.onUpdate();
      return;
    }

    results.relicComparisonAvailable = true;
    results.relicComparisonError = '';
    results.relicComparisonOpponent = request.opponentRelic;
    results.relicComparisonTarget = request.comparisonRelic;

    // Finish this lightweight comparison on the calling thread, with no pending job or cloned baseline.
    try {
      results.relicComparison = calculateRelicComparison(
        { ...request, opponentResult: results, initialStacks: this.initialStacks },
        app.profession
      );
    } catch (error) {
      results.relicComparisonError =
        error instanceof Error ? error.message : String(error || 'Relic comparison failed.');
    }

    this.onUpdate();
  }
}
