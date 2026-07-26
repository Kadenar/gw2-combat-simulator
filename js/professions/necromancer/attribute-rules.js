import {
  permanentTargetConditionStacks,
  targetHasPermanentCondition,
} from "../../platform/gw2/target-state.js";
import {
  applyAdditiveDamageBucket,
} from "../../platform/gw2/damage-modifier-buckets.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "./data/ids.js";

function hasTrait(context, traitId) {
  if (
    context.traits?.has(traitId)
    || context.traits?.has(String(traitId))
  ) return true;
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].some(value => value === traitId || String(value) === String(traitId));
}

function eventSkill(context) {
  return context.profession?.catalog?.skillsById?.get(
    context.event?.skillId ?? context.skillId,
  );
}

function targetHasCondition(context, condition) {
  if (targetHasPermanentCondition(context.config || {}, condition)) return true;
  const applications =
    context.runtime?.conditionState?.get(condition)?.stacks || [];
  return applications.some(application =>
    application.appliedAt <= context.time
    && application.expiresAt > context.time
    && application.weight > 0);
}

function targetConditionCount(context) {
  const names = new Set();
  for (const [name, value] of Object.entries(
    context.config?.target?.conditions || {},
  )) {
    if (value === true || Number(value) > 0) names.add(name);
  }
  for (const [name, entry] of context.runtime?.conditionState || []) {
    if ((entry.stacks || []).some(stack =>
      stack.appliedAt <= context.time
      && stack.expiresAt > context.time
      && stack.weight > 0)) {
      names.add(name);
    }
  }
  return names.size;
}

function targetHealthFraction(context) {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const damage =
    Number(context.runtime?.totals?.strike || 0)
    + Number(context.runtime?.totals?.condition || 0);
  return Math.max(0, 1 - damage / maximum);
}

function isShroudSkill(context) {
  return Boolean(eventSkill(context)?.shroud);
}

function activeShroud(context) {
  return String(context.runtime?.profession?.activeShroud || "");
}

function activeBlight(context) {
  return Math.max(
    0,
    Number(
      context.event?.necromancerBlight
      ?? context.runtime?.profession?.blight
      ?? 0,
    ),
  );
}

function anguishSpiritActive(context) {
  return Boolean(
    context.runtime?.profession?.activeSpirits?.anguish,
  );
}

function targetChilled(context) {
  return (
    targetHasCondition(context, "Chilled")
    || Number(context.runtime?.profession?.targetChilledUntil || 0)
      > context.time
  );
}

function modifyNecromancerAttributes(context, attributes) {
  const result = { ...attributes };
  if (hasTrait(context, TRAIT.AWAKEN_THE_PAIN)) {
    result.power += Number(context.timeline?.mightStacksAt(context.time) || 0)
      * 10;
  }
  if (!context.config?.necromancerBuildAttributesApplied) {
    if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE)) {
      result.vitality += Number(result.power || 0) * 0.1;
    }
    if (hasTrait(context, TRAIT.FURIOUS_DEMISE)) {
      result.precision += 180;
    }
    if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
      result.conditionDamage += Number(result.precision || 0) * 0.13;
    }
    if (hasTrait(context, TRAIT.LINGERING_CURSE)) {
      result.conditionDamage += 200;
    }
    if (hasTrait(context, TRAIT.VITAL_PERSISTENCE)) {
      result.vitality += 180;
    }
    if (
      context.config?.specialization === "Harbinger"
      || hasTrait(context, TRAIT.ALCHEMIC_VIGOR)
    ) {
      result.vitality += 240;
    }
    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      result.ferocity += Number(result.vitality || 0) * 0.13;
    }
    if (hasTrait(context, TRAIT.TWISTED_MEDICINE)) {
      result.concentration += Number(result.vitality || 0) * 0.13;
    }
    if (hasTrait(context, TRAIT.DARK_GUNSLINGER)) {
      result.expertise += Number(result.vitality || 0) * 0.13;
    }
    if (hasTrait(context, TRAIT.BOON_OF_CREATION)) {
      result.concentration += 180;
    }
    if (hasTrait(context, TRAIT.FELL_BEACON)) {
      result.expertise += Number(result.conditionDamage || 0) * 0.07;
    }
  }
  if (
    hasTrait(context, TRAIT.SAND_SAGE)
    && (context.runtime?.profession?.shades || [])
      .some(expiresAt => expiresAt > context.time)
  ) {
    result.concentration += 225;
    result.expertise += 225;
  }
  if (
    hasTrait(context, TRAIT.REAPERS_ONSLAUGHT)
    && activeShroud(context) === "reaper"
  ) {
    result.ferocity += 300;
  }
  return result;
}

