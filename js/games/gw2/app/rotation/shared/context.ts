import type { SchedulerRecord } from '../../../platform/engine/types.js';
import type { ProfessionAppResult, ProfessionAppState } from '../../../../../app/profession/types.js';
import { normalizeRotationInsertionIndex } from '../../../../../ui/rotation/insertion-cursor.js';

type RotationEndState = ProfessionAppResult['endState'];

const paletteStateCache = new WeakMap<
  ProfessionAppState,
  {
    readonly result: ProfessionAppResult;
    readonly insertionIndex: number;
    readonly state: RotationEndState;
  }
>();

export const seconds = (ms: number): string => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

export const professionEndState = (result: ProfessionAppResult | null | undefined): SchedulerRecord =>
  result?.endState?.profession && typeof result.endState.profession === 'object'
    ? (result.endState.profession as SchedulerRecord)
    : {};

export function paletteEndState(app: ProfessionAppState): RotationEndState | null {
  const result = app.results;
  if (!result) return null;
  const rotation = Array.isArray(app.build?.rotation) ? app.build.rotation : [];
  const insertionIndex = normalizeRotationInsertionIndex(app.rotationInsertionIndex, rotation.length);
  if (
    insertionIndex === null ||
    insertionIndex === rotation.length ||
    typeof app.adapter?.rotationEndStateAt !== 'function'
  ) {
    return result.endState;
  }

  const cached = paletteStateCache.get(app);
  if (cached?.result === result && cached.insertionIndex === insertionIndex) {
    return cached.state;
  }

  const state = app.adapter.rotationEndStateAt(app, insertionIndex);
  paletteStateCache.set(app, { result, insertionIndex, state });
  return state;
}

export const paletteProfessionState = (app: ProfessionAppState): SchedulerRecord => {
  const profession = paletteEndState(app)?.profession;
  return profession && typeof profession === 'object' ? (profession as SchedulerRecord) : {};
};

export const activeSpecialization = (app: ProfessionAppState): string => app.adapter.eliteSpecialization(app.build);
