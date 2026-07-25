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

  const syncAmmoCooldown = (skill, ammo, at) => {
    const activeLockout = Number(state.cooldowns.get(skill.id) || 0);
    const readyAt = Math.max(
      activeLockout > at + epsilon ? activeLockout : 0,
      ammo.charges === 0 ? Number(ammo.nextRechargeAt || 0) : 0,
    );
    if (readyAt > at + epsilon) {
      state.cooldowns.set(skill.id, readyAt);
    } else {
      state.cooldowns.delete(skill.id);
    }
  };

  /**
   * Lazily initializes ammo tracking for skills that use charges.
   */
  const ensureAmmo = (skill, at = state.time) => {
    const maximum = ammoMaximum(skill);
    if (!maximum) return null;
    if (!state.ammo.has(skill.id)) {
      state.ammo.set(skill.id, {
        charges: maximum,
        maximum,
        rechargeDuration: Math.max(
          0,
          Number(rechargeDuration(skill, at) || 0),
        ),
        nextRechargeAt: null,
      });
    }
    return state.ammo.get(skill.id);
  };

  /**
   * Advances ammo recharge state to a specific time and mirrors full
   * depletion into the shared cooldown map.
   */
  const refreshAmmo = (skill, at) => {
    const ammo = ensureAmmo(skill, at);
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
    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  /**
   * Spends one charge and, when needed, starts the recharge timer.
   */
  const spendAmmo = (skill, at) => {
    const ammo = refreshAmmo(skill, at);
    if (!ammo || ammo.charges <= 0) return false;
    ammo.charges -= 1;
    if (ammo.nextRechargeAt == null) {
      ammo.rechargeDuration = Math.max(
        0,
        Number(rechargeDuration(skill, at) || 0),
      );
      ammo.nextRechargeAt = at + ammo.rechargeDuration;
    }
    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  /**
   * Applies the short between-cast recharge independently from count recharge.
   */
  const setAmmoLockout = (skill, readyAt, at = state.time) => {
    const ammo = ensureAmmo(skill, at);
    if (!ammo) return null;
    state.cooldowns.set(
      skill.id,
      Math.max(
        Number(state.cooldowns.get(skill.id) || 0),
        Number(readyAt || 0),
      ),
    );
    syncAmmoCooldown(skill, ammo, at);
    return ammo;
  };

  return Object.freeze({
    ammoMaximum,
    ensureAmmo,
    refreshAmmo,
    setAmmoLockout,
    spendAmmo,
  });
}
