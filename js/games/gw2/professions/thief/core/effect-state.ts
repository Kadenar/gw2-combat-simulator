import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { ThiefRuntimeState, ThiefSkill } from '#gw2/professions/thief/types.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Core owns shared venom and trait effects; selected elites register their own policies. */
export function thiefBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [{ kind: 'spider-venom' }, { kind: 'skale-venom' }, { kind: 'devourer-venom' }];
  for (const [kind, id] of [['lead-attacks', TRAIT.LEAD_ATTACKS]] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Lead Attacks reads the same retained expiries that grantTimedStacks mutates. */
export function thiefEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<ThiefRuntimeState, ThiefSkill>>
): EffectState[] {
  return [
    ...(
      [
        ['spider-venom', ID.SPIDER_VENOM],
        ['skale-venom', ID.SKALE_VENOM],
        ['devourer-venom', ID.DEVOURER_VENOM]
      ] as const
    ).map(([kind, id]) =>
      timedEffectState(
        kind,
        (runtime.profession.core.venomChargeBatches[String(id)] ?? []).map((grant) => ({
          stacks: grant.charges,
          expiresAt: grant.expiresAt
        }))
      )
    ),
    timedEffectState(
      'lead-attacks',
      runtime.profession.core.leadAttackExpirations.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS)!, 'maximumStacks')
    )
  ];
}
