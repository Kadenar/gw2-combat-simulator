import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Emits the selected entry profile after the form and specialization state are established. */
export function emitNecromancerShroudTrait(
  runtime: NecromancerRuntime,
  cast: RuntimeCast<NecromancerSkill>,
  trait: number
): void {
  if (!hasTrait(runtime, trait)) return;
  const profile = requireBalanceProfileFromContext(runtime, trait);
  runtime.effects.emit({
    kind: 'profile',
    profile: profile,
    attribution: {
      source: 'Trait',
      sourceId: trait,
      actorType: 'effect',
      skillName: profile.name,
      activationId: cast.id,
      triggeredBy: cast.skill.name
    },
    skillWeaponFallback: 'Unequipped',
    transform: (event) => ({
      ...event,
      name: profile.name,
      ...(event.type === 'buff' ? {} : { offTarget: cast.command.offTarget })
    })
  });
}
