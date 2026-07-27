import {
  createGw2TriggerMaterializer,
  GW2_MATERIALIZE_EVENT_TASK,
} from "./proc-materializer.js";

const QUICKNESS_ACTION_RATE = 1.5;
const ACTION_TICK_MS = 40;
const ALACRITY_RECHARGE_RATE = 1.25;

function quantizeUp(value, interval) {
  if (!(value > 0)) return 0;
  return Math.ceil(value / interval - 1e-9) * interval;
}

function baseCastDurationMs(skill) {
  if (skill.castTimeMs != null) {
    return Math.max(0, Number(skill.castTimeMs));
  }
  return Math.max(
    0,
    Number(skill.activation ?? skill.castTime ?? 0) * 1000,
  );
}

function castBoundTiming(effect, baseCastMs) {
  if (!(baseCastMs > 0)) return false;
  if (Array.isArray(effect.ticks) && effect.ticks.length) {
    return Math.abs(
      Number(effect.ticks.at(-1).atMs) - baseCastMs,
    ) < 0.001;
  }
  if (Array.isArray(effect.atMsList) && effect.atMsList.length) {
    return Math.abs(
      Number(effect.atMsList.at(-1)) - baseCastMs,
    ) < 0.001;
  }
  if (effect.atMs == null) return false;
  const hits = Math.max(1, Math.trunc(Number(effect.hits || 1)));
  const lastAtMs =
    Number(effect.atMs)
    + (hits - 1) * Math.max(0, Number(effect.intervalMs || 0));
  return Math.abs(lastAtMs - baseCastMs) < 0.001;
}

function scaleCastBoundTiming(context, skill, effect) {
  const baseCastMs = baseCastDurationMs(skill);
  if (!castBoundTiming(effect, baseCastMs)) return effect;
  const adjustedCastMs =
    Math.max(0, Number(context.fullEnd - context.start)) * 1000;
  const scale = adjustedCastMs / baseCastMs;
  return {
    ...effect,
    ...(Array.isArray(effect.ticks)
      ? {
          ticks: effect.ticks.map(tick => ({
            ...tick,
            atMs: Number(tick.atMs) * scale,
          })),
        }
      : {}),
    ...(effect.atMs == null
      ? {}
      : { atMs: Number(effect.atMs) * scale }),
    ...(Array.isArray(effect.atMsList)
      ? { atMsList: effect.atMsList.map(value => Number(value) * scale) }
      : {}),
    ...(effect.intervalMs == null
      ? {}
      : { intervalMs: Number(effect.intervalMs) * scale }),
  };
}

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
export function createGw2SchedulerPolicy(
  config = {},
  { traits = null } = {},
) {
  const materializer = createGw2TriggerMaterializer(config, { traits });
  return Object.freeze({
    taskHandlers: Object.freeze({
      [GW2_MATERIALIZE_EVENT_TASK]:
        (context, task) => materializer.handleTask(context, task),
    }),

    initialize(context) {
      materializer.initialize(context);
    },

    onEventScheduled(context, event) {
      materializer.onEventScheduled(context, event);
    },

    critical(_context, event) {
      return materializer.critical(event);
    },

    requireCriticalFacts() {
      materializer.requireCriticalFacts();
    },

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

    castDuration(context, skill, baseDuration) {
      if (!context.hasBuff("quickness", context.start)) return baseDuration;
      if (skill.quicknessCastTimeMs != null) {
        return Math.max(0, Number(skill.quicknessCastTimeMs)) / 1000;
      }
      const quicknessMs = baseDuration * 1000 / QUICKNESS_ACTION_RATE;
      return quantizeUp(quicknessMs, ACTION_TICK_MS) / 1000;
    },

    effectTiming(context, skill, effect) {
      if (!context.hasBuff("quickness", context.start)) return effect;
      return scaleCastBoundTiming(context, skill, effect);
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
