import type { Skill } from '../../../../../../platform/engine/types.js';
import { quicknessReferenceCastTimeMs } from '../../../../../../platform/skills/timing.js';
import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const PROCESSION_OF_BLADES_ID = 30364;
const SWORD_OF_JUSTICE_ID = 9168;
const SWORD_OF_JUSTICE_DAMAGE_ID = 46469;

const OPENING_SKILLS = [
  { id: SWORD_OF_JUSTICE_ID, damageId: SWORD_OF_JUSTICE_DAMAGE_ID, packets: 4 },
  { id: PROCESSION_OF_BLADES_ID, damageId: PROCESSION_OF_BLADES_ID, packets: 10 }
];

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function catalogSkill(context: DpsReportProfessionReconstructionContext, id: number): Skill | null {
  return context.catalog?.skills.find((skill) => typeof skill.id === 'number' && Number(skill.id) === id) || null;
}

function selectedSkill(context: DpsReportProfessionReconstructionContext, skill: Skill): boolean {
  if (!context.selectedSkillNames?.length) return true;
  const selected = new Set(context.selectedSkillNames.map(normalized));
  return selected.has(normalized(skill.name));
}

function primaryTargetHits(context: DpsReportProfessionReconstructionContext, damageId: number): number {
  if (context.report.targets?.length !== 1) return 0;
  const phaseIndex = context.report.phases.indexOf(context.phase);
  const row = context.player.targetDamageDist?.[0]?.[phaseIndex]?.find((entry) => Number(entry.id) === damageId);
  return Math.max(0, Number(row?.connectedHits ?? row?.hits ?? 0));
}

function recordedCastCount(context: DpsReportProfessionReconstructionContext, skillId: number): number {
  return context.recordedActions.filter((action) => action.rawSkillId === skillId).length;
}

/** Recovers Dragonhunter precasts only when single-target packet totals prove exactly one omitted activation. */
export function reconstructDragonhunterDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  const sorted = [...context.recordedActions].sort(
    (left, right) => left.start - right.start || left.eventIndex - right.eventIndex
  );
  const anchor = sorted[0];
  if (!anchor) return [];

  const missing = OPENING_SKILLS.flatMap(({ id, damageId, packets }) => {
    const skill = catalogSkill(context, id);
    if (!skill || !selectedSkill(context, skill)) return [];
    const recorded = recordedCastCount(context, id);
    return primaryTargetHits(context, damageId) === (recorded + 1) * packets ? [skill] : [];
  });
  let start = anchor.start - missing.reduce((total, skill) => total + quicknessReferenceCastTimeMs(skill), 0);
  const inferred = missing.map((skill, index): DpsReportRecordedAction => {
    const duration = quicknessReferenceCastTimeMs(skill);
    const action = {
      start,
      end: start + duration,
      rawSkillId: Number(skill.id),
      rawName: skill.name,
      status: 'completed' as const,
      eventIndex: anchor.eventIndex - missing.length + index,
      isSwap: false,
      metadataAccurate: false,
      expectedDurationMs: duration,
      inference: 'dragonhunter-opening' as const,
      canonicalSkillId: Number(skill.id),
      canonicalName: skill.name
    };
    start = action.end;
    return action;
  });

  return [...inferred, ...sorted];
}
