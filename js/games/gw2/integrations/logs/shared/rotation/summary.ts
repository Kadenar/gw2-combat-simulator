import { actionKind } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import type { RotationActionSummary } from '#gw2/integrations/logs/shared/rotation/model.js';
import type {
  RecordedRotationAction,
  ResolvedLogAction
} from '#gw2/integrations/logs/shared/rotation/normalization.js';

/** Project resolved identity and source coordinates; adapters append their own evidence without reinterpreting it. */
export function rotationActionSummary(
  action: ResolvedLogAction<RecordedRotationAction>,
  origin: number
): RotationActionSummary {
  return {
    timestampMs: action.start - origin,
    endTimestampMs: action.end - origin,
    durationMs: action.end - action.start,
    expectedDurationMs: action.expectedDurationMs ?? null,
    rawSkillId: action.rawSkillId,
    skillId: action.skillId,
    name: action.name,
    kind: actionKind(action.skill, action.name),
    status: action.status,
    supportedByCatalog: action.skill != null
  };
}
