/** Capture player effects at hit resolution, including capped generic buffs and profession-owned consumable pools. */
import { GW2_STANDARD_BOONS, standardBoonPresentation } from '#gw2/platform/combat/boons.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { activeBoonStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2DamageCalculation } from '#gw2/platform/events/events.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { observeRuntimeEffects } from '#gw2/platform/results/observe-effects.js';
import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';

/** Only diagnostic hits call this observer; detached counts cannot change when after-hit reactions consume buffs. */
export function snapshotActivePlayerBuffs<T extends object>(
  runtime: Gw2Runtime<T>,
  profession: RuntimeProfession<T>
): Gw2DamageCalculation['activeBuffs'] {
  const context = { config: runtime.config, runtime, time: runtime.time };
  const buffs: { kind: string; stacks: number; name?: string }[] = [];
  // Combat queries combine permanent assumptions with live boons and enforce duration/intensity stacking rules.
  for (const kind of GW2_STANDARD_BOONS) {
    const stacks = activeBoonStacks(context, kind, standardBoonPresentation(kind)?.maximumStacks ?? 25);

    if (stacks > 0) buffs.push({ kind, stacks });
  }

  // Scope observation to player buffs while retaining native charge ownership and each buff's declared stack limit.
  for (const state of observeRuntimeEffects(runtime, profession, 'player-buffs')) {
    const { count } = effectStateValue(state, runtime.time);

    if (count > 0) buffs.push({ kind: state.kind, stacks: count, ...(state.name ? { name: state.name } : {}) });
  }

  return buffs;
}
