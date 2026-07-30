import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import {
  professionStaticRulesApplied,
} from "../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT,
} from "./data/ids.js";
import { bolsteredBondsBonuses } from "./bolstered-bonds.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "./mechanics/handler-mechanics.js";

function player(context) {
  return context.event?.actorType !== "summon";
}
function professionState(context) {
  return context.runtime?.profession ?? context.state?.profession ?? {};
}
function equippedLegend(context, legendId) {
  return (professionState(context).selectedLegendIds || []).includes(legendId);
}
function affinity(context) {
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  return Math.min(5, Number(professionState(context).affinity || 0) + bonus);
}
function timedBuff(context, kind) {
  if (context.config?.boons?.[kind]) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application) =>
      application.at <= context.time && application.expiresAt > context.time,
  );
}
function kallasFervorStacks(context) {
  const maximum = MECHANICS.renegade.kallasFervor.maximumStacks;
  return Math.min(
    maximum,
    (professionState(context).kallasFervor || []).filter(
      (application) =>
        Number(application.at || 0) <= context.time &&
        Number(application.expiresAt || 0) > context.time,
    ).length,
  );
}
function targetHealthFraction(context) {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const dealt =
    Number(context.runtime?.totals?.strike || 0) +
    Number(context.runtime?.totals?.condition || 0);
  return Math.max(0, 1 - dealt / maximum);
}
function targetHasCondition(context, condition) {
  return Boolean(
    context.query?.targetHasCondition(condition, context.time, context.runtime),
  );
}
function targetVulnerability(context) {
  return Number(
    context.query?.targetConditionStacks(
      "Vulnerability",
      context.time,
      context.runtime,
    ) || 0,
  );
}
function activeOffhand(context) {
  const set = Number(context.runtime?.activeWeaponSet || 1);
  return Boolean(
    set === 2
      ? context.config?.weaponSet2Secondary
      : context.config?.secondaryWeapon,
  );
}
function targetHasDefensiveBoon(context) {
  const boons = context.config?.target?.boons || {};
  return Boolean(boons.stability || boons.protection);
}
function periodicAssassinsPresence(context) {
  if (!hasTrait(context, TRAIT.ASSASSINS_PRESENCE)) return false;
  const start = Number(
    context.runtime?.combatStartTime ??
      context.runtime?.firstHitTime ??
      context.time,
  );
  const elapsed = Math.max(0, context.time - start);
  return elapsed % 10 < 3;
}
const DAMAGING_CONDITIONS = new Set([
  "Bleeding",
  "Burning",
  "Confusion",
  "Poisoned",
  "Torment",
]);
const BOONS = new Set([
  "aegis",
  "alacrity",
  "fury",
  "might",
  "protection",
  "quickness",
  "regeneration",
  "resistance",
  "resolution",
  "stability",
  "swiftness",
  "vigor",
]);
function activeBoonCount(context) {
  const active = new Set(
    Object.entries(context.config?.boons || {})
      .filter(([, value]) =>
        typeof value === "number" ? value > 0 : Boolean(value),
      )
      .map(([kind]) => kind.toLowerCase())
      .filter((kind) => BOONS.has(kind)),
  );
  for (const [kind, applications] of context.runtime?.boons || []) {
    const normalized = String(kind).toLowerCase();
    if (
      BOONS.has(normalized) &&
      applications.some(
        (application) =>
          application.at <= context.time &&
          application.expiresAt > context.time,
      )
    ) {
      active.add(normalized);
    }
  }
  return active.size;
}
function playerHealthFraction(context) {
  return Number(context.config?.playerHealthFraction ?? 1);
}
function vindicatorEnduranceIsNotFull(context) {
  const state = professionState(context);
  const maximum = Number(state.maximumEndurance || 0);
  return maximum > 0 && Number(state.endurance || 0) < maximum - 1e-9;
}
function forerunnerOfDeathIsActive(context) {
  if (context.event?.forerunnerOfDeathActive != null) {
    return Boolean(context.event.forerunnerOfDeathActive);
  }
  return (
    Number(professionState(context).forerunnerOfDeathUntil || 0) > context.time
  );
}
const rules = [
  {
    id: "revenant.burst-of-strength-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: (context) => timedBuff(context, "burst-of-strength"),
  },
  {
    id: "revenant.burst-of-strength-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: (context) => timedBuff(context, "burst-of-strength"),
  },
  {
    id: "revenant.ferocious-aggression",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: 0.1,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.FEROCIOUS_AGGRESSION) &&
      Boolean(context.config?.boons?.fury),
  },
  {
    id: "revenant.rising-tide",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.RISING_TIDE) &&
      Number(context.config?.playerHealthFraction ?? 1) > 0.75,
  },
  {
    id: "revenant.reinforced-potency",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) => activeBoonCount(context) * 0.01,
    when: (context) =>
      player(context) && hasTrait(context, TRAIT.REINFORCED_POTENCY),
  },
  {
    id: "revenant.leviathan-strength",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: MECHANICS.endurance.leviathanStrengthStrikeMultiplier,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.LEVIATHAN_STRENGTH) &&
      vindicatorEnduranceIsNotFull(context),
  },
  {
    id: "revenant.forerunner-of-death",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: MECHANICS.endurance.forerunnerOfDeathStrikeBonus,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.FORERUNNER_OF_DEATH) &&
      forerunnerOfDeathIsActive(context),
  },
  {
    id: "revenant.acolyte-of-torment",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: (context) =>
      player(context) &&
      context.condition === "Torment" &&
      hasTrait(context, TRAIT.ACOLYTE_OF_TORMENT),
  },
  {
    id: "revenant.dwarven-battle-training",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.DWARVEN_BATTLE_TRAINING) &&
      targetHasCondition(context, "Weakness"),
  },
  {
    id: "revenant.vicious-reprisal",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: 0.1,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.VICIOUS_REPRISAL) &&
      timedBuff(context, "resolution"),
  },
  {
    id: "revenant.destructive-impulses",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context) => (activeOffhand(context) ? 0.075 : 0.05),
    when: (context) =>
      player(context) && hasTrait(context, TRAIT.DESTRUCTIVE_IMPULSES),
  },
  {
    id: "revenant.unsuspecting-strikes",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.2,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.UNSUSPECTING_STRIKES) &&
      targetHealthFraction(context) > 0.8,
  },
  {
    id: "revenant.targeted-destruction",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      1 +
      targetVulnerability(context) * 0.005 +
      (hasTrait(context, TRAIT.NUMINOUS_GIFT) &&
      hasTrait(context, TRAIT.TARGETED_DESTRUCTION)
        ? 0.05
        : 0),
    when: (context) =>
      player(context) && hasTrait(context, TRAIT.TARGETED_DESTRUCTION),
  },
  {
    id: "revenant.brutality",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "multiply",
    factor: 1.15,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.BRUTALITY) &&
      targetHasDefensiveBoon(context),
  },
  {
    id: "revenant.swift-termination",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.2,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.SWIFT_TERMINATION) &&
      targetHealthFraction(context) < 0.5,
  },
  {
    id: "revenant.heartpiercer-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    when: (context) =>
      player(context) &&
      hasTrait(context, TRAIT.HEARTPIERCER) &&
      targetHasCondition(context, "Bleeding"),
  },
  {
    id: "revenant.heartpiercer-bleeding",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    when: (context) =>
      player(context) &&
      context.condition === "Bleeding" &&
      hasTrait(context, TRAIT.HEARTPIERCER),
  },
  {
    id: "revenant.kallas-fervor-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) => {
      const profile = MECHANICS.renegade.kallasFervor;
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? profile.improvedStrikeDamagePerStack
        : profile.strikeDamagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => player(context) && kallasFervorStacks(context) > 0,
  },
  {
    id: "revenant.kallas-fervor-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: (context) => {
      const profile = MECHANICS.renegade.kallasFervor;
      const perStack = hasTrait(context, TRAIT.LASTING_LEGACY)
        ? profile.improvedConditionDamagePerStack
        : profile.conditionDamagePerStack;
      return kallasFervorStacks(context) * perStack;
    },
    when: (context) => player(context) && kallasFervorStacks(context) > 0,
  },
  {
    id: "revenant.release-dervish-assassin-affinity",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + affinity(context) * 0.1,
    when: (context) =>
      ["Release Potential: Dervish", "Release Potential: Assassin"].includes(
        context.event?.skillName,
      ),
  },
  {
    id: "revenant.release-warrior-affinity",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => 1 + affinity(context) * 0.15,
    when: (context) =>
      context.event?.skillName === "Release Potential: Warrior",
  },
  {
    id: "revenant.beguiling-haze-assassin-resonance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 2,
    when: (context) =>
      context.event?.skillName === "Beguiling Haze" &&
      equippedLegend(context, LEGEND.ASSASSIN),
  },
  {
    id: "revenant.twin-moon-assassin-resonance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    when: (context) =>
      context.event?.skillName === "Twin Moon Sweep" &&
      equippedLegend(context, LEGEND.ASSASSIN),
  },
];
const modifierHooks = createModifierHooks({ rules });

