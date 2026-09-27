import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { DamageEvent } from '#gw2/platform/engine/events/events.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { GuardianStrikeFields } from '#gw2/professions/guardian/types.js';

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

/** Child packets retain their activation without copying hostile flags into self-state applications. */
export function guardianCastCause(runtime: Gw2Runtime<GuardianRuntimeState>, cast: RuntimeCast): Gw2ResolverEvent {
  return {
    type: 'buff',
    at: runtime.time,
    source: 'guardian',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id
  };
}
