import type { Skill } from '#gw2/platform/engine/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import { encounterEndTime } from '#gw2/integrations/logs/evtc/rotation/encounter.js';
import { playerInstance, rawSkillName } from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export interface RangerActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export interface RangerRotationSkill extends Skill {
  readonly petSkill?: boolean;
  readonly petAutonomousSkill?: boolean;
  readonly unleashedPetSkill?: boolean;
}

export {
  catalogDuration as recordedDuration,
  instantAction as directAction
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
export { playerInstance, rawSkillName };

export function firstPlayerEventTime(context: EvtcProfessionReconstructionContext): number | null {
  const times = context.log.events
    .filter(
      (event) => event.time > 0 && (event.source === context.playerAddress || event.target === context.playerAddress)
    )
    .map((event) => event.time);
  return times.length ? Math.min(...times) : null;
}

export function rangerSkill(
  context: EvtcProfessionReconstructionContext,
  skillId: number,
  name = rawSkillName(context, skillId)
): RangerRotationSkill | null {
  return findRotationSkill(skillId, name, context.catalog, context.profile) as RangerRotationSkill | null;
}

export function finalizeRangerActions(
  context: EvtcProfessionReconstructionContext,
  actions: readonly EvtcRecordedRotationAction[]
): EvtcRecordedRotationAction[] {
  const encounterEnd = encounterEndTime(context.log);
  const completionTolerance = context.profile.specializationId === 'druid' ? 200 : 0;
  return encounterEnd == null
    ? [...actions]
    : actions.filter((action) => action.start < encounterEnd + completionTolerance);
}
