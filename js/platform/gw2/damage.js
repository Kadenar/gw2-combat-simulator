// Stateless GW2 damage formulas plus the legacy skill-preview calculator.
// Runtime resolution uses the same primitives but applies timestamp-aware rules.

import {
    CONDITION_FORMULAS,
    conditionTickDamage as sharedConditionTickDamage,
} from './condition-formulas.js';

const TARGET_ARMOR = 2597;

const CONDITION_DURATION_KEYS = {
    Burning:   'Burning Duration',
    Bleeding:  'Bleeding Duration',
    Poisoned:  'Poison Duration',
    Poison:    'Poison Duration',
    Torment:   'Torment Duration',
    Confusion: 'Confusion Duration',
};

// GW2 strike damage formula before critical hits and outgoing modifiers.
export function strikeDamage(coefficient, weaponStrength, power, armor = TARGET_ARMOR) {
    return coefficient * weaponStrength * power / armor;
}

// Percentage-form API used by attribute tables (e.g. 50 chance, 200 damage).
export function expectedCritMultiplier(critChancePct, critDamagePct) {
    const cc = Math.min(critChancePct / 100, 1);
    const cd = critDamagePct / 100;
    return 1 + cc * (cd - 1);
}

// Condition damage per second: base + scaling coefficient multiplied by condition damage stat
export function conditionTickDamage(conditionType, conditionDamage) {
    return sharedConditionTickDamage(conditionType, conditionDamage);
}

export function criticalChance(precision) {
    // Fraction-form API used by the resolver. Precision below the level-80
    // baseline is clamped rather than producing a negative chance.
    return Math.max(0, Math.min(1, 0.05 + (Number(precision) - 1000) / 2100));
}

export function criticalDamageMultiplier(ferocity) {
    // Returns a factor (1.5 means 150%), unlike the percentage-form helper above.
    return 1.5 + Math.max(0, Number(ferocity)) / 1500;
}

export function expectedCriticalMultiplier(chance, multiplier) {
    // Fraction-form companion to expectedCritMultiplier.
    const normalizedChance = Math.max(0, Math.min(1, Number(chance)));
    return 1 + normalizedChance * (Number(multiplier) - 1);
}

// Preview total. GW2 caps positive condition-duration extension at +100%.
export function conditionTotalDamage(conditionType, stacks, baseDurationSec, conditionDamage, durationBonusPct) {
    const tickDmg = conditionTickDamage(conditionType, conditionDamage);
    const adjustedDuration = baseDurationSec * (1 + Math.min(durationBonusPct / 100, 1));
    return stacks * tickDmg * adjustedDuration;
}

// Attribute tables store both duration components as percentage points.
export function getConditionDurationBonus(conditionType, attributes) {
    const base = attributes['Condition Duration']?.final ?? 0;
    const key = CONDITION_DURATION_KEYS[conditionType];
    const specific = (key && attributes[key] !== undefined) ? attributes[key].final : 0;
    return base + specific;
}

const BOON_DURATION_KEYS = {
    Might: 'Might Duration',
    Fury: 'Fury Duration',
    Quickness: 'Quickness Duration',
};

// Lookup boon duration bonus from attributes
export function getBoonDurationBonus(boonType, attributes) {
    const base = attributes['Boon Duration']?.final ?? 0;
    const key = BOON_DURATION_KEYS[boonType];
    const specific = (key && attributes[key] !== undefined) ? attributes[key].final : 0;
    return base + specific;
}

// Builds an isolated skill tooltip/preview, not a chronological combat result.
// Duration hits repeat both their strike and condition application per interval.
export function calculateSkillDamage(skill, skillHits, weaponStrength, attributes, { maxHit = Infinity, infernoBurningTick = 0 } = {}) {
    const power = attributes['Power']?.final ?? 1000;
    const condDmg = attributes['Condition Damage']?.final ?? 0;
    const critChance = attributes['Critical Chance']?.final ?? 0;
    const critDamage = attributes['Critical Damage']?.final ?? 150;
    const critMult = expectedCritMultiplier(critChance, critDamage);

    let totalStrike = 0;
    let totalCondition = 0;
    const hitDetails = [];
    const conditionDetails = [];

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
            tickCount = Math.floor(hit.duration / interval);
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
            strikeDamage: hitStrike,
        });

        for (const [condType, condVal] of Object.entries(hit.conditions || {})) {
            if (!condVal || !CONDITION_FORMULAS[condType]) continue;
            const stacks = condVal.stacks || 0;
            const duration = condVal.duration || 0;
            if (stacks <= 0 || duration <= 0) continue;

            const durationBonus = getConditionDurationBonus(condType, attributes);
            const effectiveStacks = isPerTick ? stacks * tickCount : stacks;
            // Inferno can supply a precomputed Burning tick with its own rules.
            const tickDmg = (infernoBurningTick > 0 && condType === 'Burning')
                ? infernoBurningTick
                : conditionTickDamage(condType, condDmg);
            const adjustedDuration = duration * (1 + Math.min(durationBonus / 100, 1));
            const dmg = effectiveStacks * tickDmg * adjustedDuration;
            totalCondition += dmg;

            conditionDetails.push({
                type: condType,
                stacks: effectiveStacks,
                baseDuration: duration,
                adjustedDuration,
                tickDamage: tickDmg,
                totalDamage: dmg,
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
        conditionDetails,
    };
}

function hasConditions(hit) {
    if (!hit.conditions) return false;
    return Object.values(hit.conditions).some(c => c && c.stacks > 0);
}
