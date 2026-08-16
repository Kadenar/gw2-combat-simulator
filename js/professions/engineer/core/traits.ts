import { professionCoreState } from "../../../platform/engine/profession.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasEngineerTrait } from "./state.js";
import { emitEngineerState } from "./events.js";
import {
  applyCondition,
  procState,
  queueBuff,
  queueDamage,
  recordTrait,
  resolverSkill,
} from "./shared.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type {
  EngineerCastContext,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails,
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
    // GW2 hard cap on superspeed duration is 10s
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

// Function Gyro (scrapper) acts as a toolbelt skill for trait interactions despite no toolbeltParentName;
// "Engage Photon Forge" occupies the toolbelt slot but is a profession mechanic, not a toolbelt skill
export function isEngineerToolbeltSkill(
  skill: EngineerSkill | undefined,
): boolean {
  return (
    Boolean(skill?.toolbeltParentName || isFunctionGyro(skill)) &&
    skill?.name !== "Engage Photon Forge"
  );
}

function isHealingSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.type === "Heal" || skill?.slot === "Heal";
}

// Grenadier procs on healing skill casts (Healing Turret Overcharge in-game); 20s ICD
function applyGrenadier(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
  const state = professionCoreState(context);
  if (
    !hasEngineerTrait(context.config, TRAIT.GRENADIER) ||
    at + context.epsilon < Number(state.traitProcReadyAt.grenadier || 0)
  )
    return;
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

// Streamlined Kits fires on kit-equip only; 20s ICD prevents rapid kit-swapping from stacking procs
function applyStreamlinedKits(
  context: EngineerCastContext,
  skill: EngineerSkill,
  at: number,
): void {
  const state = professionCoreState(context);
  if (
    skill.handlerId !== "engineer.kit-equip" ||
    !hasEngineerTrait(context.config, TRAIT.STREAMLINED_KITS) ||
    at + context.epsilon < Number(state.traitProcReadyAt.streamlinedKits || 0)
  )
    return;
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
  const state = professionCoreState(context);

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
    state.kineticCharges = Math.min(5, Number(state.kineticCharges || 0) + 1);
    // proc quickness and reset charges every 5th toolbelt cast
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

// checks both the event flag and skill category — some skills lack the explosion category in the API
function isExplosion(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): boolean {
  if (event.explosion || event.damageKind === "explosion") return true;
  const skill = resolverSkill(context, event.skillId ?? event.sourceId);
  return Boolean(
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "explosion",
    ) ||
    skill?.kit === "Grenade Kit" ||
    skill?.name === "Devastator",
  );
}

// mech attacks (summon actorType) don't trigger Aim-Assisted Rocket
function isAimAssistedProjectile(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): boolean {
  if (event.actorType !== "player") return false;
  if (event.projectile === true) return true;
  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.kit === "Grenade Kit" ||
    skill?.categories?.some(
      (category) => String(category).toLowerCase() === "projectile",
    ),
  );
}

function usesRandomTraitProcs(context: EngineerResolverContext): boolean {
  return context.random?.stochastic === true;
}

function rolledCritical(details: EngineerResolverReactionDetails): boolean {
  return details.hitContext?.critical?.didCrit === true;
}

// resets explosiveEntranceFired so the trait can fire on the first hit of the next attack sequence
export function handleEngineerDodge(context: EngineerResolverContext): void {
  procState(context).explosiveEntranceFired = false;
}

