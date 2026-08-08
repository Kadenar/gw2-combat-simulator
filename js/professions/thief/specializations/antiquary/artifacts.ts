import { antiquaryState } from "./state.js";
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import { emitThiefState, gainThiefInitiative } from "../../core/shared.js";
import {
  ANTIQUARY_SCOUNDRELS_LUCK_ICD,
  ANTIQUARY_SCUFFLE_DURATION,
  ANTIQUARY_SCUFFLE_INTERVAL,
} from "./mechanics.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type {
  AntiquaryState,
  ThiefArtifactKind,
  ThiefArtifactSlot,
  ThiefCastContext,
  ThiefDoubleEdgeOutcome,
  ThiefEmissionContext,
  ThiefScheduledTask,
  ThiefSchedulerContext,
  ThiefSkill,
} from "../../types.js";

interface ForgedSurferTaskPayload extends Record<string, unknown> {
  readonly generation: number;
  readonly bomb: number;
  readonly skillId: SkillId;
}

interface SkrittScuffleTaskPayload extends Record<string, unknown> {
  readonly expiresAt: number;
}

const SCUFFLE_INTERVAL = ANTIQUARY_SCUFFLE_INTERVAL;
const SCUFFLE_DURATION = ANTIQUARY_SCUFFLE_DURATION;
const SCOUTREL_LUCK_ICD = ANTIQUARY_SCOUNDRELS_LUCK_ICD;

function nextArtifact(
  state: AntiquaryState,
  kind: ThiefArtifactKind,
): ThiefArtifactSlot {
  const sequence = state.artifactOutcomeSequence[kind] || [];
  const index = Number(state.artifactOutcomeIndices[kind] || 0);
  const skillId =
    sequence[index % Math.max(1, sequence.length)] ||
    (kind === "offensive"
      ? THIEF_ARTIFACT_IDS.OFFENSIVE[0]
      : THIEF_ARTIFACT_IDS.DEFENSIVE[0]);
  state.artifactOutcomeIndices[kind] = index + 1;
  return { kind, skillId };
}

function allArtifactChoices(): ThiefArtifactSlot[] {
  return [
    ...THIEF_ARTIFACT_IDS.OFFENSIVE.map((skillId) => ({
      kind: "offensive" as const,
      skillId,
    })),
    ...THIEF_ARTIFACT_IDS.DEFENSIVE.map((skillId) => ({
      kind: "defensive" as const,
      skillId,
    })),
  ];
}

function usesArtifactChoiceMode(context: ThiefSchedulerContext): boolean {
  return context.config.deterministicChoices?.artifactDrawSequence === "choose";
}

function emitBoon(
  context: ThiefEmissionContext,
  at: number,
  boon: string,
  duration: number,
  stacks: number,
  name: string,
): void {
  context.emit({
    type: "buff",
    at,
    source: "thief",
    sourceId: name,
    actorType: "player",
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name,
    kind: boon,
    boon,
    duration,
    stacks,
  });
}

function reduceSkrittSwipeRecharge(
  context: ThiefSchedulerContext,
  at: number,
): void {
  if (!hasThiefTrait(context.config, TRAIT.REPEAT_RANSACKER)) return;
  const readyAt = Number(context.state.cooldowns.get(ID.SKRITT_SWIPE) || 0);
  if (readyAt > at) {
    context.state.cooldowns.set(ID.SKRITT_SWIPE, Math.max(at, readyAt - 2));
  }
}

function grantScoundrelsLuck(context: ThiefSchedulerContext, at: number): void {
  const state = antiquaryState.from(context);
  if (
    !hasThiefTrait(context.config, TRAIT.SCOUNDRELS_LUCK) ||
    at + Number(context.epsilon || 0.0001) <
      Number(state.scoundrelsLuckReadyAt || 0)
  )
    return;
  state.scoundrelsLuck = 1;
  state.scoundrelsLuckReadyAt = at + SCOUTREL_LUCK_ICD;
}

function grantCombatHigh(context: ThiefSchedulerContext, at: number): void {
  if (!hasThiefTrait(context.config, TRAIT.COMBAT_HIGH)) return;
  const state = antiquaryState.from(context);
  state.combatHighStacks = 10;
  state.combatHighExpiresAt = at + 20;
}

function reduceUtilityRecharges(
  context: ThiefSchedulerContext,
  at: number,
): void {
  if (!hasThiefTrait(context.config, TRAIT.IMPROVISATION)) return;
  const state = antiquaryState.from(context);
  if (
    at + Number(context.epsilon || 0.0001) <
    Number(state.improvisationReadyAt || 0)
  )
    return;
  const selected = context.config.selectedSkills || [];
  const selectedNames = new Set(
    (Array.isArray(selected) ? selected : Object.values(selected))
      .map((value) => (typeof value === "string" ? value : value?.name))
      .filter(Boolean),
  );
  for (const name of selectedNames) {
    const skill = context.catalog.skillsByName.get(name);
    if (skill?.type !== "Utility") continue;
    const readyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    if (readyAt > at) {
      context.state.cooldowns.set(skill.id, at + (readyAt - at) * 0.75);
    }
  }
  state.improvisationReadyAt = at + 15;
}

