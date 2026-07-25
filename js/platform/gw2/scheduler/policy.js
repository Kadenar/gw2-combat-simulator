const QUICKNESS_ACTION_RATE = 1.5;
const ALACRITY_RECHARGE_RATE = 1.25;

function titleCase(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function configuredWeaponSet(config, weaponSet) {
  if (weaponSet === 2) {
    return [
      config.weaponSet2Primary,
      config.weaponSet2Secondary,
    ].filter(Boolean);
  }
  return [
    config.primaryWeapon,
    config.secondaryWeapon,
  ].filter(Boolean);
}

export function isGw2WeaponSkillEquipped(context, skill) {
  if (skill.type !== "Weapon" || !skill.weapon) return true;
  const configured = configuredWeaponSet(
    context.config || {},
    context.state?.activeWeaponSet === 2 ? 2 : 1,
  );
  return configured.length === 0 || configured.includes(skill.weapon);
}

/**
 * Supplies shared GW2 timing rules without coupling platform/engine to GW2.
 */
export function createGw2SchedulerPolicy(config = {}) {
  return Object.freeze({
    initialWeaponSet() {
      return Number(config.startingWeaponSet) === 2 ? 2 : 1;
    },

    validateCast(context, skill) {
      return isGw2WeaponSkillEquipped(context, skill);
    },

    effectDuration(_context, _skill, effect, baseDuration) {
      if (effect.type !== "boon" && effect.type !== "buff") {
        return baseDuration;
      }
      const name = titleCase(effect.boon || effect.kind || effect.name);
      const weaponSet = _context.state?.activeWeaponSet === 2 ? 2 : 1;
      const sigils = config.sigilSets?.[weaponSet - 1] || {};
      const bonus =
        Number(config.stats?.concentration || 0) / 1500
        + Number(config.stats?.boonDurationBonus || 0) / 100
        + Number(config.stats?.boonDurationBonuses?.[name] || 0) / 100
        + Number(sigils.boonDurationBonus || 0) / 100;
      return baseDuration * Math.max(1, Math.min(2, 1 + bonus));
    },

    castDuration(context, _skill, baseDuration) {
      return context.hasBuff("quickness", context.start)
        ? baseDuration / QUICKNESS_ACTION_RATE
        : baseDuration;
    },

    rechargeDuration(context, _skill, baseDuration) {
      const at = context.at ?? context.effectiveEnd ?? context.start;
      const rate = context.hasBuff("alacrity", at)
        ? Number(config.alacrityRechargeRate || ALACRITY_RECHARGE_RATE)
        : 1;
      return baseDuration / Math.max(Number.EPSILON, rate);
    },

    maximumAmmo(_context, skill, baseMaximum) {
      return baseMaximum ?? Number(skill.ammo || 0);
    },
  });
}
