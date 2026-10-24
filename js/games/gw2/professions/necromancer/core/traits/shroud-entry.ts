import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Shroud-entry traits share cast ownership and targeting; their registrations retain delivery order. */
export function emitShroudEntryTrait(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  trait: SkillId
): void {
  emitTraitProfile(runtime, trait, trait, undefined, {
    skillName: requireBalanceProfileFromContext(runtime, trait).name,
    activationId: cast.id,
    attribution: { triggeredBy: cast.skill.name },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({ ...event, ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget }) })
  });
}
