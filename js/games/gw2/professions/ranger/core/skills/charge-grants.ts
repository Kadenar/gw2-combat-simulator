import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { buildRangerPacket } from '#gw2/professions/ranger/core/events.js';
import type { RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Charges are granted only at their actual activation boundary and consumed by resolved-hit owners. */
export function grantSkillCharges(
  runtime: RangerRuntime,
  cast: RuntimeCast<RangerSkill>,
  type: string,
  profileId: number | string
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
        charges: balanceProfileNumber(profile, 'playerStacks'),
        duration: balanceProfileNumber(profile, 'durationMultiplier')
      },
      type
    )
  });
}
