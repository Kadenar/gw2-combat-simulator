import type { Skill } from '#gw2/platform/engine/types.js';
import { findRotationSkill, normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const HARBINGER_SHROUD = Object.freeze({ name: 'Harbinger Shroud', skillId: 62567 });
const HARBINGER_SHROUD_SKILL_IDS = new Set([62539, 62563, 62611, 62621, 62672]);

function actionSkill(action: DpsReportRecordedAction, context: DpsReportProfessionReconstructionContext): Skill | null {
  return findRotationSkill(
    action.canonicalSkillId ?? action.rawSkillId,
    action.canonicalName ?? action.rawName,
    context.catalog,
    context.profile
  );
}

function recoverHarbingerOpening(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'harbinger') return [...actions];
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const openingEvidence = sorted.find((action) => {
    const skill = actionSkill(action, context);
    return (
      HARBINGER_SHROUD_SKILL_IDS.has(Number(action.canonicalSkillId ?? action.rawSkillId)) ||
      skill?.shroud === 'harbinger' ||
      normalized(action.canonicalName || action.rawName) === 'exit harbinger shroud'
    );
  });
  if (!openingEvidence) return sorted;

  const recordedEntry = sorted.find(
    (action) =>
      (action.canonicalSkillId ?? action.rawSkillId) === HARBINGER_SHROUD.skillId ||
      normalized(action.canonicalName || action.rawName) === normalized(HARBINGER_SHROUD.name)
  );
  if (recordedEntry && recordedEntry.start <= openingEvidence.start) return sorted;

  const at = Math.min(openingEvidence.start, context.phase.start);
  const inferred: DpsReportRecordedAction = {
    start: at,
    end: at,
    rawSkillId: HARBINGER_SHROUD.skillId,
    rawName: HARBINGER_SHROUD.name,
    status: 'instant',
    eventIndex: Math.min(-1, ...sorted.map((action) => action.eventIndex - 1)),
    isSwap: false,
    metadataAccurate: false,
    inference: 'harbinger-shroud',
    canonicalSkillId: HARBINGER_SHROUD.skillId,
    canonicalName: HARBINGER_SHROUD.name
  };
  return [inferred, ...sorted];
}

/** Recovers an omitted opening shroud entry and drops canceled weapon-1 probes that would replay as real attacks. */
export function reconstructNecromancerDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const committed = context.recordedActions.filter((action) => {
    const skill = actionSkill(action, context);
    const autoattack =
      normalized(skill?.slot) === 'weapon_1' || context.report.skillMap[`s${action.rawSkillId}`]?.autoAttack === true;
    return !(autoattack && action.status === 'interrupted');
  });
  return recoverHarbingerOpening(context, committed);
}
