import type { Skill } from '#gw2/platform/engine/types.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { createInferredAction } from '#gw2/integrations/logs/dps-report/rotation/create-inferred-action.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const RELINQUISH_POWER_ID = 28382;
const GENERATED_SIGNAL_IDS = new Set([76818, 77116, 77141]);
const ASSASSIN_LEGEND_ID = 'LegendaryAssassin';
const DEFAULT_LEGEND_SWAP_COOLDOWN_MS = 10_000;

function namedSkill(context: DpsReportProfessionReconstructionContext, name: string): Skill | null {
  return context.catalog?.skills.find((skill) => normalized(skill.name) === normalized(name)) || null;
}

function inferredSkillAction(
  context: DpsReportProfessionReconstructionContext,
  name: string,
  start: number,
  end: number,
  sameTimestampOrder: number
): DpsReportRecordedAction | null {
  const skill = namedSkill(context, name);
  if (!skill || typeof skill.id !== 'number') return null;
  // Recorded event indexes are non-negative. A negative synthetic index only
  // orders inferred setup before real casts that share its timestamp.
  return createInferredAction(skill, start, end, sameTimestampOrder, 'conduit-opening', {
    isSwap: normalized(skill.name) === 'swap weapons'
  });
}

function cooldownResetAction(at: number, sameTimestampOrder: number): DpsReportRecordedAction {
  return {
    start: at,
    end: at,
    rawSkillId: 0,
    rawName: '__cooldown_reset',
    status: 'instant',
    eventIndex: sameTimestampOrder,
    isSwap: false,
    metadataAccurate: false,
    control: 'cooldown-reset',
    inference: 'conduit-opening',
    canonicalSkillId: 0,
    canonicalName: '__cooldown_reset'
  };
}

function openingAssassinEvidence(
  actions: readonly DpsReportRecordedAction[]
): { readonly entitySwap: DpsReportRecordedAction; readonly impossibleOddsRecorded: boolean } | null {
  const firstLegendSwap = actions.find((action) => normalized(action.rawName).startsWith('legendary '));
  if (!firstLegendSwap || normalized(firstLegendSwap.rawName) !== 'legendary entity stance') return null;
  const releaseProof = actions.some(
    (action) =>
      action.rawSkillId === RELINQUISH_POWER_ID &&
      action.start <= firstLegendSwap.start &&
      firstLegendSwap.start - action.start <= 5
  );
  const impossibleOddsRecorded = actions.some(
    (action) => normalized(action.rawName) === 'impossible odds' && action.start < firstLegendSwap.start
  );
  return releaseProof || impossibleOddsRecorded ? { entitySwap: firstLegendSwap, impossibleOddsRecorded } : null;
}

function startsInAssassin(context: DpsReportProfessionReconstructionContext): boolean {
  return String(context.professionConfig?.startingLegend || '') === ASSASSIN_LEGEND_ID;
}

function legendSwapCooldownMs(context: DpsReportProfessionReconstructionContext): number {
  const swap = namedSkill(context, 'Swap Legends');
  const cooldown = Number(swap?.cooldown);
  return Number.isFinite(cooldown) && cooldown > 0 ? cooldown * 1000 : DEFAULT_LEGEND_SWAP_COOLDOWN_MS;
}

/** Recovers evidence-backed Conduit state and collapses EI animation/effect records into player inputs. */
export function reconstructConduitDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const actionable = context.recordedActions.filter((action) => !GENERATED_SIGNAL_IDS.has(action.rawSkillId));
  const sorted = [...actionable].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const anchor = sorted[0];
  const evidence = openingAssassinEvidence(context.recordedActions);
  if (!anchor || !evidence) return sorted;

  // Relinquish Power immediately before the first Entity invocation proves that
  // Assassin/Impossible Odds was active. Do not invent the benchmark's weapon
  // skills or timing when EI supplies no direct evidence for those inputs.
  const needsLegendSwap = Boolean(context.professionConfig?.startingLegend) && !startsInAssassin(context);
  const needsCooldownReset =
    needsLegendSwap && evidence.entitySwap.start - anchor.start < legendSwapCooldownMs(context);
  const inferred = [
    needsLegendSwap ? inferredSkillAction(context, 'Swap Legends', anchor.start, anchor.start, -3) : null,
    evidence.impossibleOddsRecorded
      ? null
      : inferredSkillAction(context, 'Impossible Odds', anchor.start, anchor.start, -2),
    needsCooldownReset ? cooldownResetAction(anchor.start, -1) : null
  ].filter((action): action is DpsReportRecordedAction => action != null);

  return [...inferred, ...sorted].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
