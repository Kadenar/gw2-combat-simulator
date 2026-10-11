import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { GuardianState } from '#gw2/professions/guardian/types.js';

export function guardianRuntimeState(context: Gw2ModifierContext): Partial<GuardianState> {
  return readProfessionCoreState<GuardianState>(context.runtime?.profession);
}

/** Uses chronological self-boon queries while retaining Righteous Instincts' stacked Resolution window. */
export function guardianBoonActive(context: Gw2ModifierContext, boon: string): boolean {
  return (
    boonActive(context, boon) ||
    (boon === 'resolution' && (guardianRuntimeState(context).resolutionUntil || 0) > context.time)
  );
}

export function latestGuardianTimedBuff(context: Gw2ModifierContext, kind: string): SimulationEvent | null {
  // A live latest-application query includes only accepted grants, including shorter replacements.
  if (context.runtime)
    return (
      context.runtime.buffs
        ?.get(kind)
        ?.filter((application) => application.at <= context.time)
        .at(-1)?.event ?? null
    );
  let latest: SimulationEvent | null = null;
  for (const event of context.events || []) {
    if (event.at > context.time) break;
    if (event.type === 'buff' && event.kind === kind) latest = event;
  }

  return latest;
}
