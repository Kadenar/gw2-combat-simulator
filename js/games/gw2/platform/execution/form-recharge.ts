import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * Manual and automatic exits start the entry skill's cooldown. Exits during preparation leave it ready.
 * The entry must declare `rechargeOwner: 'formExit'` so cast completion does not also start its recharge.
 */
export function rechargeOnFormExit(
  runtime: Pick<MechanicContext, 'time' | 'engagement' | 'cooldownController'>,
  entry: Skill,
  reduction = 0
): void {
  if (entry.rechargeOwner !== 'formExit')
    throw new TypeError(`Skill ${entry.id} must declare rechargeOwner 'formExit' to recharge on form exit.`);

  if (runtime.engagement.preparationComplete())
    runtime.cooldownController.startRecharge(entry, runtime.time, Math.max(0, gw2BaseRecharge(entry) - reduction));
  else runtime.cooldownController.clear(entry.id);
}
