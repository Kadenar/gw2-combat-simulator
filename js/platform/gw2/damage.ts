// Stateless GW2 damage formulas plus the legacy skill-preview calculator.
// Runtime resolution uses the same primitives but applies timestamp-aware rules.

import { CONDITION_FORMULAS, conditionTickDamage } from './condition-formulas.js';
import { clamp } from './numeric.js';
import { criticalChanceFractionFromPrecision, criticalDamageMultiplierFromFerocity } from './stat-scaling.js';

interface AttributeValue {
  readonly final?: number;
}

type AttributeTable = Record<string, AttributeValue | undefined>;

interface PreviewCondition {
  readonly stacks?: number;
  readonly duration?: number;
}

interface PreviewHit {
  readonly hit: number;
  readonly damage?: number;
  readonly numberOfImpacts?: number | 'Duration';
  readonly interval?: number;
  readonly duration?: number;
  readonly conditions?: Readonly<Record<string, PreviewCondition | null | undefined>>;
}

interface PreviewSkill {
  readonly name: string;
  readonly castTime?: number;
  readonly recharge?: number;
}

interface CalculateSkillDamageOptions {
  readonly maxHit?: number;
  readonly infernoBurningTick?: number;
}

const TARGET_ARMOR = 2597;

const CONDITION_DURATION_KEYS: Readonly<Record<string, string>> = {
  Burning: 'Burning Duration',
  Bleeding: 'Bleeding Duration',
  Poisoned: 'Poison Duration',
  Poison: 'Poison Duration',
  Torment: 'Torment Duration',
  Confusion: 'Confusion Duration'
};

// GW2 strike damage formula before critical hits and outgoing modifiers.
export function strikeDamage(coefficient: number, weaponStrength: number, power: number, armor = TARGET_ARMOR): number {
  return (coefficient * weaponStrength * power) / armor;
}

// Percentage-form API used by attribute tables (e.g. 50 chance, 200 damage).
export function expectedCritMultiplier(critChancePct: number, critDamagePct: number): number {
  const cc = Math.min(critChancePct / 100, 1);
  const cd = critDamagePct / 100;
  return 1 + cc * (cd - 1);
}

export function criticalChance(precision: number): number {
  // Fraction-form API used by the resolver. Precision below the level-80
  // baseline is clamped rather than producing a negative chance.
  return clamp(criticalChanceFractionFromPrecision(Number(precision)), 0, 1);
}

export function criticalDamageMultiplier(ferocity: number): number {
  // Returns a factor (1.5 means 150%), unlike the percentage-form helper above.
  return criticalDamageMultiplierFromFerocity(Math.max(0, Number(ferocity)));
}

export function expectedCriticalMultiplier(chance: number, multiplier: number): number {
  // Fraction-form companion to expectedCritMultiplier.
  const normalizedChance = clamp(Number(chance), 0, 1);
  return 1 + normalizedChance * (Number(multiplier) - 1);
}

// Preview total. GW2 caps positive condition-duration extension at +100%.
export function conditionTotalDamage(
  conditionType: string,
  stacks: number,
  baseDurationSec: number,
  conditionDamage: number,
  durationBonusPct: number
): number {
  const tickDmg = conditionTickDamage(conditionType, conditionDamage);
  const adjustedDuration = baseDurationSec * clamp(1 + durationBonusPct / 100, 1, 2);
  return stacks * tickDmg * adjustedDuration;
}

// Attribute tables store both duration components as percentage points.
export function getConditionDurationBonus(conditionType: string, attributes: AttributeTable): number {
  const base = attributes['Condition Duration']?.final ?? 0;
  const key = CONDITION_DURATION_KEYS[conditionType];
  const specific = key && attributes[key] !== undefined ? (attributes[key]?.final ?? 0) : 0;
  return base + specific;
}

const BOON_DURATION_KEYS: Readonly<Record<string, string>> = {
  Might: 'Might Duration',
  Fury: 'Fury Duration',
  Quickness: 'Quickness Duration'
};

