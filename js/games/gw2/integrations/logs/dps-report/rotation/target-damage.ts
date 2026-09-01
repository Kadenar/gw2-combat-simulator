import type { DpsReportPhase } from '#gw2/integrations/logs/dps-report/types.js';
import type { DpsReportProfessionReconstructionContext } from '#gw2/integrations/logs/dps-report/rotation/types.js';

/** Reads one skill's connected hits when the report has an unambiguous primary target. */
export function primaryTargetHits(
  context: DpsReportProfessionReconstructionContext,
  skillId: number,
  phase: DpsReportPhase = context.phase
): number {
  if (context.report.targets?.length !== 1) return 0;
  const phaseIndex = context.report.phases.indexOf(phase);
  const row = context.player.targetDamageDist?.[0]?.[phaseIndex]?.find((entry) => Number(entry.id) === skillId);
  return Math.max(0, Number(row?.connectedHits ?? row?.hits ?? 0));
}
