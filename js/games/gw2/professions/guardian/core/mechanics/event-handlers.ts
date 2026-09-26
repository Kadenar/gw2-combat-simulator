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
