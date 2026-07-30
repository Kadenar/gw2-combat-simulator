import {
  CANONICAL_TARGET_CONDITIONS,
} from "../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import {
  professionStaticRulesApplied,
} from "../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "./data/ids.js";
import { engineerMechAttributes } from "./state.js";

function targetConditionCount(context) {
  return CANONICAL_TARGET_CONDITIONS.filter(condition =>
    context.query?.targetHasCondition(
      condition,
      context.time,
      context.runtime,
    )).length;
}

function vulnerability(context) {
  return Number(
    context.query?.targetConditionStacks(
      "Vulnerability",
      context.time,
      context.runtime,
    ) || 0,
  );
}

function playerStrike(context) {
  return context.event?.actorType !== "summon";
}

function eventSkill(context) {
  return context.profession?.catalog?.skillsById?.get(
    context.event?.skillId ?? context.event?.application?.skillId,
  );
}

function modifyEngineerConditionBaseDuration(context, multiplier) {
  if (!hasTrait(context, TRAIT.CHEMICAL_ROUNDS)) return multiplier;
  const application = context.event?.application || context.event;
  if (application?.source === "Trait") return multiplier;
  const skill = eventSkill(context);
  if (
    context.event?.skillWeapon !== "Pistol"
    && context.event?.application?.skillWeapon !== "Pistol"
    && skill?.weapon !== "Pistol"
  ) return multiplier;

  const skillName =
    skill?.name
    || context.event?.skillName
    || context.event?.application?.skillName;
  const condition =
    context.condition
    || context.event?.condition
    || context.event?.application?.condition;
  if (skillName === "Blowtorch" && condition === "Burning") {
    return multiplier * 1.2;
  }
  if (skillName === "Glue Shot") {
    return condition === "Crippled" ? multiplier * 1.5 : multiplier;
  }
  return multiplier * (4 / 3);
}

function morphStrike(context) {
  return (
    context.event?.actorType !== "summon"
    && eventSkill(context)?.categories?.includes("Morph")
  );
}

function selectedSkillNames(context) {
  const selected = context.config?.selectedSkills || [];
  return new Set(
    (Array.isArray(selected) ? selected : Object.values(selected)).map(String),
  );
}

function engineerMechEvent(context) {
  const event = context.event;
  if (
    event?.engineerMech === true
    || event?.application?.engineerMech === true
  ) return true;
  if (
    context.config?.specialization !== "Mechanist"
    || event?.actorType !== "summon"
  ) return false;
  const skillId = event.skillId ?? event.application?.skillId;
  const skill = context.profession?.catalog?.skillsById?.get(skillId);
  const slot = Number(skill?.mechanicSlot || 0);
  return slot >= 1 && slot <= 3;
}

function jDriveSignet(context, name) {
  return (
    hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
    && selectedSkillNames(context).has(name)
  );
}

function selectedSignet(context, name) {
  return selectedSkillNames(context).has(name);
}

function heatTierStrikeFactor(context) {
  const heat = Number(context.runtime?.profession?.heat || 0);
  const skillName = eventSkill(context)?.name || context.event?.skillName;
  if (["Sun Edge", "Sun Ripper", "Gleam Saber"].includes(skillName)) {
    if (
      heat >= 100
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ) return 1.3;
    return heat > 50 ? 1.2 : 1;
  }
  if (skillName === "Blade Burst" && heat > 50) {
    if (
      heat >= 100
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    ) return 1.35;
    return 1.25;
  }
  const enhancedCapacityTier =
    context.event?.enhancedCapacityTier === true
    || (
      heat >= 100
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
    );
  if (skillName === "Particle Accelerator" && heat > 50) {
    return enhancedCapacityTier ? 1.35 : 1.1;
  }
  if (!enhancedCapacityTier) return 1;
  if (
    ["Laser Disk", "Launch Wall"]
      .includes(skillName)
  ) {
    return 1.35;
  }
  if (
    skillName === "Prismatic Singularity"
    && context.event?.name === "Explosion Damage"
  ) {
    return 1.25;
  }
  if (
    skillName === "Prime Light Beam"
    && context.event?.name === "Field Damage"
  ) {
    return 1.2;
  }
  return 1;
}

