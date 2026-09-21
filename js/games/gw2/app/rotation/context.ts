import { type SkillFlipWindows } from '#gw2/platform/engine/skills/skill-flips.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';

/** Shared projection fields consumed by rotation views; professions own the remaining state. */
export interface RotationProfessionState {
  readonly primaryAttunement?: string;
  readonly resource?: number;
  readonly resourceDefinition?: { readonly maximum?: number };
  readonly availableFlips?: Readonly<SkillFlipWindows>;
  readonly autoattackChains?: Readonly<Record<string, SkillId>>;
  readonly availableAmbush?: { readonly name?: string } | null;
}
import type { ProfessionAppResult, ProfessionAppState } from '#gw2/app/types.js';
import { normalizeRotationInsertionIndex } from '#ui/rotation/insertion-cursor.js';

type RotationPlanningState = ProfessionAppResult['planningState'];

const paletteStateCache = new WeakMap<
  ProfessionAppState,
  {
    readonly result: ProfessionAppResult;
    readonly insertionIndex: number;
    readonly state: RotationPlanningState;
  }
>();

export const seconds = (ms: number): string => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

export const professionPlanningState = (result: ProfessionAppResult | null | undefined): RotationProfessionState =>
  result?.planningState?.profession && typeof result.planningState.profession === 'object'
    ? (result.planningState.profession as RotationProfessionState)
    : {};

export function palettePlanningState(app: ProfessionAppState): RotationPlanningState | null {
  const result = app.results;
  if (!result) return null;
  const rotation = Array.isArray(app.build?.rotation) ? app.build.rotation : [];
  const insertionIndex =
    normalizeRotationInsertionIndex(app.rotationInsertionIndex, rotation.length) ?? rotation.length;
  // Appending still needs rotation-end availability when the displayed result includes a tail.
  const hasTail = (result.planningState?.atSeconds ?? 0) > result.rotationEndTime;
  if ((insertionIndex === rotation.length && !hasTail) || typeof app.adapter?.rotationPlanningStateAt !== 'function') {
    return result.planningState;
  }

  const cached = paletteStateCache.get(app);
  if (cached?.result === result && cached.insertionIndex === insertionIndex) {
    return cached.state;
  }

  const state = app.adapter.rotationPlanningStateAt(app, insertionIndex);
  paletteStateCache.set(app, { result, insertionIndex, state });
  return state;
}

export const paletteProfessionState = (app: ProfessionAppState): RotationProfessionState => {
  const profession = palettePlanningState(app)?.profession;
  return profession && typeof profession === 'object' ? (profession as RotationProfessionState) : {};
};

export const activeSpecialization = (app: ProfessionAppState): string => app.adapter.eliteSpecialization(app.build);
