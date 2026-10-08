import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { radiantFireRecharge } from '#gw2/professions/guardian/core/traits/radiance/behavior.js';
import { focusMasteryRecharge } from '#gw2/professions/guardian/core/traits/valor/index.js';
import { powerOfTheVirtuousRecharge } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { zealousBladeRecharge } from '#gw2/professions/guardian/core/traits/zeal/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Casts and Luminary's manual recharge apply Core owners in the established weapon-then-virtue order. */
export function guardianRechargeWork(
  runtime: MechanicQueriesOf<MechanicContext<GuardianRuntimeState, GuardianSkill>>,
  skill: GuardianSkill,
  work: number
): number {
  work = zealousBladeRecharge(runtime, skill, work);
  work = radiantFireRecharge(runtime, skill, work);
  work = focusMasteryRecharge(runtime, skill, work);
  return powerOfTheVirtuousRecharge(runtime, skill, work);
}