function modifyCriticalChance(context, chance) {
  let modified = chance;
  if (
    hasTrait(context, TRAIT.ROILING_MISTS) &&
    (timedBuff(context, "fury") || periodicAssassinsPresence(context))
  )
    modified += 0.25;
  if (hasTrait(context, TRAIT.BRUTAL_MOMENTUM)) {
    const state = professionState(context);
    const maximum = Number(state.maximumEndurance || 0);
    const full = maximum > 0 && Number(state.endurance || 0) >= maximum - 1e-9;
    modified += full ? 0.33 : 0.1;
  }
  return modified;
}

function modifyConditionDuration(context, duration) {
  let modified = duration;
  if (
    hasTrait(context, TRAIT.PACT_OF_PAIN) &&
    !professionStaticRulesApplied(context.config)
  ) {
    modified += 0.15;
  }
  if (
    DAMAGING_CONDITIONS.has(context.condition) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT)
  ) {
    // Browser build attributes contain both static duration bonuses. Direct
    // simulator configs still need them applied at runtime.
    if (!professionStaticRulesApplied(context.config)) {
      modified += 0.1;
      if (hasTrait(context, TRAIT.NUMINOUS_GIFT)) modified += 0.05;
    }
  }
  if (
    context.condition === "Bleeding" &&
    hasTrait(context, TRAIT.BLOOD_FURY) &&
    timedBuff(context, "fury")
  ) {
    modified += MECHANICS.renegade.bloodFury.bleedingDurationMultiplier - 1;
  }
  return modified;
}

