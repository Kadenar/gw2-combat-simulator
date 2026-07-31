import { ENGINEER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasEngineerTrait } from "./state.js";
import { emitEngineerState } from "./events.js";
import type {
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerSkill,
} from "../types.js";

interface EmitBuffOptions {
  readonly at?: number;
  readonly stacks?: number;
  readonly sourceId?: SkillId;
  readonly name?: string;
}

interface EmitTraitDamageOptions {
  readonly name: string;
  readonly coefficient: number;
  readonly sourceId: SkillId;
  readonly at?: number;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly explosion?: boolean;
  readonly weaponStrength?: number;
  readonly staticDischarge?: boolean;
}

function emitBuff(
  context: EngineerCastContext,
  skill: EngineerSkill,
  kind: string,
  duration: number,
  {
    at = context.effectiveEnd,
    stacks = 1,
    sourceId = skill.id,
    name = skill.name,
  }: EmitBuffOptions = {},
): void {
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
  context: EngineerCastContext,
  skill: EngineerSkill,
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
  }: EmitTraitDamageOptions,
): void {
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

function isFunctionGyro(skill: EngineerSkill | undefined): boolean {
  return skill?.name === "Function Gyro";
}

export function isEngineerToolbeltSkill(
  skill: EngineerSkill | undefined,
): boolean {
  return Boolean(
    skill?.toolbeltParentName
    || isFunctionGyro(skill),
  ) && skill?.name !== "Engage Photon Forge";
}

function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === "Heal" || skill?.slot === "Heal";
}

function applyGrenadier(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
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

function applyStreamlinedKits(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
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

function applyToolbeltTraits(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
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

}

export function applyEngineerCastTraits(
  context: EngineerCastContext,
  skill: EngineerSkill,
): void {
  const at = context.effectiveEnd;
  if (isHealingSkill(skill)) applyGrenadier(context, skill, at);
  applyStreamlinedKits(context, skill, at);
  applyToolbeltTraits(context, skill, at);
}
