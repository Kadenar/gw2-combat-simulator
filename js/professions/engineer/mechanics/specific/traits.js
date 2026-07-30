import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../state.js";
import { emitEngineerState } from "./shared.js";

function emitBuff(
  context,
  skill,
  kind,
  duration,
  {
    at = context.effectiveEnd,
    stacks = 1,
    sourceId = skill.id,
    name = skill.name,
  } = {},
) {
  context.emit({
    type: "buff",
    at,
    source: sourceId === skill.id ? "engineer" : "Trait",
    sourceId,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name,
    kind,
    duration:
      String(kind).toLowerCase() === "superspeed"
        ? Math.min(10, Number(duration || 0))
        : Number(duration || 0),
    stacks,
  });
}

function emitTraitDamage(
  context,
  skill,
  {
    name,
    coefficient,
    sourceId,
    at = context.effectiveEnd,
    hitIndex = 1,
    totalHits = 1,
    explosion = false,
    weaponStrength,
    staticDischarge = false,
  },
) {
  context.emit({
    type: "damage",
    at,
    source: "Trait",
    sourceId,
    actorType: "effect",
    skillId: skill.id,
    skillName: name,
    parentSkillName: skill.name,
    name,
    coefficient,
    hits: 1,
    hitIndex,
    totalHits,
    skillWeapon: "Unequipped",
    explosion,
    ...(weaponStrength == null ? {} : { weaponStrength }),
    ...(staticDischarge ? { staticDischarge: true } : {}),
    triggeredBy: skill.name,
  });
}

function category(skill, name) {
  return skill?.categories?.some(
    value => String(value).toLowerCase() === name.toLowerCase(),
  );
}

function isFunctionGyro(skill) {
  return skill?.name === "Function Gyro";
}

export function isEngineerToolbeltSkill(skill) {
  return Boolean(
    skill?.toolbeltParentName
    || isFunctionGyro(skill),
  ) && skill?.name !== "Engage Photon Forge";
}

function isHealingSkill(skill) {
  return skill?.type === "Heal" || skill?.slot === "Heal";
}

function isHealingToolbeltSkill(context, skill) {
  if (!skill?.toolbeltParentName) return false;
  const parent = context.catalog.skillsByName.get(skill.toolbeltParentName);
  return isHealingSkill(parent);
}

function applyGrenadier(context, skill, at) {
  const state = context.state.profession;
  if (
    !hasEngineerTrait(context.config, TRAIT.GRENADIER)
    || at + context.epsilon
      < Number(state.traitProcReadyAt.grenadier || 0)
  ) return;
  state.traitProcReadyAt.grenadier = at + 20;
  for (let hitIndex = 1; hitIndex <= 6; hitIndex += 1) {
    emitTraitDamage(context, skill, {
      name: "Lesser Grenade Barrage",
      coefficient: 0.5,
      sourceId: TRAIT.GRENADIER,
      at,
      hitIndex,
      totalHits: 6,
      explosion: true,
    });
  }
}

function applyStreamlinedKits(context, skill, at) {
  const state = context.state.profession;
  if (
    skill.handlerId !== "engineer.kit-equip"
    || !hasEngineerTrait(context.config, TRAIT.STREAMLINED_KITS)
    || at + context.epsilon
      < Number(state.traitProcReadyAt.streamlinedKits || 0)
  ) return;
  state.traitProcReadyAt.streamlinedKits = at + 20;
  emitBuff(context, skill, "swiftness", 20, {
    at,
    sourceId: TRAIT.STREAMLINED_KITS,
    name: "Streamlined Kits — swiftness",
  });
  if ((skill.kitName || skill.name) === "Grenade Kit") {
    emitTraitDamage(context, skill, {
      name: "Drop Mine",
      coefficient: 1.75,
      sourceId: TRAIT.STREAMLINED_KITS,
      at,
      explosion: true,
    });
  }
}

