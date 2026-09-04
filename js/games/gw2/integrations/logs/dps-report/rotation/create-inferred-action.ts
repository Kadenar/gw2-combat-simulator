import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { DpsReportRecordedAction } from '#gw2/integrations/logs/dps-report/rotation/types.js';

interface InferredActionOptions {
  readonly status?: 'completed' | 'instant';
  readonly isSwap?: boolean;
  readonly expectedDurationMs?: number;
}

/** Builds synthetic skill actions with the shared metadata required for evidence-backed dps.report recovery. */
export function createInferredAction(
  skill: Pick<Skill, 'id' | 'name'>,
  start: number,
  end: number,
  eventIndex: number,
  inference: NonNullable<DpsReportRecordedAction['inference']>,
  options: InferredActionOptions = {}
): DpsReportRecordedAction {
  return {
    start,
    end,
    rawSkillId: Number(skill.id),
    rawName: skill.name,
    status: options.status ?? (end > start ? 'completed' : 'instant'),
    eventIndex,
    isSwap: options.isSwap ?? false,
    metadataAccurate: false,
    ...(options.expectedDurationMs == null ? {} : { expectedDurationMs: options.expectedDurationMs }),
    inference,
    canonicalSkillId: Number(skill.id),
    canonicalName: skill.name
  };
}
