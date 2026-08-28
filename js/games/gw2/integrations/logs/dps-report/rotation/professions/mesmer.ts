import type { Skill } from '../../../../../platform/engine/types.js';
import { quicknessReferenceCastTimeMs } from '../../../../../platform/skills/timing.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../types.js';

const POWER_SPIKE_ID = 10212;
const MIMIC_ID = 29578;
const UNSTABLE_BLADESTORM_ID = 62607;
const FLYING_CUTTER_ID = 62510;
const BLADECALL_ID = 62560;
const BLADETURN_REQUIEM_ID = 62597;
const THOUSAND_CUTS_ID = 24755;

function catalogSkill(context: DpsReportProfessionReconstructionContext, id: number): Skill | null {
  return context.catalog?.skills.find((skill) => typeof skill.id === 'number' && Number(skill.id) === id) || null;
}

function primaryTargetHits(context: DpsReportProfessionReconstructionContext, skillId: number): number {
  if (context.report.targets?.length !== 1) return 0;
  const phaseIndex = context.report.phases.indexOf(context.phase);
  const row = context.player.targetDamageDist?.[0]?.[phaseIndex]?.find((entry) => Number(entry.id) === skillId);
  return Math.max(0, Number(row?.connectedHits ?? row?.hits ?? 0));
}

function omittedActivation(
  context: DpsReportProfessionReconstructionContext,
  skillId: number,
  packets: number
): boolean {
  const recorded = context.recordedActions.filter((action) => action.rawSkillId === skillId).length;
  const hits = primaryTargetHits(context, skillId);
  return hits > recorded * packets && hits <= (recorded + 1) * packets;
}

function inferredAction(
  skill: Skill,
  start: number,
  eventIndex: number,
  duration = 0,
  inference: NonNullable<DpsReportRecordedAction['inference']> = 'virtuoso-opening'
): DpsReportRecordedAction {
  return {
    start,
    end: start + duration,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: duration > 0 ? 'completed' : 'instant',
    eventIndex,
    isSwap: false,
    metadataAccurate: false,
    expectedDurationMs: duration,
    inference,
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}

/** Recovers the Troubadour precast chain from later Mimic timing and single-target Bladestorm packet totals. */
function recoverTroubadourOpening(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): readonly DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'troubadour') return actions;
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const first = sorted[0];
  if (!first) return sorted;

  const inferred: DpsReportRecordedAction[] = [];
  const unstableBladestorm = catalogSkill(context, UNSTABLE_BLADESTORM_ID);
  let cursor = first.start;
  if (unstableBladestorm && omittedActivation(context, UNSTABLE_BLADESTORM_ID, 8)) {
    const duration = quicknessReferenceCastTimeMs(unstableBladestorm);
    cursor -= duration;
    inferred.unshift(inferredAction(unstableBladestorm, cursor, first.eventIndex - 1, duration, 'troubadour-opening'));
  }

  const mimic = catalogSkill(context, MIMIC_ID);
  const selectedMimic =
    !context.selectedSkillNames?.length ||
    context.selectedSkillNames.some((name) => name.trim().toLowerCase() === 'mimic');
  const recordedMimics = sorted.filter((action) => action.rawSkillId === MIMIC_ID);
  const omittedOpeningMimic =
    recordedMimics.length >= 2 &&
    recordedMimics[0].start - context.phase.start >= 12_000 &&
    recordedMimics[1].start - recordedMimics[0].start <= 45_000;
  if (mimic && selectedMimic && omittedOpeningMimic) {
    const duration = quicknessReferenceCastTimeMs(mimic);
    cursor -= duration;
    inferred.unshift(inferredAction(mimic, cursor, first.eventIndex - 2, duration, 'troubadour-opening'));
  }

  return [...inferred, ...sorted];
}

/** Recovers the three Virtuoso opener casts only when single-target packet totals prove one activation was omitted. */
function recoverVirtuosoOpening(
  context: DpsReportProfessionReconstructionContext,
  actions: readonly DpsReportRecordedAction[]
): readonly DpsReportRecordedAction[] {
  if (context.profile.specializationId !== 'virtuoso') return actions;
  const sorted = [...actions].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
  const first = sorted[0];
  if (!first) return sorted;

  const unstableBladestorm = catalogSkill(context, UNSTABLE_BLADESTORM_ID);
  const thousandCuts = catalogSkill(context, THOUSAND_CUTS_ID);
  const bladeturnRequiem = catalogSkill(context, BLADETURN_REQUIEM_ID);
  const firstFlyingCutter = sorted.find((action) => action.rawSkillId === FLYING_CUTTER_ID);
  const firstBladecall = sorted.find((action) => action.rawSkillId === BLADECALL_ID);
  const inferred: DpsReportRecordedAction[] = [];

  if (unstableBladestorm && omittedActivation(context, UNSTABLE_BLADESTORM_ID, 8)) {
    const duration = quicknessReferenceCastTimeMs(unstableBladestorm);
    inferred.push(inferredAction(unstableBladestorm, first.start - duration, first.eventIndex - 3, duration));
  }

  if (thousandCuts && omittedActivation(context, THOUSAND_CUTS_ID, 10)) {
    inferred.push(inferredAction(thousandCuts, firstFlyingCutter?.start ?? first.end, first.eventIndex - 2));
  }

  if (bladeturnRequiem && omittedActivation(context, BLADETURN_REQUIEM_ID, 5)) {
    inferred.push(inferredAction(bladeturnRequiem, firstBladecall?.start ?? first.end, first.eventIndex - 1));
  }

  return [...sorted, ...inferred].sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex);
}

/** Keeps Power Spike independent and restores evidence-backed Mesmer opener casts omitted by EI. */
export function reconstructMesmerDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const actions = context.recordedActions.map((action) =>
    action.rawSkillId === POWER_SPIKE_ID ? { ...action, independentTimeline: true } : action
  );
  return recoverTroubadourOpening(context, recoverVirtuosoOpening(context, actions));
}
