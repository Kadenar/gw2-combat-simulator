import { replaceSkill } from "../../../../platform/gw2/native-profession.js";
import {
  GUARDIAN_SKILL_IDS as ID,
  GUARDIAN_TRAIT_IDS,
} from "../../data/ids.js";
import { buildGuardianStrike, emitGuardianEvent } from "../../core/events.js";
import { hasGuardianTrait } from "../../core/traits.js";
import { guardianVirtueSkillHandlers } from "../../core/virtues.js";
import type {
  GuardianCastContext,
  GuardianSkill,
  GuardianVirtue,
} from "../../types.js";
import { gainLethalTempo } from "./mechanics.js";
import { willbenderState } from "./state.js";

const FLAME_ID_BY_VIRTUE: Readonly<Record<GuardianVirtue, number>> =
  Object.freeze({
    justice: ID.WILLBENDER_FLAMES_ID_62618,
    resolve: ID.WILLBENDER_FLAMES,
    courage: ID.WILLBENDER_FLAMES_COURAGE,
  });

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  const slot = Number(String(skill.slot || "").match(/(\d)$/)?.[1] || 0);
  return ([null, "justice", "resolve", "courage"] as const)[slot] || null;
}

function emitRushingJusticeImpact(
  context: GuardianCastContext,
  skill: GuardianSkill,
  at: number,
): void {
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: ID.RUSHING_JUSTICE_IMPACT,
      skillId: ID.RUSHING_JUSTICE_IMPACT,
      skillName: skill.name,
      name: `${skill.name} — Impact Damage`,
      coefficient: 1.5,
      skillWeapon: "Profession Mechanic",
    }),
  );
  context.emit({
    type: "condition",
    at,
    source: "guardian",
    sourceId: ID.RUSHING_JUSTICE_IMPACT,
    actorType: "player",
    skillId: ID.RUSHING_JUSTICE_IMPACT,
    skillName: skill.name,
    name: `${skill.name} — Initial Burning`,
    condition: "Burning",
    stacks: 1,
    duration: 4,
  });
}

function emitCrashingCourageImpact(
  context: GuardianCastContext,
  skill: GuardianSkill,
  at: number,
): void {
  context.emit(
    buildGuardianStrike({
      at,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} — Initial Damage`,
      coefficient: 1,
      skillWeapon: "Profession Mechanic",
    }),
  );
  for (const [kind, duration] of [
    ["aegis", 4],
    ["stability", 4],
  ] as const) {
    context.emit({
      type: "buff",
      at,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      kind,
      stacks: 1,
      duration,
    });
  }
}

function activateWillbenderVirtue(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  guardianVirtueSkillHandlers["guardian.virtue"](context, skill);
  const virtue = virtueFor(skill);
  if (!virtue) return;

  const at =
    virtue === "justice"
      ? Math.min(context.effectiveEnd, context.start + 0.04)
      : virtue === "courage"
        ? Math.min(context.effectiveEnd, context.start + 0.52)
        : context.effectiveEnd;
  const flameAt =
    virtue === "justice" ? Math.max(at, context.effectiveEnd - 0.04) : at;
  const state = willbenderState.from(context);
  const tyrantsMomentum = hasGuardianTrait(
    context,
    GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM,
  );
  if (state[`${virtue}Until`] <= at + context.epsilon) {
    state.virtueHitCounts[virtue] = 0;
  }
  const duration = virtue === "justice" ? (tyrantsMomentum ? 10 : 8) : 6;
  state[`${virtue}Until`] = at + duration;
  gainLethalTempo(state, at, tyrantsMomentum);

  emitGuardianEvent(context, skill, "guardian.willbender-virtue-activated", {
    at,
    virtue,
    duration,
  });
  context.emit({
    type: "buff",
    at,
    source: "guardian",
    sourceId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    actorType: "player",
    skillId: GUARDIAN_TRAIT_IDS.LETHAL_TEMPO,
    skillName: "Lethal Tempo",
    name: "Lethal Tempo",
    kind: "lethal-tempo",
    stacks: state.lethalTempoStacks,
    duration: state.lethalTempoUntil - at,
  });

  const flameId = FLAME_ID_BY_VIRTUE[virtue];
  context.tasks.schedule({
    id: `guardian.willbender-flame-activate:${context.reservationId}`,
    type: "guardian.willbender-flame-activate",
    at: flameAt,
    priority: -10,
    payload: { flameId, virtue },
  });

  if (virtue === "justice") emitRushingJusticeImpact(context, skill, flameAt);
  if (virtue === "courage") emitCrashingCourageImpact(context, skill, flameAt);
  if (
    virtue === "resolve" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES)
  ) {
    context.emit({
      type: "buff",
      at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
      actorType: "player",
      skillId: GUARDIAN_TRAIT_IDS.RESTORATIVE_VIRTUES,
      skillName: "Restorative Virtues",
      name: "Restorative Virtues — Vigor",
      kind: "vigor",
      stacks: 1,
      duration: 3,
    });
  }
  if (
    virtue === "resolve" &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL)
  ) {
    context.emit({
      type: "buff",
      at,
      source: "guardian",
      sourceId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
      actorType: "player",
      skillId: GUARDIAN_TRAIT_IDS.PHOENIX_PROTOCOL,
      skillName: "Phoenix Protocol",
      name: "Phoenix Protocol — Allied Alacrity",
      kind: "alacrity",
      stacks: 1,
      duration: 5,
      recipients: "allies",
      affectsSelf: false,
    });
  }
}

export const willbenderSkillHandlers = Object.freeze({
  "guardian.willbender-virtue": replaceSkill({
    beforeEffects: activateWillbenderVirtue,
  }),
});
