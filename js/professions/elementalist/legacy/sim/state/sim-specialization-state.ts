import { clamp } from "../../../../../platform/gw2/numeric.js";

import type {
  ElementalistCatalystState,
  ElementalistEvokerState,
  ElementalistLegacyRuntimeState,
} from "../../types.js";

export function createCatalystState(
  eliteSpec: string,
  catalystEnergyMax: number,
): ElementalistCatalystState {
  return {
    energy: eliteSpec === "Catalyst" ? catalystEnergyMax : null,
    sphereActiveUntil: 0,
    sphereWindows: [],
    sphereExpiry: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
  };
}

export function createEvokerState(
  eliteSpec: string,
  startEvokerElement: string | null,
  startEvokerCharges = 6,
  startEvokerEmpowered = 0,
): ElementalistEvokerState {
  return {
    element:
      eliteSpec === "Evoker" && startEvokerElement ? startEvokerElement : null,
    charges: eliteSpec === "Evoker" ? clamp(startEvokerCharges, 0, 6) : 0,
    empowered: eliteSpec === "Evoker" ? clamp(startEvokerEmpowered, 0, 3) : 0,
    igniteStep: 0,
    igniteLastUse: -Infinity,
    elemBalanceCount: 0,
    elemBalanceActive: false,
    elemBalanceExpiry: 0,
    elemBalanceActivatedAt: -Infinity,
  };
}

export function getCatalystState(
  S: ElementalistLegacyRuntimeState,
): ElementalistCatalystState {
  if (!S.catalystState) {
    S.catalystState = {
      energy: S.energy ?? null,
      sphereActiveUntil: S.sphereActiveUntil ?? 0,
      sphereWindows: S.sphereWindows ?? [],
      sphereExpiry: S.sphereExpiry ?? { Fire: 0, Water: 0, Air: 0, Earth: 0 },
    };
  }
  return S.catalystState;
}

export function getEvokerState(
  S: ElementalistLegacyRuntimeState,
): ElementalistEvokerState {
  if (!S.evokerState) {
    S.evokerState = {
      element: S.evokerElement ?? null,
      charges: S.evokerCharges ?? 0,
      empowered: S.evokerEmpowered ?? 0,
      igniteStep: S.igniteStep ?? 0,
      igniteLastUse: S.igniteLastUse ?? -Infinity,
      elemBalanceCount: S.elemBalanceCount ?? 0,
      elemBalanceActive: S.elemBalanceActive ?? false,
      elemBalanceExpiry: S.elemBalanceExpiry ?? 0,
      elemBalanceActivatedAt: S.elemBalanceActivatedAt ?? -Infinity,
    };
  }
  return S.evokerState;
}

export function addCatalystEnergy(
  S: ElementalistLegacyRuntimeState,
  amount: number,
  maxEnergy: number,
): number | null {
  const catalystState = getCatalystState(S);
  if (catalystState.energy === null) return null;
  catalystState.energy = Math.min(maxEnergy, catalystState.energy + amount);
  return catalystState.energy;
}

export function spendCatalystEnergy(
  S: ElementalistLegacyRuntimeState,
  amount: number,
): number | null {
  const catalystState = getCatalystState(S);
  if (catalystState.energy === null) return null;
  catalystState.energy = Math.max(0, catalystState.energy - amount);
  return catalystState.energy;
}

export function activateCatalystSphere(
  S: ElementalistLegacyRuntimeState,
  attunement: string,
  startTime: number,
  durationMs: number,
): number {
  const catalystState = getCatalystState(S);
  catalystState.sphereActiveUntil = Math.max(
    catalystState.sphereActiveUntil,
    startTime + durationMs,
  );
  catalystState.sphereExpiry[attunement] = Math.max(
    catalystState.sphereExpiry[attunement] || 0,
    startTime + durationMs,
  );
  catalystState.sphereWindows.push({
    start: startTime,
    end: startTime + durationMs,
  });
  return catalystState.sphereActiveUntil;
}

export function incrementEvokerElemBalance(
  S: ElementalistLegacyRuntimeState,
  time: number,
  {
    activateEvery = 2,
    durationMs = 5000,
  }: {
    readonly activateEvery?: number;
    readonly durationMs?: number;
  } = {},
): { readonly count: number; readonly activated: boolean } {
  const evokerState = getEvokerState(S);
  if (evokerState.elemBalanceExpiry <= time) {
    evokerState.elemBalanceActive = false;
  }
  evokerState.elemBalanceCount++;
  let activated = false;
  if (evokerState.elemBalanceCount % activateEvery === 0) {
    evokerState.elemBalanceActive = true;
    evokerState.elemBalanceExpiry = time + durationMs;
    evokerState.elemBalanceActivatedAt = time;
    activated = true;
  }
  return {
    count: evokerState.elemBalanceCount,
    activated,
  };
}

export function consumeEvokerElemBalance(
  S: ElementalistLegacyRuntimeState,
): false {
  const evokerState = getEvokerState(S);
  evokerState.elemBalanceActive = false;
  evokerState.elemBalanceExpiry = 0;
  evokerState.elemBalanceActivatedAt = -Infinity;
  return false;
}

export function addEvokerCharges(
  S: ElementalistLegacyRuntimeState,
  amount: number,
  maxCharges: number,
): number {
  const evokerState = getEvokerState(S);
  evokerState.charges = Math.min(maxCharges, evokerState.charges + amount);
  return evokerState.charges;
}

export function setEvokerCharges(
  S: ElementalistLegacyRuntimeState,
  charges: number,
): number {
  const evokerState = getEvokerState(S);
  evokerState.charges = charges;
  return evokerState.charges;
}

export function addEvokerEmpowered(
  S: ElementalistLegacyRuntimeState,
  amount: number,
  maxEmpowered = Infinity,
): number {
  const evokerState = getEvokerState(S);
  evokerState.empowered = Math.min(
    maxEmpowered,
    evokerState.empowered + amount,
  );
  return evokerState.empowered;
}

export function setEvokerEmpowered(
  S: ElementalistLegacyRuntimeState,
  empowered: number,
): number {
  const evokerState = getEvokerState(S);
  evokerState.empowered = empowered;
  return evokerState.empowered;
}

export function consumeEvokerIgniteTier(
  S: ElementalistLegacyRuntimeState,
  time: number,
  {
    staleAfterMs = 15000,
    maxTier = 3,
  }: {
    readonly staleAfterMs?: number;
    readonly maxTier?: number;
  } = {},
): number {
  const evokerState = getEvokerState(S);
  if (time - evokerState.igniteLastUse > staleAfterMs)
    evokerState.igniteStep = 0;
  const tier = Math.min(evokerState.igniteStep, maxTier);
  evokerState.igniteStep = Math.min(tier + 1, maxTier);
  evokerState.igniteLastUse = time;
  return tier;
}
