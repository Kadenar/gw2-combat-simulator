import type { Skill, SkillEffect } from "../../../platform/engine/types.js";
import { EVTC_STATE_CHANGE } from "../../types.js";
import { findRotationSkill } from "../catalog.js";
import type {
  EvtcProfessionReconstructionContext,
  EvtcRecordedRotationAction,
} from "./types.js";

/** Warrior-only EVTC precast recovery and animation packet normalization. */

const HEALING_SIGNET = Object.freeze({
  name: "Healing Signet",
  skillId: 14389,
});
const SIGNET_OF_RAGE = Object.freeze({
  name: "Signet of Rage",
  skillId: 14355,
});
const SIGNET_OF_MIGHT = Object.freeze({
  name: "Signet of Might",
  skillId: 14404,
});
const SIGNET_OF_FURY = Object.freeze({
  name: "Signet of Fury",
  skillId: 14410,
});
const KICK = Object.freeze({ name: "Kick", skillId: 14502 });
const BULLS_CHARGE = Object.freeze({ name: "Bull's Charge", skillId: 14516 });
const WINDS_OF_DISENCHANTMENT = Object.freeze({
  name: "Winds of Disenchantment",
  skillId: 45333,
});
const CHANT_OF_ACTION = Object.freeze({
  name: "Chant of Action",
  skillId: 77342,
});
const BREACHING_STRIKE_IDS = new Set([45252, 69297, 69433]);

const RESISTANCE_BUFF = 26980;
const SWIFTNESS_BUFF = 719;
const SIGNET_OF_MIGHT_ACTIVE_BUFF = 36781;
const SIGNET_OF_FURY_ACTIVE_BUFF = 51664;
const PEAK_PERFORMANCE_BUFF = 46853;
const CHANT_OF_ACTION_BUFF = 76865;
const REND_FOLLOW_UP_ANIMATION = 80224;
const INITIAL_SIGNAL_WINDOW_MS = 1000;

interface WarriorActionIdentity {
  readonly name: string;
  readonly skillId: number;
}

function playerInitialBuff(
  context: EvtcProfessionReconstructionContext,
  buffSkillId: number,
): boolean {
  return context.log.events.some(
    (event) =>
      event.source === context.playerAddress &&
      event.target === context.playerAddress &&
      event.skillId === buffSkillId &&
      event.buff !== 0 &&
      event.stateChange === EVTC_STATE_CHANGE.BUFF_INITIAL,
  );
}

function combatStart(
  context: EvtcProfessionReconstructionContext,
): number | null {
  return (
    context.log.events.find(
      (event) =>
        event.source === context.playerAddress &&
        event.stateChange === EVTC_STATE_CHANGE.ENTER_COMBAT,
    )?.time ?? null
  );
}

function skillFor(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
): Skill | null {
  return findRotationSkill(
    identity.skillId,
    identity.name,
    context.catalog,
    context.profile,
  );
}

function recordedDuration(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
): number {
  const skill = skillFor(context, identity);
  return Math.max(
    0,
    Number(skill?.quicknessCastTimeMs || skill?.castTimeMs || 0),
  );
}

function initialAction(
  context: EvtcProfessionReconstructionContext,
  identity: WarriorActionIdentity,
  start: number,
  eventIndex: number,
): EvtcRecordedRotationAction {
  const duration = recordedDuration(context, identity);
  return {
    start,
    end: start + duration,
    expectedDuration: duration,
    rawSkillId: identity.skillId,
    rawName: identity.name,
    canonicalSkillId: identity.skillId,
    canonicalName: identity.name,
    evidence: "initial-state",
    status: "completed",
    eventIndex,
    precast: true,
  };
}

function sequentialInitialActions(
  context: EvtcProfessionReconstructionContext,
  identities: readonly WarriorActionIdentity[],
  end: number,
  eventIndexBase: number,
): EvtcRecordedRotationAction[] {
  let cursor = end;
  const reversed: EvtcRecordedRotationAction[] = [];
  for (let index = identities.length - 1; index >= 0; index -= 1) {
    const identity = identities[index];
    cursor -= recordedDuration(context, identity);
    reversed.push(
      initialAction(context, identity, cursor, eventIndexBase + index),
    );
  }
  return reversed.reverse();
}

function firstEffectOffset(effect: SkillEffect): number | null {
  const offsets = [
    Number(effect.atMs),
    ...(effect.type === "strike"
      ? (effect.ticks || []).map((tick) => Number(tick.atMs))
      : []),
  ].filter(Number.isFinite);
  return offsets.length ? Math.min(...offsets) : null;
}

function firstStrikeCommitMs(skill: Skill): number | null {
  const castTime = Math.max(0, Number(skill.castTimeMs || 0));
  const runtimeCastTime = Math.max(
    0,
    Number(
      skill.dualWieldCastTimeMs ||
        skill.quicknessCastTimeMs ||
        skill.castTimeMs ||
        0,
    ),
  );
  const offsets = (skill.effects || []).flatMap((effect) => {
    if (effect.type !== "strike") return [];
    const offset = firstEffectOffset(effect);
    if (offset == null) return [runtimeCastTime];
    if (effect.timingScale === "cast" && castTime > 0) {
      return [(offset * runtimeCastTime) / castTime];
    }
    return [offset];
  });
  return offsets.length ? Math.min(...offsets) : null;
}

