import type { GuardianLuminaryState } from "../../types.js";
import { defineProfessionSpecializationState } from "../../../../platform/engine/profession.js";

export function createLuminaryState(): GuardianLuminaryState {
  return {
    radiantForge: false,
    radiantForgeEndsAt: 0,
    radiantForgeEnteredAt: 0,
    radiantWeapon: "",
    radiantWeaponsUsed: {},
    empoweredArmamentsUntil: 0,
    piercingStanceUntil: 0,
    lightAuraUntil: 0,
    lightFields: [],
    radiantJusticeArmed: false,
    radiantCourageSwordArmed: false,
    radiantCourageShieldArmed: false,
    effulgentActiveUntil: 0,
    effulgentStacks: 0,
  };
}

export const luminaryState = defineProfessionSpecializationState(
  "Luminary",
  createLuminaryState,
);
