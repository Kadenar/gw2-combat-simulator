import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { necromancerActiveBoonCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { attribution } from '#gw2/professions/necromancer/specializations/ritualist/mechanics/attribution.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Attribute shared boons to their triggering cast and resolve eligible summons when each packet is emitted. */
export function ritualistPartyBoonPolicy(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>
): Pick<ProfileEmission, 'attribution' | 'transform'> {
  return {
    attribution: { ...attribution(cast), source: 'necromancer' },
    transform: (event) => ({
      ...event,
      icon: cast.skill.icon,
      offTarget: cast.command.offTarget,
      audience: {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: necromancerActiveBoonCompanionIds(runtime)
      }
    })
  };
}
