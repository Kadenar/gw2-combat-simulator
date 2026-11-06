import type { AnalysisResult } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { SHARED_STATE_IDS as STATE } from '#gw2/platform/results/state-ids.js';
import type { Gw2SharedProfessionPlanningState } from '#gw2/platform/results/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

/** Shared projection fields consumed by rotation views; professions own the remaining state. */
export interface RotationProfessionState extends Partial<Gw2SharedProfessionPlanningState> {
  readonly [STATE.PRIMARY_ATTUNEMENT]?: string;
  readonly [STATE.RESOURCE]?: number;
  readonly [STATE.RESOURCE_DEFINITION]?: { readonly maximum?: number };
  readonly [STATE.AUTOATTACK_CHAINS]?: Readonly<Record<string, SkillId>>;
  readonly [STATE.AVAILABLE_AMBUSH]?: { readonly name?: string } | null;
}

const palettePreviewCache = new WeakMap<
  ProfessionAppState,
  {
    readonly result: AnalysisResult;
    readonly insertionIndex: number;
    readonly preview: AnalysisResult;
  }
>();

export const professionPlanningState = (result: AnalysisResult | null | undefined): RotationProfessionState =>
  result?.planningState?.profession && typeof result.planningState.profession === 'object'
    ? (result.planningState.profession as RotationProfessionState)
    : {};

/** Share one prefix simulation so cursor state and proc history cannot include actions after the cursor. */
export function palettePlanningResult(app: ProfessionAppState): AnalysisResult | null {
  const result = app.analysis.state.results;

  if (!result) return null;

  const rotation = Array.isArray(app.build?.rotation) ? app.build.rotation : [];
  const insertionIndex =
    normalizeRotationInsertionIndex(app.rotationInsertionIndex, rotation.length) ?? rotation.length;
  // Appending still needs rotation-end availability when the displayed result includes a tail.
  const hasTail = (result.planningState?.atSeconds ?? 0) > result.rotationEndTime;

  if (insertionIndex === rotation.length && !hasTail) {
    return result;
  }

  const cached = palettePreviewCache.get(app);

  if (cached?.result === result && cached.insertionIndex === insertionIndex) {
    return cached.preview;
  }

  const preview = app.adapter.rotationPreviewAt(app, insertionIndex);
  palettePreviewCache.set(app, { result, insertionIndex, preview });
  return preview;
}

export const palettePlanningState = (app: ProfessionAppState): AnalysisResult['planningState'] | null =>
  palettePlanningResult(app)?.planningState ?? null;

export const paletteProfessionState = (app: ProfessionAppState): RotationProfessionState => {
  const profession = palettePlanningState(app)?.profession;
  return profession && typeof profession === 'object' ? (profession as RotationProfessionState) : {};
};

export const activeSpecialization = (app: ProfessionAppState): string => app.adapter.eliteSpecialization(app.build);
