import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Core owns shared weapon and trait effects; selected elites register their own policies. */
export function elementalistBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'arcane-lightning', maximumStacks: 1 },
    { kind: 'bountiful-power-active', maximumStacks: 1 },
    { kind: 'fresh-air', maximumStacks: 1 },
    { kind: 'fire aura', maximumStacks: 1 },
    { kind: 'frost aura', maximumStacks: 1 },
    { kind: 'shocking aura', maximumStacks: 1 },
    { kind: 'magnetic aura', maximumStacks: 1 },

    { kind: 'hammer fire orb', maximumStacks: 1 },
    { kind: 'hammer water orb', maximumStacks: 1 },
    { kind: 'hammer air orb', maximumStacks: 1 },
    { kind: 'hammer earth orb', maximumStacks: 1 },

    { kind: 'shattering stone', owner: 'profession' }
  ];
  for (const [kind, id] of [['persisting flames', TRAIT.PERSISTING_FLAMES]] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Observe existing charge and timed-stack owners so replacement, consumption, and refresh need no report replay. */
export function elementalistEffectStates(runtime: MechanicQueriesOf<ElementalistRuntime>): EffectState[] {
  const stone = runtime.profession.core.shatteringStone;
  const effects = [
    timedEffectState(
      'shattering stone',
      [{ stacks: stone.charges, expiresAt: stone.expiresAt }],
      balanceProfileNumber(balanceProfileFromContext(runtime, PROFILE.shatteringStone)!, 'maximumStacks')
    )
  ];
  return effects;
}
