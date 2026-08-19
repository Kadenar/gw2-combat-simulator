import type { Skill } from '../../../../platform/engine/types.js';
import type { EvtcRotationActionStatus } from '../../../../evtc-analyzer/types.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const DEATHSTRIKE_START_ID = 27074;
const DEATHSTRIKE_FINISH_ID = 28625;
const PHANTOMS_ONSLAUGHT_START_ID = 62895;
const PHANTOMS_ONSLAUGHT_FINISH_ID = 62713;
const RELINQUISH_POWER_ID = 28382;
const GENERATED_SIGNAL_IDS = new Set([76818, 77116, 77141]);
const ASSASSIN_LEGEND_ID = 'LegendaryAssassin';
const DEFAULT_LEGEND_SWAP_COOLDOWN_MS = 10_000;

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function namedSkill(context: DpsReportProfessionReconstructionContext, name: string): Skill | null {
  return context.catalog?.skills.find((skill) => normalized(skill.name) === normalized(name)) || null;
}

function mergedStatus(first: DpsReportRecordedAction, second: DpsReportRecordedAction): EvtcRotationActionStatus {
  if (first.status === 'interrupted' || second.status === 'interrupted') return 'interrupted';
  if (first.status === 'reduced' || second.status === 'reduced') return 'reduced';
  if (first.status === 'unknown' || second.status === 'unknown') return 'unknown';
  return 'completed';
}

function mergeSplitCast(
  actions: readonly DpsReportRecordedAction[],
  startId: number,
  finishId: number
): DpsReportRecordedAction[] {
  const consumed = new Set<DpsReportRecordedAction>();
  const result: DpsReportRecordedAction[] = [];
  for (const action of actions) {
    if (consumed.has(action)) continue;
    if (action.rawSkillId !== startId) {
      result.push(action);
      continue;
    }

    const finish = actions.find(
      (candidate) =>
        !consumed.has(candidate) && candidate.rawSkillId === finishId && Math.abs(candidate.start - action.end) <= 10
    );
    if (!finish) {
      result.push(action);
      continue;
    }

    consumed.add(finish);
    result.push({
      ...action,
      end: finish.end,
      status: mergedStatus(action, finish),
      metadataAccurate: action.metadataAccurate && finish.metadataAccurate,
      canonicalSkillId: startId,
      canonicalName: action.rawName
    });
  }

  return result;
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
  return {
    start,
    end,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: end > start ? 'completed' : 'instant',
    // Recorded event indexes are non-negative. A negative synthetic index only
    // orders inferred setup before real casts that share its timestamp.
    eventIndex: sameTimestampOrder,
    isSwap: normalized(skill.name) === 'swap weapons',
    metadataAccurate: false,
    inference: 'conduit-opening',
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
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
  const actionable = context.recordedActions.filter((action) => {
    if (GENERATED_SIGNAL_IDS.has(action.rawSkillId)) return false;
    if (action.rawSkillId !== RELINQUISH_POWER_ID) return true;
    return !context.recordedActions.some(
      (candidate) =>
        normalized(candidate.rawName).startsWith('legendary ') &&
        candidate.start >= action.start &&
        candidate.start - action.start <= 5
    );
  });
  const deathstrikes = mergeSplitCast(actionable, DEATHSTRIKE_START_ID, DEATHSTRIKE_FINISH_ID);
  const merged = mergeSplitCast(deathstrikes, PHANTOMS_ONSLAUGHT_START_ID, PHANTOMS_ONSLAUGHT_FINISH_ID).sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const anchor = merged[0];
  const evidence = openingAssassinEvidence(context.recordedActions);
  if (!anchor || !evidence) return merged;

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

  return [...inferred, ...merged].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}
