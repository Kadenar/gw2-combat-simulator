import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';

import {
  focusMasteryRecharge,
  powerOfTheVirtuousRecharge,
  radiantFireRecharge,
  zealousBladeRecharge
} from '#gw2/professions/guardian/core/traits/behavior.js';
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
