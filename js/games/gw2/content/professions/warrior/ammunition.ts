import { recordBladeswornAmmoSpend } from '#gw2/content/professions/warrior/specializations/bladesworn/mechanics/ammunition.js';
import type { WarriorCastContext } from '#gw2/content/professions/warrior/types.js';

/** Routes generic ammo-spend facts to the active slice that reacts to them. */
export function recordWarriorAmmoSpend(context: WarriorCastContext, roundsSpent: number, startedFull: boolean): void {
  if (context.state.profession.specialization.kind === 'Bladesworn') {
    recordBladeswornAmmoSpend(context, roundsSpent, startedFull);
  }
}
