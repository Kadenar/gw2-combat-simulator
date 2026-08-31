import type { DamageEvent, SimulationEventInput, Skill } from '#gw2/platform/engine/types.js';
import type {
  GuardianEventContext,
  GuardianEventExtra,
  GuardianStrikeFields
} from '#gw2/content/professions/guardian/types.js';

export function emitGuardianEvent(
  context: GuardianEventContext,
  skill: Skill,
  type: string,
  event: GuardianEventExtra = {}
): void {
  context.emit({
    type,
    at: event.at ?? context.effectiveEnd ?? context.state.time,
    source: 'guardian',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    ...event
  } as SimulationEventInput);
}

const GUARDIAN_STRIKE_DEFAULTS = Object.freeze({
  type: 'damage',
  source: 'guardian',
  actorType: 'player',
  hits: 1,
  hitIndex: 1,
  totalHits: 1,
  skillWeapon: '',
  canCrit: true
});

/**
 * Builds a guardian strike (damage) event with the canonical field layout so
 * scheduler-side (context.emit) and resolver-side (enqueueOrdered) callers
 * share one definition instead of retyping ~15 fields per site. Callers pass
 * the values that vary — at, sourceId, skillId, skillName, name, coefficient,
 * and per-pulse hitIndex/totalHits — plus any extras (isSymbol, triggeredBy,
 * stackCount, priority) which override the defaults.
 */
export function buildGuardianStrike(fields: GuardianStrikeFields): DamageEvent {
  return {
    ...GUARDIAN_STRIKE_DEFAULTS,
    ...fields
  } as DamageEvent;
}
