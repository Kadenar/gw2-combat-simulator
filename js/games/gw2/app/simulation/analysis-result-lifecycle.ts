/** Owns result freshness and publication while injected runners retain execution and browser code retains rendering. */
import { PatchResultCache, type PatchResultIdentity } from '#gw2/app/patch-preview/results.js';
import type {
  BaselineSimulationOutput,
  BaselineSimulationRequest,
  BaselineSimulationResult,
  PatchComparison
} from '#gw2/app/simulation/baseline/types.js';
import type {
  ModifierContribution,
  ModifierContributionRequest,
  ModifierContributionResultState
} from '#gw2/app/simulation/modifier-contributions/types.js';
import { DEFAULT_RANDOM_DISTRIBUTION_TRIALS } from '#gw2/app/simulation/random-distribution/random-distribution.js';
import type {
  RandomDistributionJobRequest,
  RandomDistributionProgress,
  RandomDistributionResultState,
  RandomDistributionSummary
} from '#gw2/app/simulation/random-distribution/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';

type OwnedResult = BaselineSimulationResult & ModifierContributionResultState & RandomDistributionResultState;

export type AnalysisResult = Readonly<OwnedResult>;

export interface AnalysisState {
  readonly results: AnalysisResult | null;
  readonly buildRevision: number;
  readonly resultRevision: number;
  readonly simulationStatus: 'idle' | 'queued' | 'running' | 'error';
  readonly simulationError: string;
  readonly patchComparison: PatchComparison | null;
}

export interface AnalysisSnapshot {
  readonly results: AnalysisResult | null;
  readonly patchComparison: PatchComparison | null;
  readonly fresh: boolean;
}

export interface AnalysisInputs {
  readonly identity: PatchResultIdentity;
  readonly rotationLength: number;
  readonly referenceQueued: boolean;
}

export interface BaselineOperation {
  readonly request: BaselineSimulationRequest;
  readonly started: () => void;
  readonly complete: (output: BaselineSimulationOutput) => void;
  readonly fail: (error: unknown) => void;
}

export interface ModifierOperation {
  readonly request: ModifierContributionRequest;
  readonly ready: () => boolean;
  readonly complete: (contributions: ModifierContribution[]) => void;
  readonly fail: (error: unknown) => void;
}

export interface DistributionOperation {
  readonly request: RandomDistributionJobRequest;
  readonly baseline: AnalysisResult;
  readonly progress: (progress: RandomDistributionProgress) => void;
  readonly complete: (summary: RandomDistributionSummary) => void;
  readonly fail: (error: unknown) => void;
}

export type AnalysisChange = {
  readonly kind:
    | 'status'
    | 'baseline'
    | 'charts'
    | 'baseline-error'
    | 'charts-error'
    | 'modifiers'
    | 'distribution'
    | 'distribution-progress';
  readonly revision: number;
  readonly render: boolean;
  readonly referenceResult?: BaselineSimulationResult;
};

export interface AnalysisExecution {
  readonly inputs: () => AnalysisInputs;
  readonly baselineRequest: () => BaselineSimulationRequest;
  readonly modifierRequest: (baselineDps: number) => ModifierContributionRequest;
  readonly distributionRequest: () => RandomDistributionJobRequest;
  readonly calculateBaseline: (request: BaselineSimulationRequest) => BaselineSimulationOutput;
  readonly baseline: { run: (operation: BaselineOperation) => void; cancel: () => void };
  readonly modifiers: { run: (operation: ModifierOperation) => void; cancel: () => void };
  readonly distribution: { run: (operation: DistributionOperation) => void; cancel: () => void };
  readonly changed: (change: AnalysisChange) => void;
}

/** Operation identity protects publication even if an execution adapter cannot cancel an obsolete callback. */
export class AnalysisResultLifecycle {
  private current: AnalysisState = Object.freeze({
    results: null,
    buildRevision: 0,
    resultRevision: 0,
    simulationStatus: 'idle',
    simulationError: '',
    patchComparison: null
  });
  private readonly cache = new PatchResultCache<AnalysisResult>();
  private visible = false;
  private baselineWork: { readonly operation: BaselineOperation; readonly chartsOnly: boolean } | null = null;
  private modifierWork: object | null = null;
  private distributionWork: object | null = null;

