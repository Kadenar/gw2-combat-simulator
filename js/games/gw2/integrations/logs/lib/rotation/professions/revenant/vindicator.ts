import { normalizedName as normalized, recordedActionSkill } from '#gw2/integrations/logs/lib/rotation/catalog.js';
import {
  VINDICATOR_AIRBORNE_MS,
  VINDICATOR_JUMP_SKILL
} from '#gw2/professions/revenant/specializations/vindicator/skills/dodge-skills.js';
import type {
  LogActionNormalizationContext,
  RecordedLogAction
} from '#gw2/integrations/logs/lib/rotation/normalization.js';

const DEATH_DROP_IDS = new Set([62693, 62730]);

function deathDrop(action: RecordedLogAction): boolean {
  return DEATH_DROP_IDS.has(action.rawSkillId) || normalized(action.rawName) === 'death drop';
}

/** Recover takeoff from the landing animation so airborne time occupies the jump rather than a wait. */
export function reconstructVindicatorDpsReportActions(
  context: LogActionNormalizationContext
): readonly RecordedLogAction[] {
  const landings = context.recordedActions.filter(deathDrop);
  const inputs = new Set<RecordedLogAction>();
  const jumps = new Map(
    landings.map((landing) => {
      const input = context.recordedActions.find(
        (candidate) =>
          candidate.rawSkillId === VINDICATOR_JUMP_SKILL.id &&
          Math.abs(landing.start - candidate.start - VINDICATOR_AIRBORNE_MS) <= 80
      );
      if (input) inputs.add(input);
      return [landing, input?.start ?? landing.start - VINDICATOR_AIRBORNE_MS] as const;
    })
  );
  return context.recordedActions
    .filter((action) => !inputs.has(action))
    .map((action) => {
      const start = jumps.get(action);
      if (start != null)
        return {
          ...action,
          start,
          end: start + Number(VINDICATOR_JUMP_SKILL.castTimeMs),
          expectedDurationMs: Number(VINDICATOR_JUMP_SKILL.castTimeMs),
          canonicalSkillId: Number(VINDICATOR_JUMP_SKILL.id),
          canonicalName: VINDICATOR_JUMP_SKILL.name
        };
      // EI can retain an auto during the airborne portion; replay that overlap instead of delaying the landing.
      const airborneAuto =
        normalized(recordedActionSkill(action, context)?.slot) === 'weapon_1' &&
        landings.some(
          (landing) =>
            action.start >= jumps.get(landing)! &&
            action.start < landing.start &&
            Math.abs(action.end - landing.start) <= 80
        );
      return airborneAuto ? { ...action, concurrentTimeline: true } : action;
    });
}
