import type { Skill } from '#gw2/platform/engine/types.js';
import { findRotationSkill } from '#gw2/integrations/logs/evtc/rotation/catalog.js';
import {
  instantAction,
  rawSkillName as sharedRawSkillName
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction
} from '#gw2/integrations/logs/evtc/rotation/professions/types.js';

export interface RevenantActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

export const SWAP_LEGENDS = Object.freeze({
  name: 'Swap Legends',
  skillId: -4
});

export const SIGNAL_DEDUPLICATION_WINDOW_MS = 150;

export {
  catalogDuration as runtimeDuration,
  combatStartTime as combatStart,
  hasNearbyAction as hasRecordedAction,
  playerInstance
} from '#gw2/integrations/logs/evtc/rotation/professions/shared.js';

export function rawSkillName(context: EvtcProfessionReconstructionContext, skillId: number): string {
  return sharedRawSkillName(context, skillId, false);
}

export function skillFor(context: EvtcProfessionReconstructionContext, identity: RevenantActionIdentity): Skill | null {
  return findRotationSkill(identity.skillId, identity.name, context.catalog, context.profile);
}

/** Extends the shared instant shape only when Revenant evidence proves a duration-bearing cast. */
export function directAction(
  eventIndex: number,
  start: number,
  rawSkillId: number,
  rawName: string,
  identity: RevenantActionIdentity,
  evidence: EvtcRecordedRotationAction['evidence'] = 'buff-transition',
  duration = 0
): EvtcRecordedRotationAction {
  return {
    ...instantAction(eventIndex, start, rawSkillId, rawName, identity, evidence),
    ...(duration > 0
      ? {
          end: start + duration,
          expectedDuration: duration,
          status: 'completed' as const
        }
      : {})
  };
}