  constructor(private readonly execution: AnalysisExecution) {}

  get state(): AnalysisState {
    return this.current;
  }

  private update(patch: Partial<AnalysisState>): void {
    this.current = Object.freeze({ ...this.current, ...patch });
  }
  private notify(kind: AnalysisChange['kind'], render = true, referenceResult?: BaselineSimulationResult): void {
    this.execution.changed({ kind, revision: this.current.buildRevision, render, referenceResult });
  }

  /** Build edits retain stale display separately from reusable cached results; adopted references are already current. */
  changeInputs(patchSwitch = false, adoptedResult?: AnalysisResult): number {
    const { identity } = this.execution.inputs();
    const revision = this.current.buildRevision + 1;
    const previous = adoptedResult ?? this.current.results;
    this.update({
      buildRevision: revision,
      resultRevision: adoptedResult ? revision : this.current.resultRevision,
      results: previous?.contributions ? { ...previous, modifierContributionsStale: true } : previous,
      simulationStatus: 'queued',
      simulationError: '',
      patchComparison: null
    });
    this.cancelModifiers();
    this.cancelDistribution();

    if (!patchSwitch) this.cache.invalidate(identity.build);

    return revision;
  }

  /** Invalidate identities before executing cancellation, which may synchronously invoke adapter callbacks. */
  suspend(): void {
    this.baselineWork = null;
    this.modifierWork = null;
    this.distributionWork = null;
    this.execution.baseline.cancel();
    this.execution.modifiers.cancel();
    this.execution.distribution.cancel();
  }

  capture(): AnalysisSnapshot {
    return Object.freeze({
      results: this.current.results,
      patchComparison: this.current.patchComparison,
      fresh:
        this.current.results !== null &&
        this.current.resultRevision === this.current.buildRevision &&
        this.current.simulationStatus === 'idle'
    });
  }

  /** Restored data belongs to a new active revision, never to the outgoing tab's operation identities. */
  restore(snapshot: AnalysisSnapshot): void {
    this.suspend();
    const { identity } = this.execution.inputs();
    const fresh = snapshot.fresh && Boolean(snapshot.results?.debugInputs) === identity.damageDiagnostics;
    const revision = this.current.buildRevision + 1;
    this.update({
      results: fresh ? snapshot.results : null,
      patchComparison: snapshot.patchComparison,
      buildRevision: revision,
      resultRevision: fresh ? revision : -1,
      simulationStatus: fresh ? 'idle' : 'queued',
      simulationError: ''
    });
  }

  /** Resume only missing work after the app has restored and normalized the destination's inputs. */
  resume(): void {
    if (this.current.resultRevision !== this.current.buildRevision || this.execution.inputs().referenceQueued)
      this.refreshBaseline();
    else {
      if (this.current.results?.randomDistributionStale) this.requestDistribution(false);

      this.ensureCharts();
      this.ensureModifiers();
    }
  }

  needsPatchComparison(): boolean {
    return !this.current.patchComparison && this.cache.needsComparison(this.execution.inputs().identity);
  }

  /** View changes affect optional work, not the validity of already completed results. */
  setAnalysisVisible(visible: boolean): void {
    this.visible = visible;

    if (visible) {
      this.ensureCharts();
      this.ensureModifiers();
      return;
    }

    this.cancelModifiers();

    if (!this.baselineWork || (!this.baselineWork.chartsOnly && !this.baselineWork.operation.request.comparisonConfig))
      return;

    this.cancelBaseline();
    this.update({ simulationStatus: this.current.resultRevision === this.current.buildRevision ? 'idle' : 'queued' });

    if (this.current.resultRevision !== this.current.buildRevision) this.refreshBaseline();

    this.notify('status');
  }

  initialize(): void {
    this.requestBaseline(false, true);
  }
  refreshBaseline(): void {
    this.requestBaseline(false, false);
  }

