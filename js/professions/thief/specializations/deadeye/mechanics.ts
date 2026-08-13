import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { emitThiefState } from "../../core/shared.js";
import { storeStolenSkill } from "../../core/steal.js";
import { hasThiefTrait } from "../../core/state.js";
import type { ThiefCastContext, ThiefSkill } from "../../types.js";
import { deadeyeState } from "./state.js";
import { applyMaleficentSeven } from "./traits.js";
import type {
  Gw2CriticalResult,
  Gw2SchedulerPolicy,
} from "../../../../platform/gw2/types.js";
import type {
  SchedulerContext,
  SimulationEvent,
} from "../../../../platform/engine/types.js";

export const DEADEYE_STOLEN_ID_BY_CHOICE: Readonly<Record<string, number>> =
  Object.freeze({
    "steal-time": ID.STEAL_TIME,
    "steal-warmth": ID.STEAL_WARMTH,
    "steal-resistance": ID.STEAL_RESISTANCE,
    "steal-precision": ID.STEAL_PRECISION,
    "steal-health": ID.STEAL_HEALTH,
    "steal-strength": ID.STEAL_STRENGTH,
    "steal-durability": ID.STEAL_DURABILITY,
    "steal-defenses": ID.STEAL_DEFENSES,
    "steal-mobility": ID.STEAL_MOBILITY,
  });

export function selectedDeadeyeStolenSkill(context: ThiefCastContext): number {
  if (hasThiefTrait(context.config, TRAIT.FIRE_FOR_EFFECT)) {
    return ID.STEAL_TIME;
  }
  const choice =
    context.config.deterministicChoices?.deadeyeStolenSkillChoice ||
    "steal-time";
  return (
    DEADEYE_STOLEN_ID_BY_CHOICE[choice] ||
    DEADEYE_STOLEN_ID_BY_CHOICE["steal-time"]
  );
}

function initiativeAttackCriticalChance(
  context: ThiefCastContext,
  skill: ThiefSkill,
): number {
  const strike = (skill.effects || []).find(
    (effect) => effect.type === "strike" && Number(effect.coefficient) > 0,
  );
  if (!strike) return 0;
  const event: SimulationEvent = {
    type: "damage",
    at: context.effectiveEnd,
    source: "Skill",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    coefficient: Number(strike.coefficient),
    hits: 1,
    skillWeapon: strike.weapon || skill.weapon,
  };
  const policy = context.schedulerPolicy as Gw2SchedulerPolicy;
  const critical = policy.critical?.(
    context as unknown as SchedulerContext,
    event,
  ) as Gw2CriticalResult | undefined;
  return Math.max(0, Math.min(1, Number(critical?.chance || 0)));
}

function gainInitiativeAttackMalice(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = deadeyeState.from(context);
  const hitCount = (skill.effects || [])
    .filter(
      (effect) => effect.type === "strike" && Number(effect.coefficient) > 0,
    )
    .reduce((sum, effect) => sum + Math.max(1, Number(effect.hits || 1)), 0);
  const criticalChance = initiativeAttackCriticalChance(context, skill);
  state.maliceCriticalProgress += criticalChance * hitCount;
  const criticalMalice = Math.floor(
    state.maliceCriticalProgress + context.epsilon,
  );
  state.maliceCriticalProgress -= criticalMalice;
  state.malice = Math.min(
    state.maximumMalice,
    state.malice + hitCount + criticalMalice,
  );
  applyMaleficentSeven(context, context.effectiveEnd);
  emitThiefState(context, context.effectiveEnd, "malice");
}

function updateSilentScope(context: ThiefCastContext, skill: ThiefSkill): void {
  const state = deadeyeState.from(context);
  if (
    skill.id !== ID.DODGE ||
    !hasThiefTrait(context.config, TRAIT.SILENT_SCOPE) ||
    state.malice <= 3
  ) {
    return;
  }
  state.stealthAttackCharges = 1;
  state.stealthAttackExpiresAt = context.effectiveEnd + 3;
  emitThiefState(context, context.effectiveEnd, "silent-scope");
}

function updateCantripTraits(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  if (!(skill.categories || []).includes("Cantrip")) return;
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  if (context.config.relic === "Deadeye") {
    state.deadeyeRelicUntil = at + 8;
    context.emit({
      type: "proc",
      procType: "relic",
      at,
      source: "Relic",
      sourceId: "relic.deadeye",
      actorType: "effect",
      name: "Relic of the Deadeye",
      sourceSkill: skill.name,
      detail: "activated",
    });
    emitThiefState(context, at, "deadeye-relic");
  }
  if (hasThiefTrait(context.config, TRAIT.ONE_IN_THE_CHAMBER)) {
    storeStolenSkill(context, selectedDeadeyeStolenSkill(context));
  }
}

export function updateDeadeyeCastState(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  if (
    state.markedTargetId &&
    state.markExpiresAt > at &&
    skill.type === "Weapon" &&
    Number(skill.initiativeCost || 0) > 0 &&
    !skill.stealthAttack &&
    (skill.effects || []).some(
      (effect) => effect.type === "strike" && Number(effect.coefficient) > 0,
    )
  ) {
    gainInitiativeAttackMalice(context, skill);
  }
  if (
    skill.malicious &&
    state.markedTargetId &&
    context.effectiveEnd >= context.fullEnd - context.epsilon
  ) {
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    emitThiefState(context, at, "malice-spent");
  }
  updateSilentScope(context, skill);
  updateCantripTraits(context, skill);
}
