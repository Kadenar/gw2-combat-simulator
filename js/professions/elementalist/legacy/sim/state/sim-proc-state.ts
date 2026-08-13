import type {
  ElementalistLegacyRuntimeState,
  ElementalistProcState,
} from "../../types.js";

export const PROC_STATE_KEYS: ReadonlySet<string> = new Set([
  "bountifulPowerStacks",
  "sigilCritAccum",
  "sigilDoomPending",
  "traitBurnPrecAccum",
  "traitRagingStormAccum",
  "traitArcanePrecAccum",
  "traitRenewingStaminaAccum",
  "freshAirAccum",
  "freshAirResetAt",
  "electricEnchantmentStacks",
  "dazingDischargeUntil",
  "shatteringStoneHits",
  "shatteringStoneUntil",
  "familiarCastSeq",
  "familiarCanceledCastIds",
  "familiarCanceledLoggedCastIds",
  "lastEmpoweredFamiliarByBasic",
  "foodCritProcAccum",
]);

export function createProcState(): ElementalistProcState {
  return {
    bountifulPowerStacks: 0,
    sigilCritAccum: 0,
    sigilDoomPending: false,
    traitBurnPrecAccum: 0,
    traitRagingStormAccum: 0,
    traitArcanePrecAccum: 0,
    traitRenewingStaminaAccum: 0,
    freshAirAccum: 0,
    freshAirResetAt: -Infinity,
    electricEnchantmentStacks: 0,
    dazingDischargeUntil: 0,
    shatteringStoneHits: 0,
    shatteringStoneUntil: 0,
    familiarCastSeq: 0,
    familiarCanceledCastIds: {},
    familiarCanceledLoggedCastIds: {},
    lastEmpoweredFamiliarByBasic: {},
    foodCritProcAccum: 0,
  };
}

export function getProcState(
  S: ElementalistLegacyRuntimeState,
): ElementalistProcState {
  if (!S.procState) S.procState = createProcState();
  return S.procState;
}

export function setProcStateValue(
  S: ElementalistLegacyRuntimeState,
  key: string,
  value: unknown,
): unknown {
  if (PROC_STATE_KEYS.has(key)) {
    getProcState(S)[key] = value;
    return value;
  }
  S[key] = value;
  return value;
}