function modifyNecromancerCriticalChance(context, chance) {
  let result = chance;
  if (hasTrait(context, TRAIT.TARGET_THE_WEAK)) {
    result += targetConditionCount(context) * 0.02;
  }
  if (hasTrait(context, TRAIT.DECIMATE_DEFENSES)) {
    result += Math.min(
      25,
      permanentTargetConditionStacks(
        context.config || {},
        "Vulnerability",
      ),
    ) * 0.02;
  }
  if (
    hasTrait(context, TRAIT.DEATH_PERCEPTION)
    && isShroudSkill(context)
  ) {
    result += 0.15;
  }
  return result;
}

function modifyNecromancerCriticalDamage(context, multiplier) {
  let result = multiplier;
  if (
    hasTrait(context, TRAIT.DEATH_PERCEPTION)
    && isShroudSkill(context)
  ) {
    result += 0.1;
  }
  if (
    hasTrait(context, TRAIT.WICKED_CORRUPTION)
    && targetHasCondition(context, "Torment")
  ) {
    result += 0.1;
  }
  return result;
}

function modifyNecromancerStrikeDamage(context, multiplier) {
  let additiveBonus = 0;
  if (
    hasTrait(context, TRAIT.SOUL_BARBS)
    && context.timeline?.timedActive(
      "necromancer-soul-barbs",
      context.time,
    )
  ) {
    additiveBonus += 0.1;
  }
  if (
    hasTrait(context, TRAIT.DREAD)
    && Number(context.runtime?.profession?.dreadUntil || 0) > context.time
  ) {
    additiveBonus += 0.2;
  }
  if (hasTrait(context, TRAIT.WICKED_CORRUPTION)) {
    additiveBonus += activeBlight(context) * 0.01;
  }
  if (
    hasTrait(context, TRAIT.CASCADING_CORRUPTION)
    && Number(context.runtime?.profession?.meltdownUntil || 0) > context.time
  ) {
    additiveBonus += 0.1;
  }
  if (
    hasTrait(context, TRAIT.LINGERING_SPIRITS)
    && anguishSpiritActive(context)
  ) {
    additiveBonus += 0.05;
  }
  let result = applyAdditiveDamageBucket(context, multiplier, {
    bonus: additiveBonus,
  });
  if (hasTrait(context, TRAIT.SPITEFUL_TALISMAN)) {
    result *= 1.03;
    if (context.config?.target?.boonless) result *= 1.05 / 1.03;
  }
  if (
    hasTrait(context, TRAIT.CLOSE_TO_DEATH)
    && targetHealthFraction(context) < 0.5
  ) {
    result *= 1.2;
  }
  if (
    hasTrait(context, TRAIT.COLD_SHOULDER)
    && targetChilled(context)
  ) {
    result *= 1.15;
  }
  if (
    hasTrait(context, TRAIT.SOUL_EATER)
    && context.config?.target?.nearby !== false
  ) {
    result *= 1.15;
  }
  if (
    context.event?.summonKind === "minion"
    && hasTrait(context, TRAIT.NECROMANTIC_CORRUPTION)
  ) {
    result *= 1.25;
  }
  if (
    context.event?.actorType === "summon"
    && hasTrait(context, TRAIT.SPIRITS_STRENGTH)
  ) {
    result *= 1.2;
  }
  const thresholds = context.event?.thresholdCoefficients;
  if (thresholds) {
    const base = Number(context.event.coefficient || 0);
    const fraction = targetHealthFraction(context);
    const chosen = fraction < 0.25
      ? Number(thresholds[25] || base)
      : fraction < 0.5
        ? Number(thresholds[50] || base)
        : base;
    if (base > 0) result *= chosen / base;
  }
  return result;
}

