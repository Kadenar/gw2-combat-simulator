import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function revenantBuffPolicies(_context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'rite-of-the-great-dwarf', maximumStacks: 1 },
    { kind: 'blocking', maximumStacks: 1 },
    { kind: 'enchanted-daggers' },
    { kind: 'unblockable' },
    { kind: 'crushing-abyss' },
    { kind: 'battle-scars' }
  ];
  return policies;
}

/** Existing expiring charge pools, including consumption, are the report source. */
export function revenantEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<RevenantRuntimeState, RevenantSkill>>
): EffectState[] {
  const core = runtime.profession.core;
  const effects = [
    timedEffectState(
      'battle-scars',
      core.battleScars.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfileFromContext(runtime, 'revenant.core.battle-scars')!, 'maximumStacks')
    )
  ];
  effects.push(
    timedEffectState('enchanted-daggers', [
      { stacks: core.enchantedDaggers.charges, expiresAt: core.enchantedDaggers.expiresAt }
    ])
  );
  effects.push(
    timedEffectState(
      'crushing-abyss',
      core.crushingAbyss.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      Number(runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE)?.maximumStacks ?? 0)
    )
  );

  return effects;
}
