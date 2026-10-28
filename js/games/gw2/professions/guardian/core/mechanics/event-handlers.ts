import { ACTOR } from '#gw2/platform/constants.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { DamageEvent } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { GuardianRuntime, GuardianSkill, GuardianStrikeFields } from '#gw2/professions/guardian/types.js';

/** Retains Guardian defaults and caller overrides for strikes emitted in either phase. */
export function buildGuardianStrike(fields: GuardianStrikeFields): DamageEvent {
  return buildResolverStrike({
    source: 'guardian',
    actorType: ACTOR.PLAYER,
    skillWeapon: '',
    canCrit: true,
    ...fields
  });
}

/** Child packets retain their activation without copying hostile flags into self-state applications. */
export function guardianCastCause(
  runtime: GuardianRuntime,
  cast: { id: string; skill: Pick<RuntimeCast<GuardianSkill>['skill'], 'id' | 'name'> }
): Gw2ResolverEvent {
  return {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: ACTOR.PLAYER,
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
}
