import { ENGINEER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasEngineerTrait } from "../../core/state.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../../types.js";

// Some skills set type="Heal", others only set slot="Heal"; check both.
function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === "Heal" || skill?.slot === "Heal";
}

// Toolbelt skills inherit their heal category from their parent kit/gyro.
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
    // GW2 caps superspeed at 10s regardless of source; other boons uncapped here
    duration: kind === "superspeed" ? Math.min(10, duration) : duration,
    stacks: 1,
  });
}

export function applyScrapperCastTraits(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  // Speed of Synergy (master trait): healing toolbelt skills grant superspeed.
  // Med Kit toolbelt gets 12s (exceptional duration from the kit design); all others get 5s.
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
  // Speed of Synergy also applies when casting the heal skill itself (7s),
  // but Med Kit is excluded because equipping it doesn't constitute a cast.
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
  // Gyroscopic Acceleration (adept trait): Well skills and Function Gyro grant 5s superspeed.
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
  // Remaining traits only proc on Function Gyro.
  if (!isFunctionGyro(skill)) return;
  // System Shocker (master trait): Function Gyro dazes for 1s on cast.
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
  // Mass Momentum (GM trait): Function Gyro grants 3 stacks of stability (seeds the pulse loop).
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