function applyToolbeltTraits(context, skill, at) {
  if (!isEngineerToolbeltSkill(skill)) return;
  const state = context.state.profession;

  if (hasEngineerTrait(context.config, TRAIT.OPTIMIZED_ACTIVATION)) {
    emitBuff(context, skill, "vigor", 4, {
      at,
      sourceId: TRAIT.OPTIMIZED_ACTIVATION,
      name: "Optimized Activation — vigor",
    });
  }

  if (hasEngineerTrait(context.config, TRAIT.STATIC_DISCHARGE)) {
    emitTraitDamage(context, skill, {
      name: "Static Discharge",
      coefficient: 0.33,
      sourceId: TRAIT.STATIC_DISCHARGE,
      at,
      staticDischarge: true,
    });
  }

  if (hasEngineerTrait(context.config, TRAIT.KINETIC_BATTERY)) {
    state.kineticCharges = Math.min(
      5,
      Number(state.kineticCharges || 0) + 1,
    );
    if (state.kineticCharges >= 5) {
      state.kineticCharges = 0;
      emitBuff(context, skill, "kinetic-battery", 5, {
        at,
        sourceId: TRAIT.KINETIC_BATTERY,
        name: "Kinetic Battery",
      });
      emitBuff(context, skill, "quickness", 5, {
        at,
        sourceId: TRAIT.KINETIC_BATTERY,
        name: "Kinetic Battery — quickness",
      });
    }
    emitEngineerState(context, at, "kinetic-battery");
  }

  if (
    hasEngineerTrait(context.config, TRAIT.SPEED_OF_SYNERGY)
    && isHealingToolbeltSkill(context, skill)
  ) {
    emitBuff(
      context,
      skill,
      "superspeed",
      skill.toolbeltParentName === "Med Kit" ? 12 : 5,
      {
        at,
        sourceId: TRAIT.SPEED_OF_SYNERGY,
        name: "Speed of Synergy — superspeed",
      },
    );
  }
}

function applyScrapperCastTraits(context, skill, at) {
  if (
    hasEngineerTrait(context.config, TRAIT.SPEED_OF_SYNERGY)
    && isHealingSkill(skill)
    && skill.name !== "Med Kit"
  ) {
    emitBuff(context, skill, "superspeed", 7, {
      at,
      sourceId: TRAIT.SPEED_OF_SYNERGY,
      name: "Speed of Synergy — superspeed",
    });
  }

  if (
    hasEngineerTrait(context.config, TRAIT.GYROSCOPIC_ACCELERATION)
    && (category(skill, "Well") || isFunctionGyro(skill))
  ) {
    emitBuff(context, skill, "superspeed", 5, {
      at,
      sourceId: TRAIT.GYROSCOPIC_ACCELERATION,
      name: "Gyroscopic Acceleration — superspeed",
    });
  }

  if (!isFunctionGyro(skill)) return;
  if (hasEngineerTrait(context.config, TRAIT.SYSTEM_SHOCKER)) {
    context.emit({
      type: "control",
      at,
      source: "Trait",
      sourceId: TRAIT.SYSTEM_SHOCKER,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      name: "System Shocker — daze",
      controlKind: "daze",
      duration: 1,
    });
  }
  if (hasEngineerTrait(context.config, TRAIT.MASS_MOMENTUM)) {
    emitBuff(context, skill, "stability", 3, {
      at,
      sourceId: TRAIT.MASS_MOMENTUM,
      name: "Mass Momentum — stability",
    });
  }
}

export function applyEngineerCastTraits(context, skill) {
  const at = context.effectiveEnd;
  if (isHealingSkill(skill)) applyGrenadier(context, skill, at);
  applyStreamlinedKits(context, skill, at);
  applyToolbeltTraits(context, skill, at);
  applyScrapperCastTraits(context, skill, at);
}

export function modifyEngineerMaximumAmmo(context, maximum) {
  if (
    context.skill?.name === "Evolve"
    && hasEngineerTrait(context.config, TRAIT.DOUBLE_HELIX)
  ) {
    return Math.max(2, Number(maximum || 0));
  }
  if (
    isFunctionGyro(context.skill)
    && hasEngineerTrait(context.config, TRAIT.EX_MACHINA)
  ) {
    return Math.max(2, Number(maximum || 0));
  }
  return maximum;
}