function playerHealthFraction(context) {
  return Math.max(
    0,
    Math.min(1, Number(context.config?.playerHealthFraction ?? 1)),
  );
}

function targetHealthFraction(context) {
  const configured = Number(
    context.config?.targetHealthFraction
    ?? context.config?.target?.healthFraction,
  );
  if (Number.isFinite(configured)) {
    return Math.max(0, Math.min(1, configured));
  }
  const maximum = Number(
    context.config?.target?.health
    ?? context.config?.targetHP
    ?? 0,
  );
  if (!(maximum > 0)) return 1;
  const damage =
    Number(context.runtime?.totals?.strike || 0)
    + Number(context.runtime?.totals?.condition || 0);
  return Math.max(0, Math.min(1, 1 - damage / maximum));
}

function heavyMetalBonus(context) {
  const fraction = targetHealthFraction(context);
  if (fraction < 0.25) return 0.15;
  if (fraction < 0.5) return 0.1;
  if (fraction < 0.75) return 0.05;
  return 0;
}

function activeBoonStacks(context, kind, maximum = 25) {
  const permanent = context.config?.boons?.[kind];
  const base = permanent === true ? 1 : Number(permanent || 0);
  const boons = context.runtime?.boons ?? context.state?.boons;
  const dynamic = (boons?.get(kind) || [])
    .filter(application =>
      application.at <= context.time
      && application.expiresAt > context.time)
    .reduce(
      (sum, application) => sum + Number(application.stacks || 1),
      0,
    );
  return Math.max(0, Math.min(maximum, base + dynamic));
}

function activeEngineerState(context, field) {
  const state =
    context.runtime?.profession
    ?? context.state?.profession;
  return Number(state?.[field] || 0) > context.time;
}

const EVOLVE_ATTRIBUTES = Object.freeze([
  "power",
  "precision",
  "toughness",
  "vitality",
  "ferocity",
  "conditionDamage",
  "expertise",
  "concentration",
  "healingPower",
]);