export function reactToEngineerDamage(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
  details: EngineerResolverReactionDetails = {},
): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = procState(context);
  const criticalChance = Number(
    details.hitContext?.critical?.chance ?? details.criticalChance ?? 0,
  );
  if (
    event.actorType === "player" &&
    hasTrait(context, TRAIT.EXPLOSIVE_ENTRANCE) &&
    !state.explosiveEntranceFired
  ) {
    // fires once per attack sequence; dodge resets the flag for the next sequence
    state.explosiveEntranceFired = true;
    queueDamage(context, event, {
      name: "Explosive Entrance",
      coefficient: 1.25,
      sourceId: TRAIT.EXPLOSIVE_ENTRANCE,
      actorType: "effect",
      explosion: true,
    });
    recordTrait(context, "Explosive Entrance", event);
  }

  const explosion = isExplosion(context, event);
  if (explosion && hasTrait(context, TRAIT.STEEL_PACKED_POWDER)) {
    queueBuff(context, event, {
      name: "Steel-Packed Powder",
      kind: "target-vulnerability",
      stacks: 1,
      duration: 5,
      sourceId: TRAIT.STEEL_PACKED_POWDER,
      actorType: "effect",
    });
  }
  if (
    explosion &&
    hasTrait(context, TRAIT.SHORT_FUSE) &&
    Number(state.shortFuse || 0) <= event.at
  ) {
    state.shortFuse = event.at + 3;
    queueBuff(context, event, {
      name: "Short Fuse",
      kind: "fury",
      stacks: 1,
      duration: 4,
      sourceId: TRAIT.SHORT_FUSE,
      actorType: "effect",
    });
    recordTrait(context, "Short Fuse", event);
  }
  if (explosion && hasTrait(context, TRAIT.EXPLOSIVE_TEMPER)) {
    queueBuff(context, event, {
      name: "Explosive Temper",
      kind: "explosive-temper",
      stacks: 1,
      duration: 10,
      sourceId: TRAIT.EXPLOSIVE_TEMPER,
      actorType: "effect",
    });
    recordTrait(context, "Explosive Temper", event);
  }
  if (
    event.name === "Explosive Entrance" &&
    hasTrait(context, TRAIT.GRAND_ENTRANCE)
  ) {
    queueBuff(context, event, {
      name: "Grand Entrance — resistance",
      kind: "resistance",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: "effect",
    });
    queueBuff(context, event, {
      name: "Grand Entrance",
      kind: "grand-entrance",
      stacks: 1,
      duration: 3,
      sourceId: TRAIT.GRAND_ENTRANCE,
      actorType: "effect",
    });
    recordTrait(context, "Grand Entrance", event);
  }
  if (
    explosion &&
    event.name !== "Aim-Assisted Rocket" &&
    hasTrait(context, TRAIT.SHRAPNEL)
  ) {
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered = context.random.roll(0.33, "engineer.shrapnel");
    } else {
      // deterministic: accumulate 0.33 per explosion; trigger and subtract 1 when threshold reached
      state.shrapnelProgress = Number(state.shrapnelProgress || 0) + 0.33;
      triggered = state.shrapnelProgress >= 1;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state.shrapnelProgress = Number(state.shrapnelProgress || 0) - 1;
      }
      applyCondition(details, context, event, {
        name: "Shrapnel",
        condition: "Bleeding",
        stacks: 1,
        duration: 6,
        sourceId: TRAIT.SHRAPNEL,
        actorType: "effect",
      });
      queueBuff(context, event, {
        name: "Shrapnel",
        kind: "target-crippled",
        stacks: 1,
        duration: 1,
        sourceId: TRAIT.SHRAPNEL,
        actorType: "effect",
      });
      recordTrait(context, "Shrapnel", event);
    }
  }

  if (
    event.actorType !== "summon" &&
    hasTrait(context, TRAIT.SERRATED_STEEL) &&
    criticalChance > 0
  ) {
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered =
        rolledCritical(details) &&
        context.random.roll(0.33, "engineer.serrated-steel");
    } else {
      // deterministic: accumulate critChance * 0.33 (combines expected crit rate with proc chance)
      state.serratedSteelProgress =
        Number(state.serratedSteelProgress || 0) + criticalChance * 0.33;
      triggered = state.serratedSteelProgress >= 1;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state.serratedSteelProgress =
          Number(state.serratedSteelProgress || 0) - 1;
      }
      applyCondition(details, context, event, {
        name: "Serrated Steel",
        condition: "Bleeding",
        stacks: 1,
        duration: 3,
        sourceId: TRAIT.SERRATED_STEEL,
        actorType: "effect",
      });
      recordTrait(context, "Serrated Steel", event);
    }
  }

  if (
    event.actorType === "player" &&
    hasTrait(context, TRAIT.NO_SCOPE) &&
    criticalChance > 0 &&
    // 8s cooldown between fury procs
    Number(state.noScope || 0) <= event.at
  ) {
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered = rolledCritical(details);
    } else {
      state.noScopeProgress =
        Number(state.noScopeProgress || 0) + criticalChance;
      triggered = state.noScopeProgress >= 1;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state.noScopeProgress = Number(state.noScopeProgress || 0) - 1;
      }
      state.noScope = event.at + 8;
      queueBuff(context, event, {
        name: "No Scope",
        kind: "fury",
        stacks: 1,
        duration: 4,
        sourceId: TRAIT.NO_SCOPE,
        actorType: "effect",
      });
      recordTrait(context, "No Scope", event);
    }
  }

  if (
    event.actorType != null &&
    ["player", "summon"].includes(event.actorType) &&
    hasTrait(context, TRAIT.INCENDIARY_POWDER) &&
    criticalChance > 0
  ) {
    // player and mech have independent proc progress and cooldowns under the same trait
    const owner = event.actorType === "summon" ? "mech" : "player";
    const readyKey = `incendiaryPowder.${owner}`;
    const progressKey = `incendiaryProgress.${owner}`;
    let triggered = false;
    if (usesRandomTraitProcs(context)) {
      triggered =
        rolledCritical(details) && Number(state[readyKey] || 0) <= event.at;
    } else {
      state[progressKey] = Number(state[progressKey] || 0) + criticalChance;
      triggered =
        state[progressKey] >= 1 && Number(state[readyKey] || 0) <= event.at;
    }
    if (triggered) {
      if (!usesRandomTraitProcs(context)) {
        state[progressKey] = Number(state[progressKey] || 0) - 1;
      }
      state[readyKey] = event.at + 10;
      applyCondition(details, context, event, {
        name: "Incendiary Powder",
        condition: "Burning",
        stacks: 1,
        duration: 8,
        sourceId: TRAIT.INCENDIARY_POWDER,
        actorType: event.actorType === "summon" ? "summon" : "effect",
        metadata: event.actorType === "summon" ? { engineerMech: true } : {},
      });
      recordTrait(context, "Incendiary Powder", event);
    }
  }

  if (
    hasTrait(context, TRAIT.AIM_ASSISTED_ROCKET) &&
    isAimAssistedProjectile(context, event) &&
    Number(state.aimAssistedRocket || 0) <= event.at
  ) {
    state.aimAssistedRocket = event.at + 3;
    state.aimAssistedRocketCount =
      Number(state.aimAssistedRocketCount || 0) + 1;
    // every 5th projectile upgrades to Orbital Command Strike (2s delay for call-down)
    const orbital = state.aimAssistedRocketCount % 5 === 0;
    queueDamage(context, event, {
      name: orbital ? "Orbital Command Strike" : "Aim-Assisted Rocket",
      coefficient: orbital ? 1.92 : 1,
      sourceId: orbital
        ? ID.ORBITAL_COMMAND_STRIKE
        : ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL,
      actorType: "effect",
      at: event.at + (orbital ? 2 : 0.04),
      explosion: !orbital,
      ...(orbital
        ? {
            comboFinisher: {
              ownerId: "engineer",
              attemptId: `${event.activationId || event.sourceId}:orbital-command-strike:blast`,
              finisherType: "Blast",
              ambiguousFieldSelection: "oldest",
            },
          }
        : {}),
      weaponStrengthProfileId: "nonweapon.unequipped",
    });
    recordTrait(
      context,
      orbital ? "Orbital Command Strike" : "Aim-Assisted Rocket",
      event,
    );
  }
}

