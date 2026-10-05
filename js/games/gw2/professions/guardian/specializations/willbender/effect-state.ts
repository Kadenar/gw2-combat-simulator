import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Only the selected elite supplies its effect policies, using the same caps as its mechanics. */
export function willbenderBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'justice', maximumStacks: 1 },
    { kind: 'resolve', maximumStacks: 1 },
    { kind: 'courage', maximumStacks: 1 },
    { kind: 'willbender-justice', maximumStacks: 1 },
    { kind: 'willbender-resolve', maximumStacks: 1 },
    { kind: 'willbender-courage', maximumStacks: 1 }
  ];
  const profile = balanceProfileFromContext(context, TRAIT.LETHAL_TEMPO);
  if (profile) policies.push({ kind: 'lethal-tempo', maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  return policies;
}

/** Observe the owning pools so consumption, replacement, and expiry agree with combat. */
export function willbenderEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<GuardianRuntimeState, GuardianSkill>>
): EffectState[] {
  const state = willbenderState.from(runtime);
  const effects: EffectState[] = [];
  effects.push(
    timedEffectState(
      'lethal-tempo',
      [{ stacks: state.lethalTempo.stacks, expiresAt: state.lethalTempo.expiresAt }],
      balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.LETHAL_TEMPO)!, 'maximumStacks')
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
