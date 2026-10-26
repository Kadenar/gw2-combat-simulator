import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { skillNumber, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import {
  buildRangerPacket,
  emitRangerAction,
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
  summonOwner?: string
): void {
  const skill = cast.skill;
  runtime.effects.emit({
    kind: 'packet',
    event: buildRangerPacket(
      {
        at: runtime.time,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        ...(summonOwner ? { summonOwner } : {}),
        charges: skillNumber(skill, 'charges'),
        duration: skillNumber(skill, 'duration')
      },
      type
    )
  });
}

/**
 * Spend one charge for an eligible hit, then deliver the action's payload once at that hit. A patch that removes
 * the payload leaves the charge unspent, because the grant exists only to deliver it.
 */
export function deliverChargedHit(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  skillId: SkillId,
  actionId: string,
  spend: () => boolean,
  delivery: RangerProfileDelivery
): void {
  const skill = requireSkillFromContext(context, skillId);
  const action = requireSkillAction(skill, actionId);

  if (!action.effects.length || !spend()) return;

  emitRangerAction(context, event.at, skill, actionId, delivery);
}