/**
 * Replaces the currently held artifacts.
 *
 * Prolific Plunderer adds a third slot to every pilfer, but its extra artifact
 * use only applies to Skritt Swipe. Improvisation adds one further Swipe use.
 */
export function pilferArtifacts(
  context: ThiefSchedulerContext,
  at: number,
  reason = "pilfer",
  source = "initiative",
): void {
  const state = antiquaryState.from(context);
  const prolific = hasThiefTrait(context.config, TRAIT.PROLIFIC_PLUNDERER);
  state.artifactSlots = usesArtifactChoiceMode(context)
    ? allArtifactChoices()
    : [
        nextArtifact(state, "offensive"),
        nextArtifact(state, "defensive"),
        ...(prolific ? [nextArtifact(state, "offensive")] : []),
      ];
  state.artifactUsesRemaining =
    1 +
    (source === "swipe" && prolific ? 1 : 0) +
    (source === "swipe" && hasThiefTrait(context.config, TRAIT.IMPROVISATION)
      ? 1
      : 0);
  state.initiativeSpentSincePilfer = 0;
  if (source === "swipe") {
    grantScoundrelsLuck(context, at);
    grantCombatHigh(context, at);
    reduceUtilityRecharges(context, at);
  }
  emitThiefState(context, at, reason);
}

export function reshuffleArtifacts(context: ThiefCastContext): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  state.artifactSlots = usesArtifactChoiceMode(context)
    ? allArtifactChoices()
    : state.artifactSlots.map((slot) => nextArtifact(state, slot.kind));
  emitThiefState(context, at, "artifacts-reshuffled");
}

function extendExhilaratingEphemera(state: AntiquaryState, at: number): void {
  const remaining = Math.max(0, Number(state.antiquaryDamageUntil || 0) - at);
  state.antiquaryDamageUntil = at + Math.min(20, remaining + 10);
}

function applyArtifactIdentity(
  context: ThiefCastContext,
  skill: ThiefSkill,
  at: number,
): void {
  const state = antiquaryState.from(context);
  const meticulous = hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN);
  if (skill.id === ID.METAL_LEGION_GUITAR) {
    state.stealthAttackCharges = 3;
    state.stealthAttackExpiresAt = at + (meticulous ? 12 : 10);
  } else if (skill.id === ID.MISTBURN_MORTAR) {
    state.mistburnCharges = 5;
    state.mistburnExpiresAt = at + (meticulous ? 12 : 10);
    state.mistburnGeneration += 1;
  } else if (skill.id === ID.SUMMON_KRYPTIS_TURRET_ID_77192) {
    state.kryptisDamageUntil = at + (meticulous ? 10 : 8);
  } else if (skill.id === ID.CHAK_SHIELD) {
    state.chakInitiativeRefundUntil = at + (meticulous ? 12 : 10);
  } else if (skill.id === ID.HOLO_DANCER_DECOY) {
    const expiresAt = at + (meticulous ? 12 : 10);
    state.holoUtilityCooldownReductionExpirations = [
      ...(state.holoUtilityCooldownReductionExpirations || []),
      expiresAt,
    ];
    state.holoUtilityCooldownReduction = 0.8;
    state.holoUtilityCooldownReductionExpiresAt = Math.max(
      ...state.holoUtilityCooldownReductionExpirations,
    );
  } else if (skill.id === ID.FORGED_SURFER_DASH_ID_76633) {
    state.forgedSurferGeneration += 1;
  }
}

export function consumeArtifact(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  const slot = state.artifactSlots.find((value) => value.skillId === skill.id);
  state.artifactUsesRemaining = Math.max(0, state.artifactUsesRemaining - 1);
  state.artifactSlots = state.artifactSlots.filter(
    (value) => value.skillId !== skill.id,
  );
  if (hasThiefTrait(context.config, TRAIT.ENTERPRISING_ARISTOCRAT)) {
    gainThiefInitiative(context, 2, at, "enterprising-aristocrat");
  }
  if (hasThiefTrait(context.config, TRAIT.EXHILARATING_EPHEMERA)) {
    extendExhilaratingEphemera(state, at);
  }
  if (hasThiefTrait(context.config, TRAIT.POSSESSIVE_HOARDER)) {
    if (slot?.kind === "offensive") {
      emitBoon(context, at, "might", 12, 10, "Possessive Hoarder");
    }
    if (slot?.kind === "defensive") {
      emitBoon(context, at, "protection", 5, 1, "Possessive Hoarder");
    }
    emitBoon(context, at, "alacrity", 5, 1, "Possessive Hoarder");
  }
  if (
    skill.id === ID.CHAK_SHIELD &&
    hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
  ) {
    context.emit({
      type: "damage",
      at,
      source: "thief",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Chak Shield",
      coefficient: 0.3,
      hits: 1,
      activationId: context.reservationId,
    });
  }
  applyArtifactIdentity(context, skill, at);
  reduceSkrittSwipeRecharge(context, at);
  emitThiefState(context, at, "artifact-used");
}

