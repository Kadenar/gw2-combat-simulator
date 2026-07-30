/**
 * Ritualist spirits, spirit actives, and innervations.
 *
 * Spirit summons keep a generation number so replacing a spirit invalidates
 * its old queued autoattacks. Periodic attacks share a four-second cadence.
 * Summon Spirits schedules each spirit's distinct follow-up instead of
 * collapsing them into the player cast.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { NECROMANCER_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import {
  emitBuff,
  emitCondition,
  emitCreatureSummonTraits,
  emitDamage,
  emitState,
  gainNecromancerLifeForce,
  hasTrait,
} from "./shared.js";
import type {
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  NecromancerCastContext,
  NecromancerSkill,
  NecromancerState,
} from "../../types.js";

interface SpiritDefinition {
  readonly key: string;
  readonly attackCoefficient: number;
  readonly summonCoefficient: number;
  readonly summonHits?: number;
  readonly summonWeaponStrength?: number;
  readonly summonDelay?: number;
  readonly summonInterval?: number;
  readonly lingeringCoefficient?: number;
  readonly lingeringHits?: number;
  readonly lingeringInterval?: number;
  readonly lingeringDelay?: number;
  readonly activeCoefficient: number;
  readonly activeHits: number;
  readonly activeDelay: number;
  readonly activeInterval: number;
  readonly activeDuration: number;
}

const SPIRITS = MECHANICS.spirits as unknown as Readonly<
  Record<SkillId, SpiritDefinition>
>;

function activePrimaryWeapon(context: NecromancerCastContext): string {
  return String(context.state.activeWeaponSet === 2
    ? context.config.weaponSet2Primary || context.config.primaryWeapon || ""
    : context.config.primaryWeapon || "");
}

function spiritMetadata(
  key: string,
  attackType: string,
  extra: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    summonKind: "spirit",
    summonOwner: `spirit:${key}`,
    spirit: key,
    spiritAttackType: attackType,
    weaponStrength: MECHANICS.summonWeaponStrength,
    ...extra,
  };
}

function nextSpiritPulse(
  state: NecromancerState,
  at: number,
): number {
  if (!Number.isFinite(state.spiritAutoAnchorAt)) {
    state.spiritAutoAnchorAt = at + MECHANICS.firstSpiritAttackDelay;
  }
  const interval = MECHANICS.spiritAttackInterval;
  return state.spiritAutoAnchorAt > at
    ? state.spiritAutoAnchorAt
    : state.spiritAutoAnchorAt
      + Math.ceil((at - state.spiritAutoAnchorAt + Number.EPSILON) / interval)
        * interval;
}

function queueSpiritAutoattacks(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number,
): void {
  if (!(spirit.attackCoefficient > 0)) return;
  const state = context.state.profession;
  const generation = Number(state.spiritGenerations[spirit.key] || 0);
  const horizon = at + Math.max(180, Number(context.config.duration || 0));
  for (
    let attackAt = nextSpiritPulse(state, at);
    attackAt <= horizon;
    attackAt += MECHANICS.spiritAttackInterval
  ) {
    context.emit({
      type: "necromancer.summon-attack",
      at: attackAt,
      source: "Spirit",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: `${skill.name} Autoattack`,
      name: `${skill.name} Autoattack`,
      icon: skill.icon || "",
      coefficient: spirit.attackCoefficient,
      weaponStrength: MECHANICS.summonWeaponStrength,
      requiresSpirit: spirit.key,
      requiresSpiritGeneration: generation,
      summonKind: "spirit",
      summonOwner: `spirit:${spirit.key}`,
      spirit: spirit.key,
      spiritAttackType: "autoattack",
      anguishConditionalDamage: spirit.key === "anguish",
    });
  }
}

function emitEmpoweringSpirits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  key: string,
): void {
  if (!hasTrait(context, TRAIT.EMPOWERING_SPIRITS)) return;
  emitBuff(context, skill, "quickness", 3.75);
  if (key === "anguish") {
    emitBuff(context, skill, "might", 10, 8);
  } else if (key === "wanderlust") {
    emitBuff(context, skill, "fury", 5);
  } else if (key === "preservation") {
    emitBuff(context, skill, "resolution", 4);
  }
}

function painfulBondDuration(context: NecromancerCastContext): number {
  const stats = context.config.stats || {};
  const bonus =
    Number(stats.concentration || 0) / 1500
    + Number(stats.boonDurationBonus || 0) / 100
    + Number(stats.boonDurationBonuses?.["Painful Bond"] || 0) / 100;
  return MECHANICS.painfulBond.duration
    * Math.max(1, Math.min(2, 1 + bonus));
}

function emitPainfulBond(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
): void {
  const duration = painfulBondDuration(context);
  context.emit({
    type: "buff",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: "Painful Bond",
    kind: "necromancer-painful-bond",
    duration,
    stacks: 1,
  });
  context.emit({
    type: "necromancer.painful-bond",
    at,
    mode: "apply",
    source: "Spirit",
    sourceId: "ritualist.painful-bond",
    actorType: "effect",
    skillName: "Painful Bond",
    name: "Painful Bond",
    icon: MECHANICS.painfulBond.icon,
    duration,
    triggeredBy: skill.name,
  });
}

function emitAnguishInitial(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number,
): void {
  emitCondition(context, skill, "Crippled", 1, 4, { at });
  context.emit({
    type: "buff",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    kind: "target-vulnerability",
    duration: 10,
    stacks: 8,
  });
  const impactAt = at + Number(spirit.summonDelay || 0);
  emitPainfulBond(context, skill, impactAt);
  emitDamage(context, skill, spirit.summonCoefficient, {
    at: impactAt,
    hits: Number(spirit.summonHits || 1),
    interval: Number(spirit.summonInterval || 0),
    name: skill.name,
    source: "Spirit",
    actorType: "summon",
    metadata: spiritMetadata("anguish", "initial", {
      anguishConditionalDamage: true,
      weaponStrength: spirit.summonWeaponStrength,
    }),
  });
}

function emitWanderlustInitial(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number,
): void {
  emitDamage(context, skill, spirit.summonCoefficient, {
    at: context.start + 0.72,
    skillWeapon: activePrimaryWeapon(context),
  });
  const fieldAt = at + Number(spirit.lingeringDelay || 0);
  emitDamage(context, skill, Number(spirit.lingeringCoefficient || 0), {
    at: fieldAt,
    hits: Number(spirit.lingeringHits || 1),
    interval: Number(spirit.lingeringInterval || 0),
    name: "Spirit of Wanderlust — Initial Attack",
    source: "Spirit",
    actorType: "summon",
    metadata: spiritMetadata("wanderlust", "initial"),
  });
  emitCondition(context, skill, "Chilled", 1, 2, { at: fieldAt });
  context.emit({
    type: "buff",
    at: fieldAt,
    source: "Spirit",
    sourceId: skill.id,
    actorType: "summon",
    skillId: skill.id,
    skillName: skill.name,
    kind: "target-vulnerability",
    duration: 6,
    stacks: 4,
    ...spiritMetadata("wanderlust", "initial"),
  });
  emitCondition(context, skill, "Weakness", 1, 4, {
    at: fieldAt + 2,
    source: "Spirit",
    actorType: "summon",
    metadata: spiritMetadata("wanderlust", "initial"),
  });
  emitCondition(context, skill, "Slow", 1, 2, {
    at: fieldAt + 3,
    source: "Spirit",
    actorType: "summon",
    metadata: spiritMetadata("wanderlust", "initial"),
  });
  context.emit({
    type: "control",
    at: fieldAt + 3,
    source: "Spirit",
    sourceId: skill.id,
    actorType: "summon",
    skillId: skill.id,
    skillName: skill.name,
    controlKind: "knockdown",
    ...spiritMetadata("wanderlust", "initial"),
  });
}

function summonSpirit(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  spirit: SpiritDefinition,
  at: number,
): void {
  const state = context.state.profession;
  state.activeSpirits[spirit.key] = true;
  state.spiritGenerations[spirit.key] =
    Number(state.spiritGenerations[spirit.key] || 0) + 1;
  const initialDuration = spirit.key === "anguish" ? 1.1 : 0;
  state.spiritInitialUntil[spirit.key] = at + initialDuration;
  state.spiritBusyUntil[spirit.key] = at + initialDuration;
  if (state.soulTwistingAvailable) {
    state.soulTwistingAvailable = false;
    state.pendingSoulTwistSkill = skill.id;
  }
  emitState(context, at, "spirit-summoned");
  emitCreatureSummonTraits(context, skill, at);
  emitEmpoweringSpirits(context, skill, spirit.key);

  if (spirit.key === "anguish") {
    emitAnguishInitial(context, skill, spirit, at);
  } else if (spirit.key === "wanderlust") {
    emitWanderlustInitial(context, skill, spirit, at);
  } else if (spirit.key === "preservation") {
    emitBuff(context, skill, "protection", 4);
    emitBuff(context, skill, "vigor", 4);
  }
  queueSpiritAutoattacks(context, skill, spirit, at);
}

function summonSpirits(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  at: number,
): void {
  const state = context.state.profession;
  for (const spirit of Object.values(SPIRITS)) {
    if (
      !state.activeSpirits[spirit.key]
      || Number(state.spiritInitialUntil[spirit.key] || 0) > at
    ) continue;
    if (spirit.activeCoefficient > 0 && spirit.activeHits > 0) {
      emitDamage(context, skill, spirit.activeCoefficient, {
        at: at + spirit.activeDelay,
        hits: spirit.activeHits,
        interval: spirit.activeInterval,
        name: skill.name,
        source: "Spirit",
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        actorType: "summon",
        skillWeapon: "Unequipped",
        metadata: spiritMetadata(spirit.key, "summon-spirits", {
          anguishConditionalDamage: spirit.key === "anguish",
          weaponStrength: MECHANICS.summonSpiritsWeaponStrength,
        }),
      });
    }
    if (spirit.key === "wanderlust") {
      context.emit({
        type: "control",
        at: at + spirit.activeDelay,
        source: "Spirit",
        sourceId: `ritualist.${spirit.key}.summon-spirits`,
        actorType: "summon",
        skillId: skill.id,
        skillName: skill.name,
        controlKind: "daze",
        duration: 2,
        ...spiritMetadata(spirit.key, "summon-spirits"),
      });
    }
    state.spiritBusyUntil[spirit.key] =
      Math.max(
        Number(state.spiritBusyUntil[spirit.key] || 0),
        at + spirit.activeDuration,
      );
  }
  emitState(context, at, "summon-spirits");
}

function ritualist(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.id === ID.ESSENCE_BLAST) {
    const spirits = Object.keys(state.activeSpirits).length;
    const essence = MECHANICS.essenceBlast;
    emitDamage(
      context,
      skill,
      essence.coefficient,
      {
        skillWeapon: activePrimaryWeapon(context),
        metadata: {
          activeSpirits: spirits,
          essenceBlastDamagePerSpirit: essence.damagePerSpirit,
        },
      },
    );
    return true;
  }
  if (skill.id === ID.SUMMON_SPIRITS) {
    summonSpirits(context, skill, at);
    return true;
  }

  const spirit = SPIRITS[skill.id];
  if (!spirit) return false;
  summonSpirit(context, skill, spirit, at);
  return true;
}

function innervate(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const at = context.effectiveEnd;
  if (skill.id === ID.INNERVATE_ANGUISH) {
    emitDamage(context, skill, MECHANICS.innervateAnguish.coefficient, {
      source: "Spirit",
      actorType: "summon",
      metadata: {
        summonKind: "spirit",
        summonOwner: "spirit:anguish",
        spirit: "anguish",
        spiritAttackType: "innervate",
      },
    });
    emitBuff(context, skill, "might", 10, 8);
    emitBuff(context, skill, "fury", 5);
  } else if (skill.id === ID.INNERVATE_WANDERLUST) {
    context.emit({
      type: "control",
      at,
      source: "Spirit",
      sourceId: skill.id,
      actorType: "summon",
      skillId: skill.id,
      skillName: skill.name,
      controlKind: "fear",
      duration: 1.5,
      ...spiritMetadata("wanderlust", "innervate"),
    });
  } else if (skill.id === ID.INNERVATE_PRESERVATION) {
    emitBuff(context, skill, "aegis", 3);
    emitBuff(context, skill, "resistance", 4);
    emitBuff(context, skill, "stability", 5);
  } else {
    return false;
  }
  gainNecromancerLifeForce(context, 10, at);
  emitState(context, at, "innervate");
  return true;
}

export const necromancerSpiritSkillHandlers = Object.freeze({
  "necromancer.ritualist": ritualist,
  "necromancer.innervate": innervate,
});
