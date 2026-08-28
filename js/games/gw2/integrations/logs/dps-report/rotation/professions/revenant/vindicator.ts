import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../../types.js';

const DEATH_DROP_IDS = new Set([62693, 62730]);

function normalized(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function deathDrop(action: DpsReportRecordedAction): boolean {
  return DEATH_DROP_IDS.has(action.rawSkillId) || normalized(action.rawName) === 'death drop';
}

/** Converts EI's generated Death Drop animation into the Dodge input that owns its endurance and damage. */
export function reconstructVindicatorDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  return context.recordedActions.map((action) =>
    deathDrop(action)
      ? {
          ...action,
          canonicalSkillId: Number(context.profile.dodge.skillId),
          canonicalName: context.profile.dodge.name
        }
      : action
  );
}
