import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type {
  NecromancerResolverContext,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Reads permanent and timed Chilled target state at the requested timestamp. */
export function targetIsChilled(context: NecromancerResolverContext, at: number): boolean {
  if (context.config.target?.conditions?.Chilled === true || (context.config.target?.conditions?.Chilled || 0) > 0)
    return true;
  return (professionCoreState(context).targetChilledUntil || 0) > at;
}

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