function normalizeRecordedActions(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const actions = [...context.recordedActions].sort(
    (left, right) =>
      left.start - right.start || left.eventIndex - right.eventIndex,
  );
  const normalized: EvtcRecordedRotationAction[] = [];
  const absorbAnimation = (action: EvtcRecordedRotationAction): void => {
    let previousIndex = normalized.length - 1;
    while (
      previousIndex >= 0 &&
      normalized[previousIndex].end <= normalized[previousIndex].start
    ) {
      previousIndex -= 1;
    }
    if (previousIndex < 0) return;
    const previous = normalized[previousIndex];
    normalized[previousIndex] = {
      ...previous,
      end: Math.max(previous.end, action.end),
    };
  };

  for (const action of actions) {
    // Rend emits separate animations for the command and its built-in follow-up
    // packet. The simulator's single Rend action already owns both strikes.
    if (action.rawSkillId === REND_FOLLOW_UP_ANIMATION) {
      absorbAnimation(action);
      continue;
    }

    const skill = findRotationSkill(
      action.canonicalSkillId ?? action.rawSkillId,
      action.canonicalName ?? action.rawName,
      context.catalog,
      context.profile,
    );
    const autoattack = String(skill?.slot || "").toLowerCase() === "weapon_1";
    const commitMs = skill ? firstStrikeCommitMs(skill) : null;
    const duration = Math.max(0, action.end - action.start);
    if (autoattack && commitMs != null && duration < commitMs) {
      absorbAnimation(action);
      continue;
    }

    // Arc can label a weapon animation as cancelled even after its strike
    // packet committed. Replay the completed simulator action in that case;
    // retaining an interrupt would understate damage and emit a false warning.
    if (
      action.status === "interrupted" &&
      commitMs != null &&
      duration >= commitMs
    ) {
      normalized.push({ ...action, status: "completed" as const });
      continue;
    }
    normalized.push(action);
  }
  return normalized;
}

function spellbreakerPrecasts(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  if (atCombat == null) return [];
  const unmatchedBreachingStop = context.log.events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .find(
      ({ event }) =>
        event.source === context.playerAddress &&
        BREACHING_STRIKE_IDS.has(event.skillId) &&
        event.stateChange === EVTC_STATE_CHANGE.ANIMATION_STOP &&
        event.value > 0 &&
        event.time - event.value < atCombat &&
        !context.recordedActions.some(
          (action) =>
            BREACHING_STRIKE_IDS.has(action.rawSkillId) &&
            Math.abs(action.end - event.time) <= 50,
        ),
    );
  if (!unmatchedBreachingStop) return [];

  const breachingIdentity = {
    name: "Breaching Strike",
    skillId: unmatchedBreachingStop.event.skillId,
  };
  const breachingStart =
    unmatchedBreachingStop.event.time - unmatchedBreachingStop.event.value;
  const breaching: EvtcRecordedRotationAction = {
    ...initialAction(
      context,
      breachingIdentity,
      breachingStart,
      unmatchedBreachingStop.eventIndex,
    ),
    end: unmatchedBreachingStop.event.time,
    expectedDuration: Math.max(
      unmatchedBreachingStop.event.value,
      unmatchedBreachingStop.event.buffDamage,
    ),
    evidence: "animation",
  };

  const firstWindsPulse = context.log.events.find(
    (event) =>
      event.source === context.playerAddress &&
      event.skillId === WINDS_OF_DISENCHANTMENT.skillId &&
      event.buff === 0 &&
      event.stateChange === EVTC_STATE_CHANGE.NONE &&
      event.time <= atCombat + INITIAL_SIGNAL_WINDOW_MS,
  );
  const identities: WarriorActionIdentity[] = [];
  if (playerInitialBuff(context, RESISTANCE_BUFF))
    identities.push(HEALING_SIGNET);
  if (playerInitialBuff(context, SIGNET_OF_MIGHT_ACTIVE_BUFF)) {
    identities.push(SIGNET_OF_MIGHT);
  }
  if (playerInitialBuff(context, PEAK_PERFORMANCE_BUFF)) identities.push(KICK);
  if (playerInitialBuff(context, SIGNET_OF_FURY_ACTIVE_BUFF)) {
    identities.push(SIGNET_OF_FURY);
  }
  if (firstWindsPulse) identities.push(WINDS_OF_DISENCHANTMENT);
  return [
    ...sequentialInitialActions(context, identities, breachingStart, -2000),
    breaching,
  ];
}

function paragonPrecasts(
  context: EvtcProfessionReconstructionContext,
): EvtcRecordedRotationAction[] {
  const atCombat = combatStart(context);
  if (atCombat == null || !playerInitialBuff(context, PEAK_PERFORMANCE_BUFF)) {
    return [];
  }
  const bullsDuration = recordedDuration(context, BULLS_CHARGE);
  const bullsStart = atCombat - Math.max(0, bullsDuration - 1);
  const identities: WarriorActionIdentity[] = [];
  if (playerInitialBuff(context, RESISTANCE_BUFF))
    identities.push(HEALING_SIGNET);
  if (playerInitialBuff(context, SWIFTNESS_BUFF))
    identities.push(SIGNET_OF_RAGE);
  if (playerInitialBuff(context, CHANT_OF_ACTION_BUFF))
    identities.push(CHANT_OF_ACTION);
  if (playerInitialBuff(context, SIGNET_OF_FURY_ACTIVE_BUFF)) {
    identities.push(SIGNET_OF_FURY);
  }
  return [
    ...sequentialInitialActions(context, identities, bullsStart, -3000),
    initialAction(context, BULLS_CHARGE, bullsStart, -2990),
  ];
}

export function reconstructWarriorProfessionActions(
  context: EvtcProfessionReconstructionContext,
): readonly EvtcRecordedRotationAction[] {
  const normalized = normalizeRecordedActions(context);
  const additions =
    context.profile.specializationId === "spellbreaker"
      ? spellbreakerPrecasts(context)
      : context.profile.specializationId === "paragon"
        ? paragonPrecasts(context)
        : [];
  return [...additions, ...normalized];
}
