import { timedEffectState, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/engine/skills/balance-profiles.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function elementalistBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'arcane lightning', maximumStacks: 1 },
    { kind: 'bountiful power active', maximumStacks: 1 },
    { kind: 'fresh air', maximumStacks: 1 },
    { kind: 'zap buff', maximumStacks: 1 },
    { kind: 'perfect weave', maximumStacks: 1 },
    { kind: 'weave self air', maximumStacks: 1 },
    { kind: 'weave self fire', maximumStacks: 1 },
    { kind: 'weave self water', maximumStacks: 1 },
    { kind: 'weave self earth', maximumStacks: 1 },
    { kind: 'relentless fire', maximumStacks: 1 },
    { kind: 'shattering ice', maximumStacks: 1 },
    { kind: 'fire aura', maximumStacks: 1 },
    { kind: 'frost aura', maximumStacks: 1 },
    { kind: 'shocking aura', maximumStacks: 1 },
    { kind: 'magnetic aura', maximumStacks: 1 },
    { kind: 'fresh-air', maximumStacks: 1 },
    { kind: 'arcane-lightning', maximumStacks: 1 },
    { kind: 'bountiful-power-active', maximumStacks: 1 },
    { kind: 'transcendent-tempest', maximumStacks: 1 },
    { kind: 'zap-buff', maximumStacks: 1 },
    { kind: 'hare enchantment', maximumStacks: 1 },
    { kind: 'lightning blitz enchantment', maximumStacks: 1 },
    { kind: 'elements of rage', maximumStacks: 1 },

    { kind: 'hammer fire orb', maximumStacks: 1 },
    { kind: 'hammer water orb', maximumStacks: 1 },
    { kind: 'hammer air orb', maximumStacks: 1 },
    { kind: 'hammer earth orb', maximumStacks: 1 },

    { kind: 'shattering stone', owner: 'profession' }
  ];
  for (const [kind, id] of [
    ['persisting flames', TRAIT.PERSISTING_FLAMES],
    ['elemental empowerment', TRAIT.ELEMENTAL_EMPOWERMENT],
    ['empowering auras', TRAIT.EMPOWERING_AURAS]
  ] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  for (const [kind, id] of [
    ['tempestuous aria', TRAIT.TEMPESTUOUS_ARIA],
    ["familiar's-prowess", TRAIT.FAMILIARS_PROWESS]
  ] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile)
      policies.push({ kind, maximumStacks: 1, maximumDuration: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Observe existing charge and timed-stack owners so replacement, consumption, and refresh need no report replay. */
export function elementalistEffectStates(runtime: ElementalistRuntime): EffectState[] {
  const stone = runtime.profession.core.shatteringStone;
  const effects = [
    timedEffectState(
      'shattering stone',
      [{ stacks: stone.charges, expiresAt: stone.expiresAt }],
      balanceProfileNumber(balanceProfileFromContext(runtime, PROFILE.shatteringStone)!, 'maximumStacks')
    )
  ];
  const elite = runtime.profession.specialization;
  if (elite.kind === 'Catalyst')
    effects.push(
      timedEffectState(
        'elemental empowerment',
        elite.state.elementalEmpowermentExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
        balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.ELEMENTAL_EMPOWERMENT)!, 'maximumStacks')
      )
    );
  return effects;
}
