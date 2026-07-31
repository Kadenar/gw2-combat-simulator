import type { MesmerConfig, MesmerTroubadourState } from "../../types.js";

export function createTroubadourState(
  _config: Partial<MesmerConfig> = {},
): MesmerTroubadourState {
  return {
    numericResource: 0,
    instruments: {},
    lastInstrument: "",
  };
}

export function createTroubadourResolverState(): Record<string, never> {
  return {};
}
