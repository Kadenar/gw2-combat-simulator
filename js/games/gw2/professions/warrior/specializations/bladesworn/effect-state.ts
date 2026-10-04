import { timedEffectState, type BuffStatePolicy, type EffectState } from '#gw2/platform/combat/effect-state.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import {
  balanceProfileFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

import { bladeswornState } from '#gw2/professions/warrior/specializations/bladesworn/state.js';

/** Only the selected elite contributes its buff caps and observations. */
export function bladeswornBuffPolicies(context: unknown): BuffStatePolicy[] {
  return [
    { kind: 'tactical-reload', maximumStacks: 1 },
    { kind: 'overcharged-cartridges', maximumStacks: 1 },
    { kind: 'supercharged-cartridges', maximumStacks: 1 },
    { kind: 'guns-and-glory', maximumStacks: 1 },
    { kind: 'positive-flow' },
    {
      kind: 'fierce-as-fire',
      maximumStacks: balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.FIERCE_AS_FIRE),
        'maximumStacks'
      )
    }
  ];
}

/** Observe live owner state so consumption and expiry agree with combat. */
export function bladeswornEffectStates(
  runtime: MechanicQueriesOf<MechanicContext<WarriorRuntimeState, WarriorSkill>>
): EffectState[] {
  const state = bladeswornState.from(runtime);
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
