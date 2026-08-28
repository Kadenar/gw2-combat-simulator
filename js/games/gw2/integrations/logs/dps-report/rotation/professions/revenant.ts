import { mergedActionStatus, mergeCompositeActions } from '../../../lib/rotation/rules/composites.js';
import { normalizeAutoattackChains } from '../../../lib/rotation/rules/autoattack-chains.js';
import type { Skill } from '../../../../../platform/engine/types.js';
import { reconstructConduitDpsReportActions } from './revenant/conduit.js';
import { reconstructHeraldDpsReportActions } from './revenant/herald.js';
import { reconstructRenegadeDpsReportActions } from './revenant/renegade.js';
import { reconstructVindicatorDpsReportActions } from './revenant/vindicator.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '../types.js';

const specializationReconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['conduit', reconstructConduitDpsReportActions],
  ['herald', reconstructHeraldDpsReportActions],
  ['renegade', reconstructRenegadeDpsReportActions],
  ['vindicator', reconstructVindicatorDpsReportActions]
]);
const LEGEND_STANCE_NAME = /^legendary .+(?: stance)?$/;
const SONG_OF_THE_MISTS_SIGNAL = /^call of the (alliance|assassin|centaur|demon|dragon|dwarf|renegade)$/;
const ABYSSAL_BLITZ_CHILD_SIGNAL = /^blitz mines \((drop|detonation)\)$/;
const COMPOSITE_CASTS = [
  { startId: 27074, finishId: 28625, maximumGapMs: 10 },
  { startId: 28029, finishId: 26923, maximumGapMs: 10 },
  { startId: 62895, finishId: 62713, maximumGapMs: 10 }
] as const;

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function actionSkill(action: DpsReportRecordedAction, context: DpsReportProfessionReconstructionContext): Skill | null {
  const id = action.canonicalSkillId ?? action.rawSkillId;
  const name = action.canonicalName ?? action.rawName;
  return (
    context.catalog?.skills.find(
      (skill) =>
        (typeof skill.id === 'number' && Number(skill.id) === Number(id)) || normalized(skill.name) === normalized(name)
    ) || null
  );
}

function normalizeLegendSwaps(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  return actions.map((action) =>
    LEGEND_STANCE_NAME.test(normalized(action.rawName))
      ? {
          ...action,
          eventIndex: Math.max(
            action.eventIndex,
            ...actions
              .filter(
                (candidate) =>
                  candidate !== action &&
                  Math.abs(candidate.start - action.start) <= 1 &&
                  actionSkill(candidate, context)?.handlerId === 'revenant.upkeep-release'
              )
              .map((candidate) => candidate.eventIndex + 0.25)
          ),
          canonicalSkillId: -4,
          canonicalName: 'Swap Legends'
        }
      : action
  );
}

function normalizeGeneratedRevenantActions(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  // Legend swaps automatically release active upkeep. Removing that EI signal
  // and coalescing split animations keeps one simulator command per player input.
  const actionable = actions.filter((action) => {
    if (actionSkill(action, context)?.handlerId !== 'revenant.upkeep-release') return true;
    const imminentSwap = actions.find(
      (candidate) =>
        LEGEND_STANCE_NAME.test(normalized(candidate.rawName)) &&
        candidate.start >= action.start &&
        candidate.start - action.start <= 500
    );
    if (!imminentSwap) return true;

    // A release immediately before a legend change only mirrors the upkeep
    // teardown. Keep it if another player input occurred before that swap.
    return actions.some(
      (candidate) => candidate !== action && candidate.start > action.start && candidate.start < imminentSwap.start
    );
  });
  return mergeCompositeActions(actionable, COMPOSITE_CASTS, (action, finish) => ({
    ...action,
    end: finish.end,
    status: mergedActionStatus(action.status, finish.status),
    metadataAccurate: action.metadataAccurate && finish.metadataAccurate,
    canonicalSkillId: action.rawSkillId,
    canonicalName: action.rawName
  }));
}

/** Normalizes report legend changes before applying Revenant specialization recovery. */
export function reconstructRevenantDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  // EI exposes Song of the Mists and Abyssal Blitz's child mines as inaccurate
  // casts; the simulator generates both from their parent actions, so importing
  // these signals would apply their damage and conditions twice.
  const withoutAutomaticCalls = context.recordedActions.filter((action) => {
    const name = normalized(action.rawName);
    return !SONG_OF_THE_MISTS_SIGNAL.test(name) && !ABYSSAL_BLITZ_CHILD_SIGNAL.test(name);
  });
  const common = normalizeLegendSwaps(context, withoutAutomaticCalls);
  const specialized = specializationReconstructors.get(context.profile.specializationId)?.({
    ...context,
    recordedActions: common
  }) || [...common];
  const actionable = normalizeGeneratedRevenantActions(context, specialized);
  return normalizeAutoattackChains(actionable, {
    skillFor: (action) => actionSkill(action, context),
    skillById: (skillId) =>
      context.catalog?.skills.find(
        (candidate) => typeof candidate.id === 'number' && Number(candidate.id) === skillId
      ) || null,
    // EI normally reports the exact root when a chain restarts, even if a later stage was expected.
    trustExplicitRootReset: true,
    // Weapon and legend changes reset the equipped chain; ordinary Revenant skills do not.
    resetsChain: (action, skill) => action.isSwap || skill?.handlerId === 'revenant.legend-swap'
  });
}
