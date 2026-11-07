/** Owns prefix reuse and candidate execution against the inputs of one accepted baseline. */
import type { AnalysisState } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { BaselineSimulationRequest } from '#gw2/app/simulation/baseline/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { clamp } from '#kernel/core/numeric.js';

export interface CursorPreviewRun {
  readonly rotation: readonly RotationCommand[];
  readonly config: Gw2Config;
  readonly combatStartTime?: number;
}

interface CursorPreviewSource extends Pick<AnalysisState, 'results' | 'buildRevision' | 'resultRevision'> {
  readonly rotationLength: number;
}

interface CursorPreviewExecution {
  readonly source: () => CursorPreviewSource;
  readonly capture: () => Pick<BaselineSimulationRequest, 'rotation' | 'baseConfig'> | null;
  readonly simulate: (request: CursorPreviewRun) => Gw2SimulationResult;
}

/** Freshness follows accepted revisions; optional chart and analysis jobs do not block navigation. */
export function cursorPreviewReady(
  state: Pick<AnalysisState, 'results' | 'buildRevision' | 'resultRevision'>
): boolean {
  return state.results != null && state.buildRevision === state.resultRevision;
}

export class CursorPreview {
  private revision = -1;
  private baseline: Gw2SimulationResult | null = null;
  private request: Pick<BaselineSimulationRequest, 'rotation' | 'baseConfig'> | null = null;
  private cached: { readonly index: number; readonly result: Gw2SimulationResult } | null = null;

  constructor(private readonly execution: CursorPreviewExecution) {}

  /** Pending or failed baselines cannot start work or reuse a prefix from another build revision. */
  at(insertionIndex: number | null, appended: readonly RotationCommand[] = []): Gw2SimulationResult | null {
    return this.evaluate(insertionIndex, appended, true);
  }

  /** Editor probes share accepted inputs without replacing the palette's cached cursor prefix. */
  candidate(insertionIndex: number, appended: readonly RotationCommand[] = []): Gw2SimulationResult | null {
    return this.evaluate(insertionIndex, appended, false);
  }

  /** Timing editors replace a captured command and replay only the accepted suffix through the marker. */
  editThrough(
    index: number,
    throughIndex: number,
    update: (command: RotationCommand) => RotationCommand
  ): Gw2SimulationResult | null {
    if (!this.prepare()) return null;

    this.request ??= this.execution.capture();
    const entry = this.request?.rotation[index];

    if (!entry) return null;

    return this.candidate(index, [update(entry), ...this.request!.rotation.slice(index + 1, throughIndex + 1)]);
  }

  private prepare(): CursorPreviewSource | null {
    const source = this.execution.source();

    if (!cursorPreviewReady(source)) return null;

    const baseline = source.results!;

    if (this.revision !== source.buildRevision || this.baseline !== baseline) {
      this.revision = source.buildRevision;
      this.baseline = baseline;
      this.request = null;
      this.cached = null;
    }

    return source;
  }

  private evaluate(
    insertionIndex: number | null,
    appended: readonly RotationCommand[],
    cacheCursor: boolean
  ): Gw2SimulationResult | null {
    const source = this.prepare();

    if (!source) return null;

    const baseline = source.results!;
    const index =
      insertionIndex == null
        ? source.rotationLength
        : clamp(Math.floor(Number(insertionIndex) || 0), 0, source.rotationLength);
    const hasTail =
      baseline.rotationEndTime != null && (baseline.planningState?.atSeconds ?? 0) > baseline.rotationEndTime;

    if (!appended.length && index === source.rotationLength && !hasTail) return baseline;

    if (cacheCursor && !appended.length && this.cached?.index === index) return this.cached.result;

    // The accepted baseline supplies detached inputs once; cursor movement never reads the edited build.
    this.request ??= this.execution.capture();

    if (!this.request) return null;

    const rotation = [...this.request.rotation.slice(0, index), ...appended];
    const marker = this.request.rotation.findIndex((command) => command.type === 'combat-start');
    // A candidate containing Combat Start must resolve its own marker, since the edit can move it.
    const inheritStart = marker >= index && !rotation.some((command) => command.type === 'combat-start');
    const result = this.execution.simulate({
      rotation,
      config: this.request.baseConfig,
      ...(inheritStart && baseline.combatStartTime != null ? { combatStartTime: baseline.combatStartTime } : {})
    });

    if (cacheCursor && !appended.length) this.cached = { index, result };

    return result;
  }
}
