import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../core/state.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../../types.js";

function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === "Heal" || skill?.slot === "Heal";
}

function isHealingToolbeltSkill(
  context: EngineerCastContext,
  skill: EngineerSkill,
): boolean {
  if (!skill.toolbeltParentName) return false;
  return isHealingSkill(
    context.catalog.skillsByName.get(skill.toolbeltParentName),
  );
}

function isFunctionGyro(skill: EngineerSkill): boolean {
  return skill.name === "Function Gyro";
}

function category(skill: EngineerSkill, name: string): boolean {
  return Boolean(
    skill.categories?.some(
      (value) => String(value).toLowerCase() === name.toLowerCase(),
    ),
  );
}

function emitBuff(
  context: EngineerCastContext,
  skill: EngineerSkill,
  kind: string,
  duration: number,
  sourceId: number,
  name: string,
): void {
  context.emit({
    type: "buff",
    at: context.effectiveEnd,
    source: "Trait",
    sourceId,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name,
    kind,
    duration: kind === "superspeed" ? Math.min(10, duration) : duration,
    stacks: 1,
  });
}

export function applyScrapperCastTraits(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  if (
    hasEngineerTrait(context.config, TRAIT.SPEED_OF_SYNERGY)
    && isHealingToolbeltSkill(context, skill)
  ) {
    emitBuff(
      context,
      skill,
      "superspeed",
      skill.toolbeltParentName === "Med Kit" ? 12 : 5,
      TRAIT.SPEED_OF_SYNERGY,
      "Speed of Synergy — superspeed",
    );
  }
  if (
    hasEngineerTrait(context.config, TRAIT.SPEED_OF_SYNERGY)
    && isHealingSkill(skill)
    && skill.name !== "Med Kit"
  ) {
    emitBuff(
      context,
      skill,
      "superspeed",
      7,
      TRAIT.SPEED_OF_SYNERGY,
      "Speed of Synergy — superspeed",
    );
  }
  if (
    hasEngineerTrait(context.config, TRAIT.GYROSCOPIC_ACCELERATION)
    && (category(skill, "Well") || isFunctionGyro(skill))
  ) {
    emitBuff(
      context,
      skill,
      "superspeed",
      5,
      TRAIT.GYROSCOPIC_ACCELERATION,
      "Gyroscopic Acceleration — superspeed",
    );
  }
  if (!isFunctionGyro(skill)) return;
  if (hasEngineerTrait(context.config, TRAIT.SYSTEM_SHOCKER)) {
    context.emit({
      type: "control",
      at: context.effectiveEnd,
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
    emitBuff(
      context,
      skill,
      "stability",
      3,
      TRAIT.MASS_MOMENTUM,
      "Mass Momentum — stability",
    );
  }
}