export function completeForgedSurfer(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  consumeArtifact(context, skill);
  const state = antiquaryState.from(context);
  context.tasks.schedule({
    type: "thief.forged-surfer",
    at: context.effectiveEnd + 1,
    ownerId: `thief.forged-surfer:${state.forgedSurferGeneration}`,
    payload: {
      generation: state.forgedSurferGeneration,
      bomb: 0,
      skillId: skill.id,
    },
  });
}

function emitForgedSurferPacket(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ForgedSurferTaskPayload>,
  coefficient: number,
  burnDuration: number,
  burnStacks = 1,
): void {
  const bomb = Number(task.payload.bomb || 0);
  const name = bomb === 0 ? "Forged Surfer Dash" : "Forged Surfer Dash — Bomb";
  context.emit({
    type: "damage",
    at: task.at,
    source: "thief",
    sourceId: task.payload.skillId,
    actorType: "player",
    skillId: task.payload.skillId,
    skillName: "Forged Surfer Dash",
    name,
    coefficient,
    hits: 1,
  });
  context.emit({
    type: "condition",
    at: task.at,
    source: "thief",
    sourceId: task.payload.skillId,
    actorType: "player",
    skillId: task.payload.skillId,
    skillName: "Forged Surfer Dash",
    name: `${name} — Burning`,
    condition: "Burning",
    stacks: burnStacks,
    duration: burnDuration,
  });
}

export function handleForgedSurfer(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<ForgedSurferTaskPayload>,
): void {
  if (
    Number(task.payload.generation || 0) !==
    Number(antiquaryState.from(context).forgedSurferGeneration || 0)
  )
    return;
  const bomb = Number(task.payload.bomb || 0);
  const meticulous = hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN);
  emitForgedSurferPacket(
    context,
    task,
    bomb === 0 ? (meticulous ? 2.8 : 2.4) : meticulous ? 1.4 : 1.2,
    bomb === 0 ? (meticulous ? 12 : 6) : meticulous ? 4.5 : 3.5,
    bomb === 0 && meticulous ? 2 : 1,
  );
  if (
    bomb >=
    Number(antiquaryState.from(context).forgedSurferMaximumBombHits || 5)
  )
    return;
  context.tasks.schedule({
    ...task,
    at: task.at + 3,
    payload: {
      ...task.payload,
      bomb: bomb + 1,
    },
  });
}

function riskyDoubleEdge(
  context: ThiefCastContext,
  skill: ThiefSkill,
): boolean {
  return (
    Number(context.state.cooldowns.get(skill.id) || 0) >
    context.start + Number(context.epsilon || 0.0001)
  );
}

function peekRiskyOutcome(context: ThiefCastContext): ThiefDoubleEdgeOutcome {
  const state = antiquaryState.from(context);
  if (state.scoundrelsLuck > 0) return "success";
  const sequence = state.doubleEdgeOutcomeSequence || ["success", "backfire"];
  const index = Number(state.doubleEdgeOutcomeIndex || 0);
  return sequence[index % Math.max(1, sequence.length)] || "success";
}

export function peekDoubleEdgeOutcome(
  context: ThiefCastContext,
  skill: ThiefSkill,
): ThiefDoubleEdgeOutcome {
  return riskyDoubleEdge(context, skill)
    ? peekRiskyOutcome(context)
    : "success";
}

function consumeDoubleEdgeOutcome(
  context: ThiefCastContext,
  skill: ThiefSkill,
): ThiefDoubleEdgeOutcome {
  if (!riskyDoubleEdge(context, skill)) return "success";
  const state = antiquaryState.from(context);
  if (state.scoundrelsLuck > 0) {
    state.scoundrelsLuck -= 1;
    return "success";
  }
  const outcome = peekRiskyOutcome(context);
  state.doubleEdgeOutcomeIndex = Number(state.doubleEdgeOutcomeIndex || 0) + 1;
  return outcome;
}

