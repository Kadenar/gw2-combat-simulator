import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  buildRangerPacket,
  emitRangerProfile,
  type RangerProfileDelivery
} from '#gw2/professions/ranger/core/events.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/**
 * Charges are granted only at their actual activation boundary and consumed by resolved-hit owners. A grant that
 * belongs to a pet names that lifetime at activation, so a same-time swap or merge cannot redirect it.
 */
export function grantSkillCharges(
  runtime: RangerRuntime,
  cast: RuntimeCast<RangerSkill>,
  type: string,
  profileId: SkillId,
  summonOwner?: string
): void {
  const profile = requireBalanceProfileFromContext(runtime, profileId);
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at: runtime.time,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        ...(summonOwner ? { summonOwner } : {}),
        charges: balanceProfileNumber(profile, 'charges'),
        duration: balanceProfileNumber(profile, 'duration')
      },
      type
    )
  });
}

/**
 * Spend one charge for an eligible hit, then deliver the profile's payload once at that hit. A patch that removes
 * the payload leaves the charge unspent, because the grant exists only to deliver it.
 */
export function deliverChargedHit(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  profileId: SkillId,
  spend: () => boolean,
  delivery: RangerProfileDelivery
): void {
  const profile = requireBalanceProfileFromContext(context, profileId);

  if (!profile.effects?.length || !spend()) return;

  emitRangerProfile(context, event.at, profile, delivery);
}
