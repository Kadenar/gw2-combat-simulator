import type { MesmerConfig, MesmerVirtuosoState } from "../../types.js";

export function createVirtuosoState(
  config: Partial<MesmerConfig> = {},
): MesmerVirtuosoState {
  return {
    numericResource: 0,
    nextForgeAt: config.infiniteForge ? 3 : Infinity,
    bloodsongProgress: 0,
  };
}

export function createVirtuosoResolverState(): Record<string, never> {
  return {};
}
