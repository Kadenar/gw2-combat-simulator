import { BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { GuardianCoreState } from '#gw2/professions/guardian/core/state.js';

export function guardianRuntimeState(context: Gw2ModifierContext): Partial<GuardianCoreState> {
  return readProfessionCoreState<GuardianCoreState>(context.runtime?.profession);
}

/** Uses chronological self-boon queries while retaining Righteous Instincts' stacked Resolution window. */
export function guardianBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  return (
    boonActive(context, boon) ||
    (boon === boonKey(BOON.RESOLUTION) && (guardianRuntimeState(context).resolutionUntil || 0) > context.time)
  );
}

/** Select the latest accepted Radiant Armaments grant, including shorter replacements. */
export function latestRadiantArmaments(context: Gw2ModifierContext): SimulationEvent | null {
  // A live latest-application query includes only accepted grants, including shorter replacements.
  if (context.runtime)
    return (
      context.runtime.buffs
        ?.get('guardian-radiant-armaments')
        ?.filter((application) => application.at <= context.time)
        .at(-1)?.event ?? null
    );

  let latest: SimulationEvent | null = null;
  for (const event of context.events || []) {
    if (event.at > context.time) break;

    if (event.type === 'buff' && event.kind === 'guardian-radiant-armaments') latest = event;
  }

  return latest;
}
