import type { DamageEvent, SimulationEventInput } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type {
  GuardianEventContext,
  GuardianEventExtra,
  GuardianStrikeFields
} from '#gw2/professions/guardian/types.js';

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

/** Retains Guardian defaults and caller overrides for strikes emitted in either phase. */
export function buildGuardianStrike(fields: GuardianStrikeFields): DamageEvent {
  return buildResolverStrike({
    source: 'guardian',
    actorType: 'player',
    skillWeapon: '',
    canCrit: true,
    ...fields
  });
}
