import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';

/** Only the selected elite supplies its effect policies, using the same caps as its mechanics. */
export function luminaryBuffPolicies(): BuffStatePolicy[] {
  return [
    { kind: 'guardian-daring-advance', maximumStacks: 1 },
    { kind: 'guardian-piercing-stance', maximumStacks: 1 },
    { kind: 'radiant-forge', maximumStacks: 1 },
    { kind: 'light-aura', maximumStacks: 1 },
    { kind: 'radiant-armaments', maximumStacks: 1 },
    { kind: 'guardian-radiant-armaments', maximumStacks: 1 },
    { kind: 'guardian-radiant-courage-sword', maximumStacks: 1 },
    { kind: 'guardian-empowered-armaments', maximumStacks: 1 }
  ];
}

/** Observe the owning pools so consumption, replacement, and expiry agree with combat. */
export function luminaryEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<GuardianRuntimeState, GuardianSkill>>
): EffectState[] {
  const state = luminaryState.from(runtime);
  const effects: EffectState[] = [];
  // Radiant Armaments replaces its predecessor even when the new weapon grants a shorter window.
  const armament = runtime.combat.boonApplications('guardian-radiant-armaments').at(-1);
  effects.push(
    timedEffectState(
      'guardian-radiant-armaments',
      armament ? [{ stacks: 1, expiresAt: armament.expiresAt, source: armament.event }] : [],
      1,
      { source: armament?.event }
    )
  );
  effects.push(
    timedEffectState('radiant-forge', state.radiantForge ? [{ stacks: 1, expiresAt: state.radiantForgeEndsAt }] : [], 1)
  );
  for (const [kind, expiresAt] of [
    ['guardian-empowered-armaments', state.empoweredArmamentsUntil],
    ['guardian-piercing-stance', state.piercingStanceUntil],
    ['light-aura', state.lightAuraUntil]
  ] as const)
    effects.push(timedEffectState(kind, [{ stacks: 1, expiresAt }], 1));

  return effects;
}
