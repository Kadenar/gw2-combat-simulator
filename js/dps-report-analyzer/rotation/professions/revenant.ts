import type { Skill } from '../../../platform/engine/types.js';
import type { EvtcRotationActionStatus } from '../../../evtc-analyzer/types.js';
import { reconstructConduitDpsReportActions } from './revenant/conduit.js';
import { reconstructHeraldDpsReportActions } from './revenant/herald.js';
import { reconstructRenegadeDpsReportActions } from './revenant/renegade.js';
import type {
  DpsReportProfessionActionReconstructor,
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '../types.js';

const specializationReconstructors: ReadonlyMap<string, DpsReportProfessionActionReconstructor> = new Map([
  ['conduit', reconstructConduitDpsReportActions],
  ['herald', reconstructHeraldDpsReportActions],
  ['renegade', reconstructRenegadeDpsReportActions]
]);
const LEGEND_STANCE_NAME = /^legendary .+ stance$/;
const SONG_OF_THE_MISTS_SIGNAL = /^call of the (alliance|assassin|centaur|demon|dragon|dwarf|renegade)$/;
const ABYSSAL_BLITZ_CHILD_SIGNAL = /^blitz mines \((drop|detonation)\)$/;
const COMPOSITE_CASTS = [
  [27074, 28625],
  [62895, 62713]
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

function mergedStatus(first: DpsReportRecordedAction, second: DpsReportRecordedAction): EvtcRotationActionStatus {
  if (first.status === 'interrupted' || second.status === 'interrupted') return 'interrupted';
  if (first.status === 'reduced' || second.status === 'reduced') return 'reduced';
  if (first.status === 'unknown' || second.status === 'unknown') return 'unknown';
  return 'completed';
}

function mergeCompositeCast(
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
  return COMPOSITE_CASTS.reduce<DpsReportRecordedAction[]>(
    (normalizedActions, [startId, finishId]) => mergeCompositeCast(normalizedActions, startId, finishId),
    actionable
  );
}

function normalizeRevenantAutoattacks(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  let activeChainRoot: number | null = null;
  let expectedSkillId: number | null = null;
  const result: DpsReportRecordedAction[] = [];
  for (const action of sorted) {
    const skill = actionSkill(action, context);
    const autoattack = normalized(skill?.slot) === 'weapon_1';
    if (autoattack && action.status === 'interrupted') continue;
    const chainRoot = Number(skill?.chainRoot);
    if (autoattack && Number.isFinite(chainRoot)) {
      const rawSkillId = Number(skill?.id);
      const continuesChain = activeChainRoot === chainRoot && expectedSkillId != null;
      // EI normally reports the exact chain stage. Trust an explicit root reset,
      // while still repairing a truncated phase that starts on a later stage.
      const canonicalId: number =
        continuesChain && rawSkillId !== chainRoot && expectedSkillId != null
          ? expectedSkillId
          : activeChainRoot == null
            ? chainRoot
            : rawSkillId;
      const canonical: Skill | undefined = context.catalog?.skills.find(
        (candidate) => typeof candidate.id === 'number' && Number(candidate.id) === canonicalId
      );
      result.push({
        ...action,
        canonicalSkillId: canonicalId,
        canonicalName: canonical?.name || action.canonicalName || action.rawName
      });
      activeChainRoot = chainRoot;
      const next: number | null = canonical?.nextChainId == null ? null : Number(canonical.nextChainId);
      expectedSkillId = next != null && Number.isFinite(next) ? next : chainRoot;
      continue;
    }

    // Weapon and legend changes reset the equipped autoattack chain; ordinary
    // weapon/legend skills do not, so preserve EI's later chain stages across them.
    if (action.isSwap || skill?.handlerId === 'revenant.legend-swap') {
      activeChainRoot = null;
      expectedSkillId = null;
    }

    result.push(action);
  }

  return result;
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
  return normalizeRevenantAutoattacks({ ...context, recordedActions: actionable }, actionable);
}
