import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { GuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import type { GuardianResolverContext, GuardianState } from '#gw2/professions/guardian/types.js';

export function guardianRuntimeState(context: Gw2ModifierContext): Partial<GuardianState> {
  return readProfessionCoreState<GuardianState>(context.runtime?.profession);
}

export function activeWeapon(context: Gw2ModifierContext): string | undefined {
  // Equipped-weapon traits follow swaps at impact time, including delayed attacks from the previous weapon.
  const weaponSet = context.timeline?.activeWeaponSetAt(context.time) || 1;
  return gw2PrimaryWeapon(context.config, weaponSet);
}

export function isOneHandedWeapon(weapon: string | undefined): boolean {
  return (
    typeof weapon === 'string' && !['Greatsword', 'Hammer', 'Longbow', 'Short Bow', 'Spear', 'Staff'].includes(weapon)
  );
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

export function guardianResolverState(context: GuardianResolverContext): GuardianCoreState {
  return professionCoreState(context);
}
