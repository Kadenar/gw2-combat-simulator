import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { BalanceProfileSource } from '#gw2/platform/skills/balance-profiles.js';
import { balanceProfile, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** Only the selected elite supplies its effect policies, using the same caps as its mechanics. */
export function willbenderBuffPolicies(source: BalanceProfileSource): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'willbender-justice', maximumStacks: 1 },
    { kind: 'willbender-resolve', maximumStacks: 1 },
    { kind: 'willbender-courage', maximumStacks: 1 }
  ];
  const profile = balanceProfile(source, TRAIT.LETHAL_TEMPO);

  if (profile) policies.push({ kind: 'lethal-tempo', maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });

  return policies;
}

/** Observe the owning pools so consumption, replacement, and expiry agree with combat. */
export function willbenderEffectStates(runtime: MechanicQueriesOf<GuardianRuntime>): EffectState[] {
  const state = willbenderState.from(runtime.profession);
  const effects: EffectState[] = [];
  effects.push(
    timedEffectState(
      'lethal-tempo',
      [{ stacks: state.lethalTempo.stacks, expiresAt: state.lethalTempo.expiresAt }],
      balanceProfileNumber(balanceProfile(runtime.helpers, TRAIT.LETHAL_TEMPO)!, 'maximumStacks')
    )
  );
  for (const virtue of ['justice', 'resolve', 'courage'] as const)
    effects.push(
      timedEffectState(
        'willbender-' + virtue,
        [{ stacks: 1, expiresAt: state[(virtue + 'Until') as 'justiceUntil'] }],
        1
      )
    );

  return effects;
}
