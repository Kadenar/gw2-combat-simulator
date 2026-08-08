import { professionCoreState } from "../../../../platform/engine/profession.js";
import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import { druidState } from "./state.js";
import type {
  RangerCastContext,
  RangerSchedulerContext,
  RangerSkill,
} from "../../types.js";

const CELESTIAL_AVATAR_DURATION = 15;

function enterAvatar(context: RangerCastContext): void {
  const state = druidState.from(context);
  state.celestialAvatarActive = true;
  state.celestialAvatarEndsAt = context.start + CELESTIAL_AVATAR_DURATION;
  professionCoreState(context).availableFlips[ID.RELEASE_CELESTIAL_AVATAR] =
    state.celestialAvatarEndsAt;
}

function leaveAvatar(
  context: RangerCastContext | RangerSchedulerContext,
): void {
  const state = druidState.from(context);
  state.astralForce = 0;
  state.celestialAvatarActive = false;
  state.celestialAvatarEndsAt = 0;
  delete professionCoreState(context).availableFlips[
    ID.RELEASE_CELESTIAL_AVATAR
  ];
}

export const druidSkillHandlers = Object.freeze({
  "ranger.celestial-avatar-enter": {
    mode: "augment" as const,
    afterEffects: enterAvatar,
  },
  "ranger.celestial-avatar-exit": {
    mode: "augment" as const,
    afterEffects: leaveAvatar,
  },
});

export function advanceDruidState(
  context: RangerSchedulerContext,
  target: number,
): void {
  const state = druidState.from(context);
  if (!state.celestialAvatarActive) return;
  const remaining = Math.max(0, state.celestialAvatarEndsAt - target);
  state.astralForce =
    state.maximumAstralForce * (remaining / CELESTIAL_AVATAR_DURATION);
  if (remaining <= context.epsilon) leaveAvatar(context);
}

export function generateAstralForce(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = druidState.from(context);
  if (state.celestialAvatarActive || skill.celestialAvatarSkill) return;
  const applications = (skill.effects || [])
    .filter((effect) => effect.type === "strike" || effect.type === "condition")
    .reduce(
      (total, effect) =>
        total + Number(effect.hits || effect.applications || 1),
      0,
    );
  state.astralForce = Math.min(
    state.maximumAstralForce,
    state.astralForce + applications * 0.75,
  );
}

export const druidSchedulerHooks = Object.freeze({
  advance: {
    id: "ranger.druid-advance",
    order: 20,
    handler: advanceDruidState,
  },
  afterCast: {
    id: "ranger.astral-force",
    order: 20,
    handler: generateAstralForce,
  },
});
