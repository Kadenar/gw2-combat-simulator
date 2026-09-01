import type { SimulationEventInput, Skill } from '#gw2/platform/engine/types.js';
import { clamp } from '#gw2/platform/combat/numeric.js';
import { conditionDurationFractionFromExpertise } from '#gw2/platform/combat/damage/stat-scaling.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';
import type { Gw2SigilSet, Gw2Stats } from '#gw2/platform/equipment/types.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

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

interface WeaponStrengthAliasMatcher {
  readonly pattern: RegExp;
  readonly weapon: string;
}

const EMPTY_WEAPON_STRENGTH_ALIASES: Readonly<Record<string, string>> = Object.freeze({});
const WEAPON_STRENGTH_ALIAS_MATCHERS = new WeakMap<
  Readonly<Record<string, string>>,
  readonly WeaponStrengthAliasMatcher[]
>();

function weaponStrengthAliasMatchers(aliases: Readonly<Record<string, string>>): readonly WeaponStrengthAliasMatcher[] {
  const cached = WEAPON_STRENGTH_ALIAS_MATCHERS.get(aliases);
  if (cached) return cached;

  const matchers = Object.freeze(
    Object.entries(aliases).map(([pattern, weapon]) => Object.freeze({ pattern: new RegExp(pattern, 'i'), weapon }))
  );
  WEAPON_STRENGTH_ALIAS_MATCHERS.set(aliases, matchers);
  return matchers;
}

// Small, side-effect-free GW2 rules shared by schedulers, resolvers, and
// profession adapters.

/** Power and Condition Damage granted by one stack of Might. */
export const MIGHT_ATTRIBUTE_BONUS_PER_STACK = 30;

export function gw2SigilSet(config: Gw2Config, weaponSet = 1): Gw2SigilSet {
  // Public weapon sets are one-based; storage is a zero-based array.
  return config.sigilSets?.[Math.max(1, Number(weaponSet || 1)) - 1] || {};
}

/** Returns the configured attributes for a one-based weapon set. */
export function gw2StatsForWeaponSet(config: Gw2Config, weaponSet = config.startingWeaponSet): Gw2Stats {
  const index = Number(weaponSet) === 2 ? 1 : 0;
  return {
    ...(config.attributes || {}),
    ...(config.stats || {}),
    ...(config.weaponSetStats?.[index] || {})
  };
}

export function gw2StaticAttributes(
  config: Gw2Config,
  mightStacks: number | boolean | undefined = config.boons?.might,
  weaponSet = config.startingWeaponSet
): Gw2ResolvedStats {
  const mightBonus = MIGHT_ATTRIBUTE_BONUS_PER_STACK * Number(mightStacks || 0);
  const stats = gw2StatsForWeaponSet(config, weaponSet);
  return {
    power: Number(stats.power || 0) + mightBonus,
    precision: Number(stats.precision || 0),
    toughness: Number(stats.toughness || 0),
    vitality: Number(stats.vitality || 0),
    ferocity: Number(stats.ferocity || 0),
    conditionDamage: Number(stats.conditionDamage || 0) + mightBonus,
    expertise: Number(stats.expertise || 0),
    concentration: Number(stats.concentration || 0),
    healingPower: Number(stats.healingPower || 0),
    boonDurationBonus: Number(stats.boonDurationBonus || 0),
    boonDurationBonuses: {
      ...(stats.boonDurationBonuses || {})
    },
    conditionDurationBonus: Number(stats.conditionDurationBonus || 0),
    conditionDurationBonuses: {
      ...(stats.conditionDurationBonuses || {})
    }
  };
}

export function gw2RechargeRate(config: Gw2Config, { alacrityRate = 1.25 }: RechargeRateOptions = {}): number {
  // The returned value is a speed, not a duration multiplier.
  return config.boons?.alacrity ? alacrityRate : 1;
}

/** Calculates effective skill recharge after cooldown and recharge-rate modifiers. */
export function gw2EffectiveCooldown(
  skill: Skill,
  config: Gw2Config,
  { cooldownMultiplier = 1, rechargeRate = gw2RechargeRate(config) }: EffectiveCooldownOptions = {}
): number {
  // Ammo skills report time per restored charge; non-ammo skills use their
  // cooldown/recharge field. Cast lockouts are handled by the scheduler.
  const baseRecharge = gw2BaseRecharge(skill);
  return (
    (Math.max(0, baseRecharge) * Math.max(0, Number(cooldownMultiplier || 0))) /
    Math.max(Number.EPSILON, Number(rechargeRate || 1))
  );
}

/** Resolves weapon strength from event data, configured weapons, aliases, and a fallback. */
export function gw2WeaponStrength(
  event: SimulationEventInput,
  config: Gw2Config,
  { strengths = {}, fallback = 1000, aliases = EMPTY_WEAPON_STRENGTH_ALIASES }: WeaponStrengthOptions = {}
): number {
  // Explicit event data is authoritative for bundle and proc attacks.
  if (event.weaponStrength != null) return Number(event.weaponStrength);
  const explicit = String(event.weapon || '');
  // Alias keys are regular-expression patterns, allowing variant weapon labels
  // to share a strength entry.
  const alias =
    aliases === EMPTY_WEAPON_STRENGTH_ALIASES
      ? undefined
      : weaponStrengthAliasMatchers(aliases).find(({ pattern }) => pattern.test(explicit))?.weapon;
  const normalized = explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  const skillWeapon = String(event.skillWeapon || '');
  const primaryWeapon = String(gw2PrimaryWeapon(config, 1) || '');
  // Precedence moves from event-specific metadata to build defaults, then the
  // generic Utility entry and caller fallback.
  return Number(
    (alias ? strengths[alias] : undefined) ??
      strengths[normalized] ??
      strengths[skillWeapon] ??
      strengths[primaryWeapon] ??
      strengths.Utility ??
      fallback
  );
}

/** Calculates the capped duration multiplier for a condition. */
export function gw2ConditionDurationMultiplier(
  condition: string,
  stats: Gw2ResolvedStats | Gw2Stats,
  extraBonus = 0
): number {
  const bonus =
    conditionDurationFractionFromExpertise(Number(stats.expertise || 0)) +
    Number(stats.conditionDurationBonus || 0) / 100 +
    Number(stats.conditionDurationBonuses?.[condition] || 0) / 100 +
    Number(extraBonus || 0);
  // This helper models duration extensions only and enforces GW2's +100% cap.
  return clamp(1 + bonus, 1, 2);
}

/** Calculates the capped duration multiplier for a boon. */
export function gw2BoonDurationMultiplier(boon: string, stats: Gw2Stats, sigils: Gw2SigilSet = {}): number {
  const canonicalBoon = boon.charAt(0).toUpperCase() + boon.slice(1).toLowerCase();
  const bonus =
    Number(stats.concentration || 0) / 1500 +
    Number(stats.boonDurationBonus || 0) / 100 +
    Number(stats.boonDurationBonuses?.[boon] || stats.boonDurationBonuses?.[canonicalBoon] || 0) / 100 +
    Number(sigils.boonDurationBonus || 0) / 100;
  return clamp(1 + bonus, 1, 2);
}