function modifyNecromancerConditionDamage(context, multiplier) {
  let additiveBonus = 0;
  if (hasTrait(context, TRAIT.SEPTIC_CORRUPTION)) {
    additiveBonus += activeBlight(context) * 0.0025;
  }
  if (
    hasTrait(context, TRAIT.SOUL_BARBS)
    && context.timeline?.timedActive(
      "necromancer-soul-barbs",
      context.time,
    )
  ) {
    additiveBonus += 0.1;
  }
  if (
    hasTrait(context, TRAIT.CASCADING_CORRUPTION)
    && Number(context.runtime?.profession?.meltdownUntil || 0) > context.time
  ) {
    additiveBonus += 0.1;
  }
  let result = applyAdditiveDamageBucket(context, multiplier, {
    damageType: "condition",
    bonus: additiveBonus,
  });
  if (
    context.condition === "Poisoned"
    && hasTrait(context, TRAIT.PUTRID_DEFENSE)
  ) {
    result *= 1.15;
  }
  if (
    context.condition === "Burning"
    && hasTrait(context, TRAIT.FELL_BEACON)
  ) {
    result *= 1.1;
  }
  if (
    context.condition === "Torment"
    && hasTrait(context, TRAIT.DEMONIC_LORE)
  ) {
    result *= 1.33;
  }
  return result;
}

function modifyNecromancerConditionDuration(context, multiplier) {
  let result = multiplier;
  if (
    context.condition === "Bleeding"
    && hasTrait(context, TRAIT.BARBED_PRECISION)
    && !context.config?.necromancerBuildAttributesApplied
  ) {
    result *= 1.2;
  }
  if (
    eventSkill(context)?.weapon === "Scepter"
    && hasTrait(context, TRAIT.LINGERING_CURSE)
  ) {
    result *= 1.5;
  }
  return result;
}

function modifyNecromancerRechargeDuration(context, duration) {
  let result = duration;
  const skill = context.skill;
  if (
    skill?.categories?.includes("Corruption")
    && hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)
  ) {
    result *= 0.67;
  }
  if (
    skill?.shroud
    && hasTrait(context, TRAIT.SINISTER_SHROUD)
  ) {
    result *= 0.85;
  }
  if (
    skill?.weapon === "Pistol"
    && hasTrait(context, TRAIT.DARK_GUNSLINGER)
  ) {
    result *= 0.8;
  }
  if (
    skill?.id === ID.MANIFEST_SAND_SHADE
    && hasTrait(context, TRAIT.SAND_SAVANT)
  ) {
    result *= 1.25;
  }
  return result;
}

function modifyNecromancerMaximumAmmo(context, maximum) {
  return (
    context.skill?.id === ID.MANIFEST_SAND_SHADE
    && hasTrait(context, TRAIT.SAND_SAVANT)
  ) ? 1 : maximum;
}

function modifyNecromancerCastDuration(context, duration) {
  if (
    hasTrait(context, TRAIT.REAPERS_ONSLAUGHT)
    && context.state?.profession?.activeShroud === "reaper"
    && !context.hasBuff?.("quickness", context.start)
  ) {
    return duration / 1.5;
  }
  return duration;
}

export const necromancerAttributeRules = Object.freeze({
  modifyAttributes: modifyNecromancerAttributes,
  modifyCriticalChance: modifyNecromancerCriticalChance,
  modifyCriticalDamage: modifyNecromancerCriticalDamage,
  modifyStrikeDamage: modifyNecromancerStrikeDamage,
  modifyConditionDamage: modifyNecromancerConditionDamage,
  modifyConditionDuration: modifyNecromancerConditionDuration,
});

export const necromancerCastModifiers = Object.freeze({
  modifyCastDuration: modifyNecromancerCastDuration,
  modifyRechargeDuration: modifyNecromancerRechargeDuration,
  modifyMaximumAmmo: modifyNecromancerMaximumAmmo,
});
