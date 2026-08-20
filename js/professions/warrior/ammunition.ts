import { recordBladeswornAmmoSpend } from './specializations/bladesworn/ammunition.js';
import type { WarriorCastContext } from './types.js';

/** Routes generic ammo-spend facts to the active slice that reacts to them. */
export function recordWarriorAmmoSpend(context: WarriorCastContext, roundsSpent: number, startedFull: boolean): void {
  if (context.state.profession.specialization.kind === 'Bladesworn') {
    recordBladeswornAmmoSpend(context, roundsSpent, startedFull);
  }
}
