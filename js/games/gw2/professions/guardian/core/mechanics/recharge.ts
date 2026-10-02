import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import {
  focusMasteryRecharge,
  powerOfTheVirtuousRecharge,
  radiantFireRecharge,
  zealousBladeRecharge
} from '#gw2/professions/guardian/core/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Casts and Luminary's manual recharge apply Core owners in the established weapon-then-virtue order. */
export function guardianRechargeWork(
  runtime: Gw2Runtime<GuardianRuntimeState, GuardianSkill>,
  skill: GuardianSkill,
  work: number
): number {
  work = zealousBladeRecharge(runtime, skill, work);
  work = radiantFireRecharge(runtime, skill, work);
  work = focusMasteryRecharge(runtime, skill, work);
  return powerOfTheVirtuousRecharge(runtime, skill, work);
}
