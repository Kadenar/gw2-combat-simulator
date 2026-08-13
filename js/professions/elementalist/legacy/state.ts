import type { ElementalistConfig, ElementalistState } from "./types.js";

export function createElementalistState(
  config: ElementalistConfig = {},
): ElementalistState {
  return {
    primaryAttunement: config.startAttunement || "Fire",
    secondaryAttunement: config.secondaryAttunement || "Fire",
    catalystEnergy: Number(config.catalystEnergy || 0),
    evokerElement: config.evokerElement || null,
    evokerCharges: Number(config.evokerCharges ?? 6),
    evokerEmpowered: Number(config.evokerEmpowered || 0),
    pistolBullets: {
      Fire: false,
      Water: false,
      Air: false,
      Earth: false,
      ...(config.pistolBullets || {}),
    },
  };
}

export function snapshotElementalistState(
  state: ElementalistState,
): ElementalistState {
  return structuredClone(state);
}
