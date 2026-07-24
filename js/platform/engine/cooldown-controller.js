/**
 * Owns common cooldown and ammo recharge bookkeeping. Professions may override
 * maximum ammo and recharge calculation without duplicating the state machine.
 */
export function createCooldownController({
  state,
  epsilon = 0.0001,
  rechargeDuration,
  maximumAmmo = skill => Number(skill.ammo || 0),
}) {
  if (!state?.ammo || !state?.cooldowns) {
    throw new TypeError("Cooldown controller requires scheduler state.");
  }
  if (typeof rechargeDuration !== "function") {
    throw new TypeError("Cooldown controller requires rechargeDuration.");
  }

  const ammoMaximum = skill =>
    Math.max(0, Number(maximumAmmo(skill) || 0));

  const ensureAmmo = skill => {
    const maximum = ammoMaximum(skill);
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        rechargeDuration: rechargeDuration(skill),
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

  return Object.freeze({
    ammoMaximum,
    ensureAmmo,
    refreshAmmo,
  });
}
