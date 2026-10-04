import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';

import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { balanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Effect owners expose the same selected balance values as combat; presentation supplies no stacking rules. */
export function warriorBuffPolicies(context: unknown): BuffStatePolicy[] {
  const policies: BuffStatePolicy[] = [
    { kind: 'signet-of-fury-active', maximumStacks: 1 },
    { kind: 'peak-performance', maximumStacks: 1 },
    { kind: 'fire-aura', maximumStacks: 1 },
    { kind: 'burst-precision', maximumStacks: 1 },
    { kind: 'tactical-reload', maximumStacks: 1 },
    { kind: 'magebane-tether', maximumStacks: 1 },
    { kind: 'berserk', maximumStacks: 1 },
    { kind: 'overcharged-cartridges', maximumStacks: 1 },
    { kind: 'supercharged-cartridges', maximumStacks: 1 },
    { kind: 'guns-and-glory', maximumStacks: 1 },
    { kind: 'positive-flow' }
  ];
  for (const [kind, id] of [
    ['signet-mastery', TRAIT.SIGNET_MASTERY],
    ['berserkers-power', TRAIT.BERSERKERS_POWER],
    ['furious-surge', TRAIT.FURIOUS],
    ['fierce-as-fire', TRAIT.FIERCE_AS_FIRE],
    ['attackers-insight', TRAIT.ATTACKERS_INSIGHT]
  ] as const) {
    const profile = balanceProfileFromContext(context, id);
    if (profile) policies.push({ kind, maximumStacks: balanceProfileNumber(profile, 'maximumStacks') });
  }

  return policies;
}

/** Observe mode, Flow, and cartridge owners directly, including refreshes and consumption without a buff packet. */
export function warriorEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<WarriorRuntimeState, WarriorSkill>>
): EffectState[] {
  const specialization = runtime.profession.specialization;
  if (specialization.kind === 'Bladesworn') {
    const state = specialization.state;
    const maximum = balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.GUNS_AND_GLORY)!, 'maximumStacks');
    const latest = state.overchargedCartridgeWindows.at(-1);
    return [
      timedEffectState('guns-and-glory', [{ stacks: 1, expiresAt: state.gunsAndGloryUntil }], 1, {
        measure: 'remaining-duration',
        durationLimit: maximum
      }),
      timedEffectState('positive-flow', [
        ...(runtime.combatActive ? [{ stacks: 1, expiresAt: null }] : []),
        ...state.flowStabilizerWindows.map((window) => ({ stacks: 2, expiresAt: window.expiresAt })),
        { stacks: state.traitPositiveFlowStacks, expiresAt: state.traitPositiveFlowUntil }
      ]),
      ...(['overcharged-cartridges', 'supercharged-cartridges'] as const).map((kind) =>
        timedEffectState(
          kind,
          latest && latest.supercharged === (kind === 'supercharged-cartridges')
            ? [{ stacks: 1, expiresAt: latest.expiresAt }]
            : [],
          1
        )
      )
    ];
  }

  if (specialization.kind === 'Berserker')
    return [
      timedEffectState(
        'berserk',
        specialization.state.berserkActive ? [{ stacks: 1, expiresAt: specialization.state.berserkUntil }] : [],
        1
      ),
      timedEffectState('fire-aura', [{ stacks: 1, expiresAt: specialization.state.fireAuraUntil }], 1)
    ];
  if (specialization.kind === 'Spellbreaker')
    return [
      timedEffectState(
        'attackers-insight',
        specialization.state.attackerInsightExpiries.map((expiresAt) => ({ expiresAt, stacks: 1 })),
        balanceProfileNumber(balanceProfileFromContext(runtime, TRAIT.ATTACKERS_INSIGHT)!, 'maximumStacks')
      ),
      timedEffectState('magebane-tether', [{ stacks: 1, expiresAt: specialization.state.magebaneTetherUntil }], 1)
    ];
  return [];
}
