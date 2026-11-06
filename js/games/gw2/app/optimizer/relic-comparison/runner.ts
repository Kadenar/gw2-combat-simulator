import { calculateRelicComparison } from '#gw2/app/optimizer/relic-comparison/calculate.js';
import { relicComparisonAvailable } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { AnalysisResult } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

/** Runs one user-selected relic simulation against the equipped relic already on screen. */
export class RelicComparisonRunner {
  readonly app: ProfessionAppState;
  comparisonRelic: string;
  initialStacks: number;
  comparison: RelicComparisonModel | null = null;
  error = '';
  private baseline: AnalysisResult | null = null;
  private revision = -1;
  // Baseline identity is reused only after its build, patch, and simulation inputs have been validated.
  private readonly completed = new WeakMap<
    AnalysisResult,
    { readonly comparison: RelicComparisonModel; readonly initialStacks: number }
  >();
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

  /** Availability follows the active build without preparing combat inputs or storing another copy on results. */
  get available(): boolean {
    const app = this.app;
    return Boolean(
      app.analysis.state.results &&
      app.build.rotation.length &&
      relicComparisonAvailable(app.build.relic, this.comparisonRelic, app.relicNames)
    );
  }

  /** Shared controls survive tab switches and baseline replacement; edits discard the previous calculation. */
  select(comparisonRelic: string, initialStacks: number): boolean {
    const relic = this.selectedComparisonRelic(comparisonRelic);
    const stacks = Math.min(10, Math.max(0, Math.trunc(Number(initialStacks) || 0)));

    const changed = relic !== this.comparisonRelic || stacks !== this.initialStacks;

    if (changed) this.invalidate();

    this.comparisonRelic = relic;
    this.initialStacks = stacks;
    return changed;
  }

  private invalidate(): void {
    this.comparison = null;
    this.error = '';
    this.baseline = null;
    this.revision = -1;
  }

  /** Restore completed comparisons for a fresh baseline only while the selected relic assumptions still match. */
  schedule(): void {
    this.select(this.comparisonRelic, this.initialStacks);

    // Keep an active failure visible until inputs change or the user retries.
    if (
      this.available &&
      this.baseline === this.app.analysis.state.results &&
      this.revision === this.app.analysis.state.buildRevision &&
      this.app.analysis.state.resultRevision === this.app.analysis.state.buildRevision &&
      (!this.comparison || this.comparison.equippedRelic === this.app.build.relic)
    )
      return;

    const saved = this.app.analysis.state.results && this.completed.get(this.app.analysis.state.results);
    this.invalidate();

    if (
      saved &&
      this.available &&
      this.app.analysis.state.resultRevision === this.app.analysis.state.buildRevision &&
      saved.comparison.equippedRelic === this.app.build.relic &&
      saved.comparison.targetRelic === this.comparisonRelic &&
      saved.initialStacks === this.initialStacks
    ) {
      this.comparison = saved.comparison;
      this.baseline = this.app.analysis.state.results;
      this.revision = this.app.analysis.state.buildRevision;
    }
  }

  /** Applies each relic's configured assumptions to its comparison simulation. */
  run(comparisonRelic: string = this.comparisonRelic, initialStacks: number = this.initialStacks): void {
    const app = this.app;

    this.select(comparisonRelic, initialStacks);
    this.invalidate();
    const results = app.analysis.state.results;

    if (
      !results ||
      !this.available ||
      app.analysis.state.resultRevision !== app.analysis.state.buildRevision ||
      app.analysis.state.simulationStatus !== 'idle'
    ) {
      this.onUpdate();
      return;
    }

    this.completed.delete(results);
    this.baseline = results;
    this.revision = app.analysis.state.buildRevision;

    // Finish this lightweight comparison on the calling thread, with no pending job or cloned baseline.
    try {
      const request = app.adapter.relicComparisonRequest(app, this.comparisonRelic);

      if (request)
        this.comparison = calculateRelicComparison(
          { ...request, baselineResult: results, initialStacks: this.initialStacks },
          app.profession
        );
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error || 'Relic comparison failed.');
    }

    if (this.comparison)
      this.completed.set(results, { comparison: this.comparison, initialStacks: this.initialStacks });

    this.onUpdate();
  }
}