  ensureCharts(): void {
    if (
      !this.visible ||
      this.baselineWork ||
      !this.current.results ||
      !this.execution.inputs().rotationLength ||
      this.current.resultRevision !== this.current.buildRevision ||
      (this.current.results.effectReport && !this.needsPatchComparison())
    )
      return;

    this.requestBaseline(true, false);
  }

  private cancelBaseline(): void {
    this.baselineWork = null;
    this.execution.baseline.cancel();
  }
  cancelModifiers(): void {
    this.modifierWork = null;
    this.execution.modifiers.cancel();
  }
  cancelDistribution(): void {
    this.distributionWork = null;
    this.execution.distribution.cancel();
  }

  /** Each request, including same-revision recapture, owns its callbacks and captured cache identity. */
  private requestBaseline(chartsOnly: boolean, synchronous: boolean): void {
    const inputs = this.execution.inputs();
    const raw = this.execution.baselineRequest();
    const request = chartsOnly ? { ...raw, collectChartData: true } : raw;

    if ((!chartsOnly && this.baselineWork?.chartsOnly) || !request.rotation.length) this.cancelBaseline();

    const revision = this.current.buildRevision;
    const baseline = this.current.results;
    const cached =
      !chartsOnly && !request.comparisonConfig && !request.referenceRotation
        ? this.cache.reusable(inputs.identity)
        : null;
    const valid = (): boolean =>
      this.baselineWork?.operation === operation &&
      revision === this.current.buildRevision &&
      (!chartsOnly || (this.current.results === baseline && this.current.resultRevision === revision));
    const operation: BaselineOperation = {
      request,
      started: () => {
        if (valid()) {
          this.update({ simulationStatus: 'running' });
          this.notify('status', !synchronous);
        }
      },
      complete: (output) => {
        if (!valid()) return;

        this.baselineWork = null;

        if (chartsOnly) {
          Object.assign(baseline!, {
            effectReport: output.result.effectReport,
            boonGeneration: output.result.boonGeneration
          });
        } else {
          this.cancelModifiers();
          this.cancelDistribution();
          const result: OwnedResult = output.result;

          if (result !== cached) {
            if (Array.isArray(this.current.results?.contributions))
              result.contributions = this.current.results.contributions;

            result.modifierContributionsStale = inputs.rotationLength > 0;
            result.modifierContributionsError = '';
          }

          this.update({ results: result, resultRevision: revision });

          if (result !== cached || !result.randomDistributionRequested || result.randomDistributionStale)
            this.prepareDistribution();
        }

        this.cache.record(inputs.identity, this.current.results!);

        if (output.comparisonResult)
          this.cache.record(inputs.identity, output.comparisonResult.result, output.comparisonResult.patchId);

        this.update({
          simulationStatus: 'idle',
          simulationError: '',
          patchComparison: this.cache.comparison(inputs.identity)
        });
        this.notify(chartsOnly ? 'charts' : 'baseline', !synchronous, chartsOnly ? undefined : output.referenceResult);
        this.ensureModifiers();

        if (!chartsOnly && !synchronous) this.ensureCharts();
      },
      fail: (error) => {
        if (!valid()) return;

        this.baselineWork = null;
        this.update({
          simulationStatus: 'error',
          simulationError:
            error instanceof Error
              ? error.message
              : String(error || (chartsOnly ? 'Chart calculation failed.' : 'Simulation failed.'))
        });
        this.notify(chartsOnly ? 'charts-error' : 'baseline-error', !synchronous);

        if (chartsOnly) this.ensureModifiers();
      }
    };
    this.baselineWork = { operation, chartsOnly };
    this.update({ simulationStatus: 'queued', simulationError: '' });

    if (cached) {
      this.execution.baseline.cancel();
      operation.complete({ result: cached });
    } else if (synchronous) operation.complete(this.execution.calculateBaseline(request));
    else this.execution.baseline.run(operation);
  }