const engineerModifierRules = [
  {
    id: "engineer.glass-cannon",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.07,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.GLASS_CANNON)
      && Number(context.config?.playerHealthFraction ?? 1) > 0.75,
  },
  {
    id: "engineer.big-boomer",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.BIG_BOOMER)
      && playerHealthFraction(context) > targetHealthFraction(context),
  },
  {
    id: "engineer.shaped-charge",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context =>
      1 + Math.min(25, vulnerability(context)) * 0.005,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.SHAPED_CHARGE),
  },
  {
    id: "engineer.modified-ammunition",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context => 1 + targetConditionCount(context) * 0.01,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.MODIFIED_AMMUNITION),
  },
  {
    id: "engineer.excessive-energy",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.EXCESSIVE_ENERGY)
      && activeBoonStacks(context, "vigor", 1) > 0,
  },
  {
    id: "engineer.takedown-round",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context => {
      const state =
        context.runtime?.profession
        ?? context.state?.profession;
      return (
        playerStrike(context)
        && hasTrait(context, TRAIT.TAKEDOWN_ROUND)
        && Number(state?.endurance || 0)
          < Number(state?.maximumEndurance || 100) - 1e-9
      );
    },
  },
  {
    id: "engineer.kinetic-battery",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.15,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.KINETIC_BATTERY)
      && activeBoonStacks(context, "kinetic-battery", 1) > 0,
  },
  {
    id: "engineer.object-in-motion",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context => {
      const count = ["stability", "swiftness", "superspeed"]
        .filter(kind => activeBoonStacks(context, kind, 1) > 0)
        .length;
      return 1.05 ** count;
    },
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.OBJECT_IN_MOTION),
  },
  {
    id: "engineer.force-signet",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context =>
      hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? 0.18 : 0.15,
    when: context => selectedSignet(context, "Force Signet"),
  },
  {
    id: "engineer.j-drive-superconducting-signet",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.12,
    when: context =>
      jDriveSignet(context, "Superconducting Signet"),
  },
  {
    id: "engineer.lasers-edge",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context => {
      const state = context.runtime?.profession || {};
      const maximum = hasTrait(
        context,
        TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
      )
        ? 0.225
        : 0.15;
      return 1 + Math.min(maximum, Number(state.heat || 0) * 0.0015);
    },
    when: context => {
      const state = context.runtime?.profession || {};
      return (
        playerStrike(context)
        && hasTrait(context, TRAIT.LASERS_EDGE)
        && (
          Boolean(state.photonForgeActive)
          || (
            hasTrait(context, TRAIT.PHOTONIC_BLASTING_MODULE)
            && Boolean(state.overheated)
            && Number(state.heat || 0) > 0
          )
        )
      );
    },
  },
  {
    id: "engineer.solar-focusing-lens",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.SOLAR_FOCUSING_LENS)
      && context.event?.solarFocusingLens === true,
  },
  {
    id: "engineer.enhanced-capacity-damage-tier",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: heatTierStrikeFactor,
    when: context =>
      playerStrike(context)
      && heatTierStrikeFactor(context) > 1,
  },
  {
    id: "engineer.willing-host",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.05,
    when: context =>
      context.event?.actorType !== "summon"
      && hasTrait(context, TRAIT.WILLING_HOST)
      && activeEngineerState(context, "willingHostUntil"),
  },
  {
    id: "engineer.symbiotic-synergy",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.33,
    when: context =>
      hasTrait(context, TRAIT.SYMBIOTIC_SYNERGY)
      && morphStrike(context),
  },
  {
    id: "engineer.plasmatic-state",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.07,
    when: context =>
      context.event?.actorType !== "summon"
      && activeEngineerState(context, "plasmaticStateUntil"),
  },
  {
    id: "engineer.flame-jet-burning-target",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      context.event?.skillName === "Flame Jet"
      && Boolean(context.query?.targetHasCondition(
        "Burning",
        context.time,
        context.runtime,
      )),
  },
  {
    id: "engineer.high-caliber",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.HIGH_CALIBER),
  },
  {
    id: "engineer.mech-base-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.05,
    when: context =>
      engineerMechEvent(context)
      && !hasTrait(
        context,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
      ),
  },
  {
    id: "engineer.jade-cannons-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.2,
    when: context =>
      engineerMechEvent(context)
      && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS),
  },
  {
    id: "engineer.grand-entrance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.1,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.GRAND_ENTRANCE)
      && activeBoonStacks(context, "grand-entrance", 1) > 0,
  },
  {
    id: "engineer.heavy-metal-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: heavyMetalBonus,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.HEAVY_METAL),
  },
  {
    id: "engineer.heavy-metal-critical-damage",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: context => 1 + heavyMetalBonus(context),
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.HEAVY_METAL),
  },
  {
    id: "engineer.static-discharge-critical-damage",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "add",
    amount: 1,
    when: context =>
      context.event?.staticDischarge === true,
  },
  {
    id: "engineer.thermal-vision-damage",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: context =>
      hasTrait(context, TRAIT.THERMAL_VISION)
      && Number(
        context.runtime?.profession?.traitProcReadyAt
          ?.thermalVisionUntil || 0,
      ) > context.time,
  },
  {
    id: "engineer.serrated-steel-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context =>
      context.condition === "Bleeding"
      && hasTrait(context, TRAIT.SERRATED_STEEL),
  },
  {
    id: "engineer.incendiary-powder-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context =>
      context.condition === "Burning"
      && hasTrait(context, TRAIT.INCENDIARY_POWDER),
  },
  {
    id: "engineer.enhanced-capacity-prime-light-beam-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.5,
    when: context =>
      context.condition === "Burning"
      && context.event?.skillName === "Prime Light Beam"
      && hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
      && context.event?.enhancedCapacityTier === true,
  },
  {
    id: "engineer.carbolic-composition-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context =>
      context.condition === "Poisoned"
      && hasTrait(context, TRAIT.CARBOLIC_COMPOSITION),
  },
  {
    id: "engineer.hematic-focus",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.HEMATIC_FOCUS)
      && activeBoonStacks(context, "fury", 1) > 0,
  },
];

