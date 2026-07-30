import type { SimulationEventInput, Skill } from "../engine/types.js";
import type {
  Gw2Config,
  Gw2ResolvedStats,
  Gw2SigilSet,
  Gw2Stats,
} from "./types.js";

interface RechargeRateOptions {
  readonly alacrityRate?: number;
}

interface EffectiveCooldownOptions {
  readonly cooldownMultiplier?: number;
  readonly rechargeRate?: number;
}

interface WeaponStrengthOptions {
  readonly strengths?: Readonly<Record<string, number>>;
  readonly fallback?: number;
  readonly aliases?: Readonly<Record<string, string>>;
}

// Small, side-effect-free GW2 rules shared by schedulers, resolvers, and
// profession adapters.

/**
 * @param {Gw2Config} config
 * @param {number} [weaponSet]
 * @returns {Gw2SigilSet}
 */
export function gw2SigilSet(config: Gw2Config, weaponSet = 1): Gw2SigilSet {
  // Public weapon sets are one-based; storage is a zero-based array.
  return config.sigilSets?.[Math.max(1, Number(weaponSet || 1)) - 1] || {};
}

/**
 * @param {Gw2Config} config
 * @param {number | boolean} [mightStacks]
 * @returns {Gw2ResolvedStats}
 */
export function gw2StaticAttributes(
  config: Gw2Config,
  mightStacks: number | boolean | undefined = config.boons?.might,
): Gw2ResolvedStats {
  // Each Might stack adds 30 to both Power and Condition Damage.
  const mightBonus = 30 * Number(mightStacks || 0);
  return {
    power: Number(config.stats?.power || 0) + mightBonus,
    precision: Number(config.stats?.precision || 0),
    toughness: Number(config.stats?.toughness || 0),
    vitality: Number(config.stats?.vitality || 0),
    ferocity: Number(config.stats?.ferocity || 0),
    conditionDamage: Number(config.stats?.conditionDamage || 0) + mightBonus,
    expertise: Number(config.stats?.expertise || 0),
    concentration: Number(config.stats?.concentration || 0),
    healingPower: Number(config.stats?.healingPower || 0),
    conditionDurationBonus: Number(config.stats?.conditionDurationBonus || 0),
    conditionDurationBonuses: {
      ...(config.stats?.conditionDurationBonuses || {}),
    },
  };
}

/**
 * @param {Gw2Config} config
 * @param {{alacrityRate?: number}} [options]
 */
export function gw2RechargeRate(
  config: Gw2Config,
  { alacrityRate = 1.25 }: RechargeRateOptions = {},
): number {
  // The returned value is a speed, not a duration multiplier.
  return config.boons?.alacrity ? alacrityRate : 1;
}

export function gw2EffectiveCooldown(
  skill: Skill,
  config: Gw2Config,
  {
    cooldownMultiplier = 1,
    rechargeRate = gw2RechargeRate(config),
  }: EffectiveCooldownOptions = {},
): number {
  const ammoRecharge = Number(skill.ammoRecharge || 0);
  // Ammo skills report time per restored charge; non-ammo skills use their
  // cooldown/recharge field. Cast lockouts are handled by the scheduler.
  const baseRecharge =
    Number(skill.ammo || 0) > 0 && ammoRecharge > 0
      ? ammoRecharge
      : Number(skill.cooldown ?? skill.recharge ?? 0);
  return (
    (Math.max(0, baseRecharge) * Math.max(0, Number(cooldownMultiplier || 0))) /
    Math.max(Number.EPSILON, Number(rechargeRate || 1))
  );
}

export function gw2WeaponStrength(
  event: SimulationEventInput,
  config: Gw2Config,
  { strengths = {}, fallback = 1000, aliases = {} }: WeaponStrengthOptions = {},
): number {
  // Explicit event data is authoritative for bundle and proc attacks.
  if (event.weaponStrength != null) return Number(event.weaponStrength);
  const explicit = String(event.weapon || "");
  // Alias keys are regular-expression patterns, allowing variant weapon labels
  // to share a strength entry.
  const alias = Object.entries(aliases).find(([pattern]) =>
    new RegExp(pattern, "i").test(explicit),
  )?.[1];
  const normalized =
    explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  const skillWeapon = String(event.skillWeapon || "");
  const primaryWeapon = String(config.primaryWeapon || "");
  // Precedence moves from event-specific metadata to build defaults, then the
  // generic Utility entry and caller fallback.
  return Number(
    (alias ? strengths[alias] : undefined) ??
      strengths[normalized] ??
      strengths[skillWeapon] ??
      strengths[primaryWeapon] ??
      strengths.Utility ??
      fallback,
  );
}

export function gw2ConditionDurationMultiplier(
  condition: string,
  stats: Gw2ResolvedStats | Gw2Stats,
  extraBonus = 0,
): number {
  const bonus =
    Number(stats.expertise || 0) / 1500 +
    Number(stats.conditionDurationBonus || 0) / 100 +
    Number(stats.conditionDurationBonuses?.[condition] || 0) / 100 +
    Number(extraBonus || 0);
  // This helper models duration extensions only and enforces GW2's +100% cap.
  return Math.max(1, Math.min(2, 1 + bonus));
}
