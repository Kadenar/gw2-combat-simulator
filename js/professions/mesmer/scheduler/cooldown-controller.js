import {
  createCooldownController as createPlatformCooldownController,
} from "../../../platform/engine/cooldown-controller.js";

export function createCooldownController({
  state,
  traits,
  config,
  epsilon,
  adjustedCooldown,
}) {
  return createPlatformCooldownController({
    state,
    epsilon,
    rechargeDuration: skill => adjustedCooldown(skill, config),
    maximumAmmo(skill) {
      if (
        skill.name === "Split Second"
        && traits.has("Shatter Storm")
      ) return 2;
      return Number(skill.ammo || 0);
    },
  });
}
