/** Connects the app's analysis state and simulation adapter to cursor previews. */
import { CursorPreview } from '#gw2/app/rotation/cursor-preview.js';
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

const cursorPreviews = new WeakMap<ProfessionAppState, CursorPreview>();

/** Shares one cursor preview per app so the palette, snapshots, and cast editors reuse captured inputs and results. */
export function cursorPreview(app: ProfessionAppState): CursorPreview {
  let preview = cursorPreviews.get(app);

  if (!preview) {
    preview = new CursorPreview({
      source: () => ({
        results: app.analysis.state.results,
        buildRevision: app.analysis.state.buildRevision,
        resultRevision: app.analysis.state.resultRevision,
        rotationLength: app.build.rotation.length
      }),
      capture: () => {
        const inputs = app.analysis.capture().inputs;

        return inputs?.baseline({ collectChartData: false, comparePatch: false }) ?? null;
      },
      simulate: (request) => app.adapter.calculateCursorPreview(request)
    });
    cursorPreviews.set(app, preview);
  }

  return preview;
}

export const professionPlanningState = (result: AnalysisResult | null | undefined): RotationProfessionState =>
  result?.planningState?.profession && typeof result.planningState.profession === 'object'
    ? (result.planningState.profession as RotationProfessionState)
    : {};

/** Returns the result at the insertion cursor only when the baseline matches the current build revision. */
export function palettePlanningResult(app: ProfessionAppState) {
  return cursorPreview(app).at(normalizeRotationInsertionIndex(app.rotationInsertionIndex, app.build.rotation.length));
}

export const palettePlanningState = (app: ProfessionAppState): AnalysisResult['planningState'] | null =>
  palettePlanningResult(app)?.planningState ?? null;

export const activeSpecialization = (app: ProfessionAppState): string => app.adapter.eliteSpecialization(app.build);