function modifyAttributes(context, attributes) {
  let modified = { ...attributes };
  if (
    hasTrait(context, TRAIT.EMPIRE_DIVIDED) &&
    !professionStaticRulesApplied(context.config) &&
    playerHealthFraction(context) >
      MECHANICS.endurance.empireDividedHealthThreshold
  ) {
    modified.power =
      Number(modified.power || 0) + MECHANICS.endurance.empireDividedPower;
  }
  if (hasTrait(context, TRAIT.NOTORIETY)) {
    const baseMight = Math.max(
      0,
      Math.min(25, Number(context.config?.boons?.might || 0)),
    );
    const dynamicMight = Math.min(
      Math.max(0, 25 - baseMight),
      (context.runtime?.boons?.get("might") || [])
        .filter(
          (application) =>
            application.at <= context.time &&
            application.expiresAt > context.time,
        )
        .reduce((sum, application) => sum + Number(application.stacks || 1), 0),
    );
    const might = Math.min(25, baseMight + dynamicMight);
    modified.power = Number(modified.power || 0) + might * 10;
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) - might * 10;
  }
  if (context.config.specialization !== "Conduit") return modified;
  const state = professionState(context);
  const cosmicMultiplier =
    Number(state.cosmicWisdomUntil || 0) > context.time ? 2 : 1;
  const buildMultiplier = professionStaticRulesApplied(context.config)
    ? 1
    : 0;
  const bonuses = bolsteredBondsBonuses(
    state.selectedLegendIds,
    cosmicMultiplier - buildMultiplier,
  );
  for (const [attribute, bonus] of Object.entries(bonuses)) {
    modified[attribute] = Number(modified[attribute] || 0) + Number(bonus || 0);
  }
  if (hasTrait(context, TRAIT.DETERMINED_RESOLUTION)) {
    modified.strikeDamageReduction =
      Number(modified.strikeDamageReduction || 0) + 0.05;
  }
  if (hasTrait(context, TRAIT.SERENE_REJUVENATION)) {
    modified.healingEffectiveness =
      Number(modified.healingEffectiveness || 0) + 0.05;
  }
  if (hasTrait(context, TRAIT.CONTAINED_TEMPER)) {
    modified.containedTemperEnergyGainBonus =
      Number(modified.containedTemperEnergyGainBonus || 0) + 5;
  }
  return modified;
}

export const revenantAttributeRules = Object.freeze({
  modifyAttributes,
  ...modifierHooks,
  modifyCriticalChance,
  modifyConditionDuration,
});