  /** Modifier admission and result ownership live here; the runner retains its debounce and wait cadence. */
  private ensureModifiers(): void {
    const baseline = this.current.results;

    if (
      this.modifierWork ||
      !this.visible ||
      !baseline ||
      !this.execution.inputs().rotationLength ||
      this.current.resultRevision !== this.current.buildRevision ||
      ['queued', 'running'].includes(this.current.simulationStatus) ||
      (Array.isArray(baseline.contributions) && !baseline.modifierContributionsStale)
    )
      return;

    const identity = {};
    this.modifierWork = identity;
    const revision = this.current.buildRevision;
    const valid = () =>
      this.modifierWork === identity && this.current.results === baseline && this.current.buildRevision === revision;
    const result = baseline as OwnedResult;
    const fail = (error: unknown) => {
      if (!valid()) return;

      this.modifierWork = null;
      result.contributions = undefined;
      result.modifierContributionsStale = false;
      result.modifierContributionsError =
        error instanceof Error ? error.message : String(error || 'Modifier contribution calculation failed.');
      this.notify('modifiers');
    };

    result.modifierContributionsStale = true;
    result.modifierContributionsError = '';
    this.notify('modifiers');
    try {
      const request = this.execution.modifierRequest(result.dps);
      this.execution.modifiers.run({
        request,
        ready: () => valid() && !this.baselineWork && !this.distributionWork,
        fail,
        complete: (contributions) => {
          if (!valid()) return;

          this.modifierWork = null;
          result.contributions = contributions;
          result.modifierContributionsStale = false;
          result.modifierContributionsError = '';
          this.notify('modifiers');
        }
      });
    } catch (error) {
      fail(error);
    }
  }

  private prepareDistribution(run = false, trials = DEFAULT_RANDOM_DISTRIBUTION_TRIALS): void {
    const result = this.current.results as OwnedResult | null;

    if (!result) return;

    if (!this.execution.inputs().rotationLength) {
      result.randomDistributionRequested = false;
      result.randomDistributionStale = false;
      return;
    }

    Object.assign(result, {
      randomDistributionRequested: true,
      randomDistributionStale: run,
      randomDistributionTrials: trials,
      randomDistributionError: '',
      randomDistributionProgress: { completed: 0, total: trials, percent: 0 }
    });
  }

  /** Sampling is explicit; availability alone never prepares a request or launches an execution adapter. */
  runDistribution(): void {
    this.requestDistribution(true);
  }

  /** Tab restoration renders after all inputs and optional work are ready; explicit runs paint pending progress now. */
  private requestDistribution(renderPending: boolean): void {
    this.cancelDistribution();
    const baseline = this.current.results;

    if (!baseline || !this.execution.inputs().rotationLength) return;

    const identity = {};
    this.distributionWork = identity;
    const revision = this.current.buildRevision;
    const valid = () =>
      this.distributionWork === identity &&
      this.current.results === baseline &&
      this.current.buildRevision === revision;
    const result = baseline as OwnedResult;
    const fail = (error: unknown) => {
      if (!valid()) return;

      this.distributionWork = null;
      result.randomDistributionStale = false;
      result.randomDistributionError =
        error instanceof Error ? error.message : String(error || 'Randomized DPS calculation failed.');
      this.notify('distribution');
    };

    try {
      const request = this.execution.distributionRequest();
      this.prepareDistribution(true, request.trials);
      this.execution.distribution.run({
        request,
        baseline,
        fail,
        progress: (progress) => {
          if (!valid()) return;

          const total = Math.max(1, Number(progress.total || request.trials));
          const completed = boundedNumber(progress.completed || 0, 0, 0, total);
          const percent = boundedNumber(
            progress.percent ?? (completed / total) * 100,
            (completed / total) * 100,
            0,
            100
          );
          result.randomDistributionProgress = { total, completed, percent };
          this.notify('distribution-progress');
        },
        complete: (distribution) => {
          if (!valid()) return;

          this.distributionWork = null;
          Object.assign(result, {
            randomDistribution: distribution,
            randomDistributionStale: false,
            randomDistributionError: '',
            randomDistributionProgress: { completed: distribution.trials, total: distribution.trials, percent: 100 }
          });
          this.notify('distribution');
        }
      });

      if (renderPending) {
        this.ensureModifiers();
        this.notify('distribution');
      }
    } catch (error) {
      fail(error);
    }
  }
}
