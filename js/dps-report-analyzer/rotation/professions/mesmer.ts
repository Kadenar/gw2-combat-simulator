import type { DpsReportProfessionReconstructionContext, DpsReportRecordedAction } from '../types.js';

const POWER_SPIKE_ID = 10212;

/** Keeps EI's Power Spike timestamps so Mantra ammo recharge remains valid in reconstructed rotations. */
export function reconstructMesmerDpsReportActions(
  context: DpsReportProfessionReconstructionContext
): readonly DpsReportRecordedAction[] {
  return context.recordedActions.map((action) =>
    action.rawSkillId === POWER_SPIKE_ID ? { ...action, independentTimeline: true } : action
  );
}
