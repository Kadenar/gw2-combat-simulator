/**
 * Owns scheduler cooldown and ammo bookkeeping.
 */
export function createCooldownController({
  state,
  traits,
  config,
  epsilon,
  adjustedCooldown,
}) {
  const ammoMaximum = (skill) => {
    if (skill.name === "Split Second" && traits.has("Shatter Storm")) return 2;
    return Number(skill.ammo || 0);
  };

  const ensureAmmo = (skill) => {
    const maximum = ammoMaximum(skill);
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        rechargeDuration: adjustedCooldown(skill, config),
        nextRechargeAt: null,
      });
    }
    return state.ammo.get(skill.id);
  };

  const refreshAmmo = (skill, at) => {
    const ammo = ensureAmmo(skill);
    if (!ammo) return null;
    while (
      ammo.nextRechargeAt != null
      && ammo.nextRechargeAt <= at + epsilon
    ) {
      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      ammo.nextRechargeAt =
        ammo.charges < ammo.maximum
          ? ammo.nextRechargeAt + ammo.rechargeDuration
          : null;
    }
    if (ammo.charges === 0 && ammo.nextRechargeAt != null) {
      state.cooldowns.set(skill.id, ammo.nextRechargeAt);
    } else {
      state.cooldowns.delete(skill.id);
    }
    return ammo;
  };

  return {
    ammoMaximum,
    ensureAmmo,
    refreshAmmo,
  };
}
