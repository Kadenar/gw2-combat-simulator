import { calculateRelicComparison } from '#gw2/app/optimizer/relic-comparison/calculate.js';
import { relicComparisonAvailable } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';

/** Runs one user-selected relic simulation against the equipped relic already on screen. */
export class RelicComparisonRunner {
  readonly app: ProfessionAppState;
  comparisonRelic: string;
  initialStacks: number;
  comparison: RelicComparisonModel | null = null;
  error = '';
  private baseline: ProfessionAppResult | null = null;
  private revision = -1;
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
      app.results &&
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

  /** Only the baseline and revision that produced the output may display it, including cached-tab restoration. */
  schedule(): void {
    this.select(this.comparisonRelic, this.initialStacks);

    if (
      !this.available ||
      this.baseline !== this.app.results ||
      this.revision !== this.app.buildRevision ||
      this.app.resultRevision !== this.app.buildRevision ||
      (this.comparison && this.comparison.equippedRelic !== this.app.build.relic)
    )
      this.invalidate();
  }

  /** Applies each relic's configured assumptions to its comparison simulation. */
  run(comparisonRelic: string = this.comparisonRelic, initialStacks: number = this.initialStacks): void {
    const app = this.app;

    this.select(comparisonRelic, initialStacks);
    this.invalidate();
    const results = app.results;

    if (!results || !this.available || app.resultRevision !== app.buildRevision || app.simulationStatus !== 'idle') {
      this.onUpdate();
      return;
    }

    this.baseline = results;
    this.revision = app.buildRevision;

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

    this.onUpdate();
  }
}
