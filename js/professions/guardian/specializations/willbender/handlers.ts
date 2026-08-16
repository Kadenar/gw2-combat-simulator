import { replaceSkill } from "../../../../platform/gw2/native-profession.js";
import { GUARDIAN_SKILL_IDS as ID } from "../../data/ids.js";
import { buildGuardianStrike, emitGuardianEvent } from "../../core/events.js";
import { guardianVirtueSkillHandlers } from "../../core/virtues.js";
import type {
  GuardianCastContext,
  GuardianSkill,
  GuardianVirtue,
} from "../../types.js";
import { applyWillbenderVirtueActivationTraits } from "./rules.js";
import { willbenderState } from "./state.js";

const FLAME_ID_BY_VIRTUE: Readonly<Record<GuardianVirtue, number>> =
  Object.freeze({
    justice: ID.WILLBENDER_FLAMES_ID_62618,
    resolve: ID.WILLBENDER_FLAMES,
    courage: ID.WILLBENDER_FLAMES_COURAGE,
  });

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  // Slot strings are "Profession_1/2/3"; the trailing digit maps directly to virtue order.
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
  // Run the core virtue handler first (cooldown tracking, passive arming) before
  // willbender-specific overrides; order matters because core sets virtueReadyAt.
  guardianVirtueSkillHandlers["guardian.virtue"](context, skill);
  const virtue = virtueFor(skill);
  if (!virtue) return;

  // Justice impact fires near the start of the cast (~40 ms); Courage impact fires
  // after the lunge animation (~520 ms). Resolve has no early-hit, so it uses effectiveEnd.
  // Min-clamping ensures these don't overshoot when the cast is interrupted.
  const at =
    virtue === "justice"
      ? Math.min(context.effectiveEnd, context.start + 0.04)
      : virtue === "courage"
        ? Math.min(context.effectiveEnd, context.start + 0.52)
        : context.effectiveEnd;
  // For justice the flame spawns at the very end of the skill window, not at impact time,
  // so the pulsing DoT doesn't begin until the physical lunge finishes.
  const flameAt =
    virtue === "justice" ? Math.max(at, context.effectiveEnd - 0.04) : at;
  const state = willbenderState.from(context);
  // virtueUntil may still hold the previous window; reset hit counts only when that
  // window has actually expired so a rapid re-activation doesn't wipe an in-progress tally.
  if (state[`${virtue}Until`] <= at + context.epsilon) {
    state.virtueHitCounts[virtue] = 0;
  }
  const duration = applyWillbenderVirtueActivationTraits(context, virtue, at);

  emitGuardianEvent(context, skill, "guardian.willbender-virtue-activated", {
    at,
    virtue,
    duration,
  });
  const flameId = FLAME_ID_BY_VIRTUE[virtue];
  context.tasks.schedule({
    id: `guardian.willbender-flame-activate:${context.reservationId}`,
    type: "guardian.willbender-flame-activate",
    at: flameAt,
    priority: -10, // run after same-timestamp strike/condition events so flame window opens last
    payload: { flameId, virtue },
  });

  if (virtue === "justice") emitRushingJusticeImpact(context, skill, flameAt);
  if (virtue === "courage") emitCrashingCourageImpact(context, skill, flameAt);
}

export const willbenderSkillHandlers = Object.freeze({
  "guardian.willbender-virtue": replaceSkill({
    beforeEffects: activateWillbenderVirtue,
  }),
});