const engineerModifierHooks = createModifierHooks({
  rules: engineerModifierRules,
});

function modifyEngineerAttributes(context, attributes) {
  const modified = { ...attributes };
  const buildAttributesApplied = professionStaticRulesApplied(
    context.config,
  );
  if (
    hasTrait(context, TRAIT.CHEMICAL_ROUNDS)
    && !buildAttributesApplied
  ) {
    modified.conditionDamage = Number(modified.conditionDamage || 0) + 120;
  }
  if (
    hasTrait(context, TRAIT.THERMAL_VISION)
    && !buildAttributesApplied
  ) {
    modified.expertise = Number(modified.expertise || 0) + 150;
  }
  if (
    hasTrait(context, TRAIT.ENERGY_AMPLIFIER)
    && activeBoonStacks(context, "regeneration", 1) > 0
    && !(
      buildAttributesApplied
      && Boolean(context.config?.boons?.regeneration)
    )
  ) {
    modified.power = Number(modified.power || 0) + 250;
    modified.healingPower = Number(modified.healingPower || 0) + 250;
  }
  if (
    hasTrait(context, TRAIT.NO_SCOPE)
    && activeBoonStacks(context, "fury", 1) > 0
    && !(
      buildAttributesApplied
      && Boolean(context.config?.boons?.fury)
    )
  ) {
    modified.ferocity = Number(modified.ferocity || 0) + 150;
  }
  if (hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    modified.ferocity =
      Number(modified.ferocity || 0)
      + activeBoonStacks(context, "explosive-temper", 10) * 20;
  }
  if (
    hasTrait(context, TRAIT.SHARPSHOOTER)
    && context.event?.condition === "Bleeding"
    && context.event?.actorType !== "summon"
  ) {
    // The common Bleeding formula multiplies this field by 0.06. Feeding it
    // two thirds of Power produces Sharpshooter's 0.04 * Power scaling.
    modified.conditionDamage = Number(modified.power || 0) * (2 / 3);
  }
  if (activeEngineerState(context, "evolvedUntil")) {
    const evolveFactor = hasTrait(context, TRAIT.DOUBLE_HELIX)
      ? 1.2
      : 1.1;
    for (const attribute of EVOLVE_ATTRIBUTES) {
      modified[attribute] =
        Number(modified[attribute] || 0) * evolveFactor;
    }
  }
  if (activeEngineerState(context, "titanicUntil")) {
    const improvedMight = activeBoonStacks(context, "might") * 5;
    modified.power += improvedMight;
    modified.conditionDamage += improvedMight;
  }
  if (engineerMechEvent(context)) {
    // Mechanical Genius does not double dip the owner's Might. Resolve the
    // capped inherited attributes without Might, then apply the mech's own
    // copied Might after the caps.
    const mightStacks = activeBoonStacks(context, "might");
    const inheritedSource = {
      ...modified,
      power: Math.max(
        0,
        Number(modified.power || 0) - mightStacks * 30,
      ),
      // No Scope improves the engineer while under Fury; it is not part of
      // the attribute pool inherited by the mech.
      ferocity: Math.max(
        0,
        Number(modified.ferocity || 0) - (
          hasTrait(context, TRAIT.NO_SCOPE)
          && activeBoonStacks(context, "fury", 1) > 0
            ? 150
            : 0
        ),
      ),
      conditionDamage: Math.max(
        0,
        Number(modified.conditionDamage || 0) - mightStacks * 30,
      ),
    };
    const mech = engineerMechAttributes(context.config, inheritedSource);
    if (selectedSignet(context, "Shift Signet")) {
      mech.power += mightStacks * 30;
      mech.conditionDamage += mightStacks * 30;
    }
    return mech;
  }
  return modified;
}

export const engineerAttributeRules = Object.freeze({
  modifyAttributes: modifyEngineerAttributes,
  ...engineerModifierHooks,
  modifyConditionBaseDuration: modifyEngineerConditionBaseDuration,
});
