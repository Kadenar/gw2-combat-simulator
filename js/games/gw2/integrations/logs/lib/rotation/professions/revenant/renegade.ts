import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import { normalizedName as normalized } from '#gw2/integrations/logs/lib/rotation/catalog.js';

import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const ICERAZOR = Object.freeze({ name: "Icerazor's Ire", skillId: 40485 });
const RAZORCLAW = Object.freeze({ name: "Razorclaw's Rage", skillId: 42949 });
const DARKRAZOR = Object.freeze({ name: "Darkrazor's Daring", skillId: 41220 });
const BREAKRAZOR = Object.freeze({ name: "Breakrazor's Bastion", skillId: 45686 });
const WARBAND_ACTIONS = Object.freeze([ICERAZOR, RAZORCLAW, DARKRAZOR, BREAKRAZOR]);

/** Maps represented enhanced warband IDs to base inputs with their instant replay duration. */
export function reconstructRenegadeDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  return (
    [...context.recordedActions]
      // Band Together reports the enhanced summon signal, but rotations must
      // cast the base warband skill so the simulator can apply the active trait.
      .map((action) => {
        const warband = WARBAND_ACTIONS.find(
          (identity) =>
            action.rawSkillId === identity.skillId ||
            action.rawSkillId === RENEGADE_ENHANCED_SKILL_BY_ID[identity.skillId] ||
            normalized(action.rawName) === normalized(identity.name)
        );
        if (!warband) return action;
        // Keep the base player input, but never charge its normal cast duration against an enhanced summon’s idle gaps.
        const enhanced = action.rawSkillId === RENEGADE_ENHANCED_SKILL_BY_ID[warband.skillId];
        return {
          ...action,
          canonicalSkillId: warband.skillId,
          canonicalName: warband.name,
          ...(enhanced ? { replayDurationMs: 0 } : {})
        };
      })
      .sort((left, right) => left.start - right.start || left.eventIndex - right.eventIndex)
  );
}