function emitCannonBackfire(context: ThiefCastContext, at: number): void {
  context.emit({
    type: "damage",
    at: at + 2,
    source: "thief",
    sourceId: ID.STONE_SUMMIT_CANNON,
    actorType: "player",
    skillId: ID.STONE_SUMMIT_CANNON,
    skillName: "Stone Summit Cannon",
    name: "Stone Summit Cannon — Backfire",
    coefficient: 3,
    hits: 1,
  });
  context.emit({
    type: "condition",
    at: at + 2,
    source: "thief",
    sourceId: ID.STONE_SUMMIT_CANNON,
    actorType: "player",
    skillId: ID.STONE_SUMMIT_CANNON,
    skillName: "Stone Summit Cannon",
    name: "Stone Summit Cannon — Backfire",
    condition: "Burning",
    stacks: 3,
    duration: 4,
  });
}

function emitCannonSuccess(context: ThiefCastContext): void {
  for (let hitIndex = 1; hitIndex <= 3; hitIndex += 1) {
    const at = context.effectiveEnd + 0.44 + (hitIndex - 1) * 0.283;
    context.emit({
      type: "damage",
      at,
      source: "thief",
      sourceId: ID.STONE_SUMMIT_CANNON,
      actorType: "player",
      skillId: ID.STONE_SUMMIT_CANNON,
      skillName: "Stone Summit Cannon",
      name: "Stone Summit Cannon",
      coefficient: 1,
      hits: 1,
      hitIndex,
      totalHits: 3,
    });
    context.emit({
      type: "condition",
      at,
      source: "thief",
      sourceId: ID.STONE_SUMMIT_CANNON,
      actorType: "player",
      skillId: ID.STONE_SUMMIT_CANNON,
      skillName: "Stone Summit Cannon",
      name: "Stone Summit Cannon — Burning",
      condition: "Burning",
      stacks: 1,
      duration: 3,
    });
  }
}

function tossCanachCoins(
  context: ThiefCastContext,
  at: number,
  backfire: boolean,
): void {
  const state = antiquaryState.from(context);
  let initiative = 0;
  for (let coin = 0; coin < 3; coin += 1) {
    const heads = Number(state.canachCoinIndex || 0) % 2 === 0;
    state.canachCoinIndex = Number(state.canachCoinIndex || 0) + 1;
    if (backfire) {
      if (heads) initiative += 1;
    } else {
      initiative += heads ? 2 : 1;
    }
  }
  gainThiefInitiative(
    context,
    initiative,
    at,
    backfire ? "canach-coin-backfire" : "canach-coin-toss",
  );
}

export function resolveDoubleEdge(
  context: ThiefCastContext,
  skill: ThiefSkill,
): ThiefDoubleEdgeOutcome {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  const outcome = consumeDoubleEdgeOutcome(context, skill);
  if (outcome === "backfire") {
    state.backfireState[skill.id] = {
      activeUntil: Number(context.state.cooldowns.get(skill.id) || at),
      skillName: skill.name,
    };
    if (skill.id === ID.STONE_SUMMIT_CANNON) {
      emitCannonBackfire(context, at);
    }
  } else {
    delete state.backfireState[skill.id];
    if (skill.id === ID.STONE_SUMMIT_CANNON) {
      emitCannonSuccess(context);
    }
  }
  if (skill.id === ID.CANACH_COIN_TOSS_ID_77230) {
    tossCanachCoins(context, at, outcome === "backfire");
  }
  emitThiefState(context, at, `double-edge-${outcome}`);
  return outcome;
}

export function completeSkrittScuffle(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = antiquaryState.from(context);
  const at = context.effectiveEnd;
  const summon = {
    skillId: skill.id,
    name: "Skritt Assistant",
    expiresAt: at + SCUFFLE_DURATION,
  };
  state.activeAntiquarySummons.push(summon);
  state.nextSkrittScufflePilferAt = at + SCUFFLE_INTERVAL;
  pilferArtifacts(context, at, "skritt-scuffle-artifact", "scuffle");
  context.tasks.schedule({
    type: "thief.skritt-scuffle",
    at: at + SCUFFLE_INTERVAL,
    ownerId: `thief.skritt-scuffle:${skill.id}:${at}`,
    payload: { expiresAt: summon.expiresAt },
  });
  emitThiefState(context, at, "skritt-scuffle");
}

export function handleSkrittScuffle(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<SkrittScuffleTaskPayload>,
): void {
  if (
    task.at >
    Number(task.payload.expiresAt || 0) + Number(context.epsilon || 0.0001)
  )
    return;
  const nextPilferAt = task.at + SCUFFLE_INTERVAL;
  antiquaryState.from(context).nextSkrittScufflePilferAt =
    nextPilferAt <= Number(task.payload.expiresAt || 0) ? nextPilferAt : 0;
  pilferArtifacts(context, task.at, "skritt-scuffle-artifact", "scuffle");
  if (task.at + SCUFFLE_INTERVAL <= Number(task.payload.expiresAt || 0)) {
    context.tasks.schedule({
      ...task,
      at: task.at + SCUFFLE_INTERVAL,
    });
  }
}
