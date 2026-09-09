import { mergedActionStatus, mergeCompositeActions } from '#gw2/integrations/logs/lib/rotation/rules/composites.js';
import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { reconstructConduitDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/revenant/conduit.js';
import { reconstructRenegadeDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/revenant/renegade.js';
import { reconstructVindicatorDpsReportActions } from '#gw2/integrations/logs/lib/rotation/professions/revenant/vindicator.js';
import type {
  LogActionNormalizer,
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const specializationReconstructors: ReadonlyMap<string, LogActionNormalizer> = new Map([
  ['conduit', reconstructConduitDpsReportActions],
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

function normalizeLegendSwaps(
  context: LogActionNormalizationContext,
  actions: readonly RecordedLogAction[]
): RecordedLogAction[] {
  return actions.map((action) =>
    // Inferred EVTC stances may have no name record; resolve their known ID through the catalog.
    LEGEND_STANCE_NAME.test(normalized(recordedActionSkill(action, context)?.name || action.rawName))
      ? {
          ...action,
          eventIndex: Math.max(
            action.eventIndex,
            ...actions
              .filter(
                (candidate) =>
                  candidate !== action &&
                  Math.abs(candidate.start - action.start) <= 1 &&
                  recordedActionSkill(candidate, context)?.handlerId === 'revenant.upkeep-release'
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
  context: LogActionNormalizationContext,
  actions: readonly RecordedLogAction[]
): RecordedLogAction[] {
  // Legend swaps automatically release active upkeep. Removing that EI signal
  // and coalescing split animations keeps one simulator command per player input.
  const actionable = actions.filter((action) => {
    if (recordedActionSkill(action, context)?.handlerId !== 'revenant.upkeep-release') return true;
    const imminentSwap = actions.find(
      (candidate) =>
        candidate.canonicalSkillId === -4 && candidate.start >= action.start && candidate.start - action.start <= 500
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

/** Normalizes report legend changes before mapping represented specialization actions. */
export function reconstructRevenantDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
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
  // Preserve recorded chain IDs so the simulator owns cancellation, advancement, and availability.
  return normalizeGeneratedRevenantActions(context, specialized);
}