export function reactToEngineerCondition(
  context: EngineerResolverContext,
  event: EngineerResolverEvent,
): void {
  if (
    event.condition === "Burning" &&
    event.actorType !== "summon" &&
    hasTrait(context, TRAIT.THERMAL_VISION)
  ) {
    const state = professionCoreState(context);
    // Math.max extends the window — multiple Burning applications stack the active duration
    state.traitProcReadyAt.thermalVisionUntil = Math.max(
      Number(state.traitProcReadyAt.thermalVisionUntil || 0),
      event.at + 4,
    );
  }
  if (
    event.condition === "Bleeding" &&
    event.actorType !== "summon" &&
    hasTrait(context, TRAIT.SANGUINE_ARRAY)
  ) {
    queueBuff(context, event, {
      name: "Sanguine Array",
      kind: "might",
      stacks: Math.max(1, Number(event.stacks || 1)),
      duration: 4,
      sourceId: TRAIT.SANGUINE_ARRAY,
      actorType: "effect",
    });
    recordTrait(context, "Sanguine Array", event);
  }
  if (
    event.condition === "Bleeding" &&
    event.actorType !== "summon" &&
    hasTrait(context, TRAIT.HEMATIC_FOCUS)
  ) {
    const state = procState(context);
    if (Number(state.hematicFocus || 0) <= event.at) {
      state.hematicFocus = event.at + 8;
      queueBuff(context, event, {
        name: "Hematic Focus",
        kind: "fury",
        stacks: 1,
        duration: 8,
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: "effect",
      });
      recordTrait(context, "Hematic Focus", event);
    }
  }
}
