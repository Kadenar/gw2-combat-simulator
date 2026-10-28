import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { ProfessionAppState, ProfessionAppResult } from '#gw2/app/types.js';
import { cloneRotation, resetRotationHistory } from '#gw2/app/rotation/editing/history.js';

/** Optional import context belongs to the pinned reference, not the simulator or its results. */
export interface RotationReferenceDescriptor {
  readonly label: string;
  readonly warnings: readonly string[];
  readonly publishedBenchmarks?: Readonly<Record<string, number>>;
}

export type ComparisonWindowMode = 'shared' | 'full';

export interface RotationComparisonState {
  view: 'timelines' | 'insights';
  windowMode: ComparisonWindowMode;
  reference: RotationReferenceDescriptor | null;
  referenceRotation: RotationCommand[];
  referenceResult: Gw2SimulationResult | null;
  referenceStatus: 'empty' | 'fresh' | 'queued' | 'error';
  referenceError: string;
}

/** A pinned reference follows its build tab and is never persisted as a saved build input. */
export interface RotationComparisonSession {
  rotationComparison: RotationComparisonState | null;
}

/** New build tabs begin with the ordinary editable rotation workspace. */
export function emptyRotationComparisonSession(): RotationComparisonSession {
  return { rotationComparison: null };
}

/** Comparison and insights belong to Golem; both require a fresh Current result. */
export function beginRotationComparison(
  app: ProfessionAppState,
  view: RotationComparisonState['view'] = 'timelines'
): boolean {
  if (
    app.workspace?.scenario ||
    app.rotationComparison?.view === view ||
    !app.build.rotation.length ||
    !app.results ||
    app.resultRevision !== app.buildRevision ||
    app.simulationStatus !== 'idle'
  )
    return false;

  // Switching from a standalone report to timelines reuses the same pinned reference and result.
  if (app.rotationComparison) {
    app.rotationComparison.view = view;
    return true;
  }

  app.rotationComparison = {
    view,
    windowMode: 'shared',
    reference: null,
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  };
  return true;
}

/** Copies a reference before scheduling, keeping imports independent of Current and its history. */
export function setRotationReference(app: ProfessionAppState, rotation: readonly RotationCommand[]): boolean {
  if (app.workspace?.scenario || !app.rotationComparison || !rotation.length) return false;

  Object.assign(app.rotationComparison, {
    reference: null,
    referenceRotation: cloneRotation(rotation),
    referenceResult: null,
    referenceStatus: 'queued',
    referenceError: ''
  });
  return true;
}

/** Clears a reference without leaving comparison mode or changing the editable rotation. */
export function clearRotationReference(app: ProfessionAppState): boolean {
  if (!app.rotationComparison) return false;

  Object.assign(app.rotationComparison, {
    reference: null,
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  });
  return true;
}

/** Exchanges independent rotations and their cached results before the app refreshes Current-only output. */
export function swapRotationComparison(app: ProfessionAppState): boolean {
  const comparison = app.rotationComparison;

  if (
    app.workspace?.scenario ||
    !comparison ||
    comparison.referenceStatus !== 'fresh' ||
    !comparison.referenceResult ||
    !app.build.rotation.length ||
    !app.results ||
    app.resultRevision !== app.buildRevision ||
    app.simulationStatus !== 'idle'
  )
    return false;

  const currentRotation = cloneRotation(app.build.rotation);
  const currentResult = app.results;
  app.build.rotation = cloneRotation(comparison.referenceRotation);
  app.results = comparison.referenceResult as ProfessionAppResult;
  comparison.reference = { label: 'Previous current rotation', warnings: [] };
  comparison.referenceRotation = currentRotation;
  comparison.referenceResult = currentResult;
  comparison.referenceStatus = 'fresh';
  comparison.referenceError = '';
  resetRotationHistory(app);
  return true;
}

/** Leaving comparison discards only the reference; Current's undo history remains usable. */
export function discardRotationComparison(app: ProfessionAppState): boolean {
  if (!app.rotationComparison) return false;

  app.rotationComparison = null;
  return true;
}

/** Shared build changes queue the pinned rotation without invalidating it for ordinary Current-only edits. */
export function queueRotationReference(app: RotationComparisonSession): void {
  if (!app.rotationComparison?.referenceRotation.length) return;

  // Keep the pinned rotation, but discard results calculated with the previous simulation settings.
  app.rotationComparison.referenceResult = null;
  app.rotationComparison.referenceStatus = 'queued';
  app.rotationComparison.referenceError = '';
}

/** The baseline queue rejects superseded jobs; session state rejects cleared or closed references. */
export function publishRotationReference(
  app: RotationComparisonSession,
  result: Gw2SimulationResult | null | undefined
): void {
  if (
    !result ||
    app.rotationComparison?.referenceStatus !== 'queued' ||
    !app.rotationComparison.referenceRotation.length
  )
    return;

  app.rotationComparison.referenceResult = result;
  app.rotationComparison.referenceStatus = 'fresh';
  app.rotationComparison.referenceError = '';
}

/** Reference failures belong to queued work and must not replace a cleared or already completed reference. */
export function failRotationReference(app: RotationComparisonSession, error: string): void {
  if (app.rotationComparison?.referenceStatus !== 'queued') return;

  app.rotationComparison.referenceStatus = 'error';
  app.rotationComparison.referenceError = error;
}
