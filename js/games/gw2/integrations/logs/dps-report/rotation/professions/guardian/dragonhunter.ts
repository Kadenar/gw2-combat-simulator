import type { Skill } from '#gw2/platform/engine/types.js';
import { quicknessReferenceCastTimeMs } from '#gw2/platform/skills/timing.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import { primaryTargetHits } from '#gw2/integrations/logs/dps-report/rotation/target-damage.js';
import type {
  DpsReportProfessionReconstructionContext,
  DpsReportRecordedAction
} from '#gw2/integrations/logs/dps-report/rotation/types.js';

const PROCESSION_OF_BLADES_ID = 30364;
const SWORD_OF_JUSTICE_ID = 9168;
const SWORD_OF_JUSTICE_DAMAGE_ID = 46469;

const OPENING_SKILLS = [
  { id: SWORD_OF_JUSTICE_ID, damageId: SWORD_OF_JUSTICE_DAMAGE_ID, packets: 4 },
  { id: PROCESSION_OF_BLADES_ID, damageId: PROCESSION_OF_BLADES_ID, packets: 10 }
];

function catalogSkill(context: DpsReportProfessionReconstructionContext, id: number): Skill | null {
  return context.catalog?.skills.find((skill) => typeof skill.id === 'number' && Number(skill.id) === id) || null;
}

function selectedSkill(context: DpsReportProfessionReconstructionContext, skill: Skill): boolean {
  if (!context.selectedSkillNames?.length) return true;
  const selected = new Set(context.selectedSkillNames.map(normalized));
  return selected.has(normalized(skill.name));
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
