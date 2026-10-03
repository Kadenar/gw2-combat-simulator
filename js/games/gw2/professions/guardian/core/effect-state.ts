import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/engine/skills/balance-profiles.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function guardianBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'guardian-daring-advance', maximumStacks: 1 },
    { kind: 'guardian-piercing-stance', maximumStacks: 1 },
    { kind: 'illuminated', maximumStacks: 1 },
    { kind: 'guardian-spear-luminance', maximumStacks: 1 },
    { kind: 'guardian-symbol-of-ignition-field', maximumStacks: 1 },
    { kind: 'symbol-duration-extension', maximumStacks: 1 },
    { kind: 'guardian-inspiring-virtue', maximumStacks: 1 },
    { kind: 'justice', maximumStacks: 1 },
    { kind: 'resolve', maximumStacks: 1 },
    { kind: 'courage', maximumStacks: 1 },
    { kind: 'willbender-justice', maximumStacks: 1 },
    { kind: 'willbender-resolve', maximumStacks: 1 },
    { kind: 'willbender-courage', maximumStacks: 1 },
    { kind: 'radiant-forge', maximumStacks: 1 },
    { kind: 'light-aura', maximumStacks: 1 },
    { kind: 'radiant-armaments', maximumStacks: 1 },
    { kind: 'guardian-radiant-armaments', maximumStacks: 1 },
    { kind: 'guardian-radiant-courage-sword', maximumStacks: 1 },
    { kind: 'guardian-empowered-armaments', maximumStacks: 1 },
    { kind: 'toughness' },
    { kind: 'ashes-of-the-just' }
  ];
  for (const [kind, id] of [['lethal-tempo', TRAIT.LETHAL_TEMPO]] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Charge and virtue observations share the pools used by hit reactions and modifier gates. */
export function guardianEffectStates(runtime: Gw2Runtime<GuardianRuntimeState, GuardianSkill>): EffectState[] {
  const core = runtime.profession.core;
  const effects = [
    timedEffectState(
      'symbolic-avenger',
      core.symbolicAvengerExpirations.map((expiresAt) => ({ expiresAt, stacks: 1 })),
      balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.SYMBOLIC_AVENGER)!, 'maximumStacks')
    )
  ];
  const elite = runtime.profession.specialization;
  if (elite.kind === 'Firebrand')
    effects.push(
      timedEffectState('ashes-of-the-just', [
        { stacks: elite.state.ashes.charges, expiresAt: elite.state.ashes.expiresAt }
      ])
    );
  if (elite.kind === 'Willbender') {
    const state = elite.state;
    effects.push(
      timedEffectState(
        'lethal-tempo',
        [{ stacks: state.lethalTempoStacks, expiresAt: state.lethalTempoUntil }],
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
  }

  if (elite.kind === 'Luminary') {
    const state = elite.state;
    // Radiant Armaments replaces its predecessor even when the new weapon grants a shorter window.
    const armament = runtime.boons.get('guardian-radiant-armaments')?.at(-1);
    effects.push(
      timedEffectState(
        'guardian-radiant-armaments',
        armament ? [{ stacks: 1, expiresAt: armament.expiresAt, source: armament.event }] : [],
        1,
        { source: armament?.event }
      )
    );
    effects.push(
      timedEffectState(
        'radiant-forge',
        state.radiantForge ? [{ stacks: 1, expiresAt: state.radiantForgeEndsAt }] : [],
        1
      )
    );
    for (const [kind, expiresAt] of [
      ['guardian-empowered-armaments', state.empoweredArmamentsUntil],
      ['guardian-piercing-stance', state.piercingStanceUntil],
      ['light-aura', state.lightAuraUntil]
    ] as const)
      effects.push(timedEffectState(kind, [{ stacks: 1, expiresAt }], 1));
  }

  return effects;
}