// Lookup boon duration bonus from attributes
export function getBoonDurationBonus(boonType: string, attributes: AttributeTable): number {
  const base = attributes['Boon Duration']?.final ?? 0;
  const key = BOON_DURATION_KEYS[boonType];
  const specific = key && attributes[key] !== undefined ? (attributes[key]?.final ?? 0) : 0;
  return base + specific;
}

// Builds an isolated skill tooltip/preview, not a chronological combat result.
// Duration hits repeat both their strike and condition application per interval.
export function calculateSkillDamage(
  skill: PreviewSkill,
  skillHits: readonly PreviewHit[] | null | undefined,
  weaponStrength: number,
  attributes: AttributeTable,
  { maxHit = Infinity, infernoBurningTick = 0 }: CalculateSkillDamageOptions = {}
) {
  const power = attributes['Power']?.final ?? 1000;
  const condDmg = attributes['Condition Damage']?.final ?? 0;
  const critChance = attributes['Critical Chance']?.final ?? 0;
  const critDamage = attributes['Critical Damage']?.final ?? 150;
  const critMult = expectedCritMultiplier(critChance, critDamage);

  let totalStrike = 0;
  let totalCondition = 0;
  const hitDetails: Record<string, unknown>[] = [];
  const conditionDetails: Record<string, unknown>[] = [];

  const hits = skillHits || [];
  for (const hit of hits) {
    if (hit.hit > maxHit) continue;
    const coefficient = hit.damage || 0;
    if (coefficient <= 0 && !hasConditions(hit)) continue;

    let tickCount = 1;
    let isPerTick = false;
    if (hit.numberOfImpacts === 'Duration') {
      // Duration entries describe a repeating pulse rather than one hit.
      isPerTick = true;
      const interval = hit.interval || 1;
      tickCount = Math.floor(Number(hit.duration || 0) / interval);
      if (tickCount < 1) tickCount = 1;
    }

    let hitStrike = 0;
    if (coefficient > 0) {
      const raw = strikeDamage(coefficient, weaponStrength, power);
      const expected = raw * critMult;
      if (isPerTick) {
        hitStrike = expected * tickCount;
      } else {
        hitStrike = expected;
      }

      totalStrike += hitStrike;
    }

    hitDetails.push({
      hitIndex: hit.hit,
      coefficient,
      isPerTick,
      tickCount,
      strikeDamage: hitStrike
    });

    for (const [condType, condVal] of Object.entries(hit.conditions || {})) {
      if (!condVal || !(CONDITION_FORMULAS as Readonly<Record<string, unknown>>)[condType]) continue;
      const stacks = condVal.stacks || 0;
      const duration = condVal.duration || 0;
      if (stacks <= 0 || duration <= 0) continue;

      const durationBonus = getConditionDurationBonus(condType, attributes);
      const effectiveStacks = isPerTick ? stacks * tickCount : stacks;
      // Inferno can supply a precomputed Burning tick with its own rules.
      const tickDmg =
        infernoBurningTick > 0 && condType === 'Burning' ? infernoBurningTick : conditionTickDamage(condType, condDmg);
      const adjustedDuration = duration * clamp(1 + durationBonus / 100, 1, 2);
      const dmg = effectiveStacks * tickDmg * adjustedDuration;
      totalCondition += dmg;

      conditionDetails.push({
        type: condType,
        stacks: effectiveStacks,
        baseDuration: duration,
        adjustedDuration,
        tickDamage: tickDmg,
        totalDamage: dmg
      });
    }
  }

  const totalDamage = totalStrike + totalCondition;
  const castTime = skill.castTime || 0;
  // Instant skills use total damage as their ranking value to avoid division
  // by zero; callers should not interpret that case as literal sustained DPS.
  const dps = castTime > 0 ? totalDamage / castTime : totalDamage;

  return {
    skillName: skill.name,
    castTime,
    cooldown: skill.recharge,
    totalStrike,
    totalCondition,
    totalDamage,
    dps,
    critMultiplier: critMult,
    hitDetails,
    conditionDetails
  };
}

function hasConditions(hit: PreviewHit): boolean {
  if (!hit.conditions) return false;
  return Object.values(hit.conditions).some((c) => c && Number(c.stacks || 0) > 0);
}
