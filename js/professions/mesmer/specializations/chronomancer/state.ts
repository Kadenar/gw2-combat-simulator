import type { MesmerChronomancerState, MesmerConfig } from "../../types.js";

export function createChronomancerState(
  _config: Partial<MesmerConfig> = {},
): MesmerChronomancerState {
  return {
    continuum: null,
    timeBombUntil: 0,
  };
}

export function createChronomancerResolverState(): Record<string, never> {
  return {};
}
