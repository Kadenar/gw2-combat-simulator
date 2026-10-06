import type { RotationCommand } from '#gw2/platform/execution/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { ProfessionAppState, ProfessionAppResult } from '#gw2/app/types.js';
import { cloneRotation, resetRotationHistory } from '#gw2/app/rotation/editing/history.js';

export interface RotationComparisonState {
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

/** Opens comparison only when Current has a fresh result to compare against. */
export function beginRotationComparison(app: ProfessionAppState): boolean {
  if (
    app.rotationComparison ||
    !app.build.rotation.length ||
    !app.results ||
    app.resultRevision !== app.buildRevision ||
    app.simulationStatus !== 'idle'
  )
    return false;
  app.rotationComparison = {
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  };
  return true;
}

/** Copies a reference before scheduling, keeping imports independent of Current and its history. */
export function setRotationReference(app: ProfessionAppState, rotation: readonly RotationCommand[]): boolean {
  if (!app.rotationComparison || !rotation.length) return false;
  Object.assign(app.rotationComparison, {
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
  app.rotationComparison.referenceStatus = 'queued';
  app.rotationComparison.referenceError = '';
}

/** Publishes only a requested reference result; clearing or leaving comparison rejects late output. */
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
