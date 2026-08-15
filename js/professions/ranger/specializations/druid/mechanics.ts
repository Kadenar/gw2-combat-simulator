import { professionCoreState } from "../../../../platform/engine/profession.js";
import type { SimulationEvent } from "../../../../platform/engine/types.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { applyRangerWeaponSwapTraits } from "../../core/traits.js";
import type {
  RangerCastContext,
  RangerSchedulerContext,
  RangerSkill,
} from "../../types.js";
import { druidState } from "./state.js";

const CELESTIAL_AVATAR_DURATION = 15;
const NATURAL_MENDER_INTERVAL = 3;
const NATURAL_MENDER_FORCE = 8;
const DIRECT_DAMAGE_FORCE = 0.75;
export const DRUID_ASTRAL_FORCE_DAMAGE_TASK =
  "ranger.druid-astral-force-damage";

function hasDruidTrait(
  context: RangerCastContext | RangerSchedulerContext,
  traitId: number,
): boolean {
  return Boolean(
    context.config.selectedTraitIds?.some(
      (selected) =>
        selected === traitId || String(selected) === String(traitId),
    ),
  );
}

function applyNaturalBalance(
  context: RangerCastContext | RangerSchedulerContext,
  duration: number,
  at: number,
): void {
  if (!hasDruidTrait(context, TRAIT.NATURAL_BALANCE)) return;
  context.emit({
    type: "buff",
    at,
    source: "Trait",
    sourceId: TRAIT.NATURAL_BALANCE,
    actorType: "effect",
    skillId: TRAIT.NATURAL_BALANCE,
    skillName: "Natural Balance",
    name: "Natural Balance",
    kind: "natural-balance",
    duration,
    stacks: 1,
  });
}

function emitAvatarWeaponSwap(
  context: RangerCastContext | RangerSchedulerContext,
  skill: RangerSkill,
  at: number,
): void {
  professionCoreState(context).autoattackChains = {};
  context.emit({
    type: "sigil_swap",
    at,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
  });
  applyRangerWeaponSwapTraits(context, skill, at);
}

export function enterAvatar(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = druidState.from(context);
  state.celestialAvatarActive = true;
  state.celestialAvatarEndsAt = context.start + CELESTIAL_AVATAR_DURATION;
  state.astralForceUpdatedAt = context.start;
  professionCoreState(context).availableFlips[ID.RELEASE_CELESTIAL_AVATAR] =
    state.celestialAvatarEndsAt;
  applyNaturalBalance(context, 10, context.start);
  emitAvatarWeaponSwap(context, skill, context.effectiveEnd);
}

export function leaveAvatar(
  context: RangerCastContext | RangerSchedulerContext,
  exhausted = false,
  at = context.state.time,
  transitionSkill?: RangerSkill,
): void {
  const state = druidState.from(context);
  state.astralForce = exhausted ? 0 : state.astralForce * 0.5;
  state.celestialAvatarActive = false;
  state.celestialAvatarEndsAt = 0;
  state.astralForceUpdatedAt = at;
  delete professionCoreState(context).availableFlips[
    ID.RELEASE_CELESTIAL_AVATAR
  ];
  applyNaturalBalance(context, 10, at);
  const skill =
    transitionSkill ||
    (context.catalog.skillsById.get(ID.RELEASE_CELESTIAL_AVATAR) as
      RangerSkill | undefined);
  if (skill) emitAvatarWeaponSwap(context, skill, at);
}

export function advanceDruidState(
  context: RangerSchedulerContext,
  target: number,
): void {
  const state = druidState.from(context);
  if (state.celestialAvatarActive) {
    const elapsed = Math.max(0, target - state.astralForceUpdatedAt);
    state.astralForce = Math.max(
      0,
      state.astralForce -
        elapsed * (state.maximumAstralForce / CELESTIAL_AVATAR_DURATION),
    );
    state.astralForceUpdatedAt = target;
    if (target >= state.naturalMenderReadyAt - context.epsilon) {
      const skippedApplications =
        Math.floor(
          (target - state.naturalMenderReadyAt + context.epsilon) /
            NATURAL_MENDER_INTERVAL,
        ) + 1;
      state.naturalMenderReadyAt +=
        skippedApplications * NATURAL_MENDER_INTERVAL;
    }
    if (
      target >= state.celestialAvatarEndsAt - context.epsilon ||
      state.astralForce <= context.epsilon
    ) {
      leaveAvatar(context, true, target);
    }
    return;
  }

  state.astralForceUpdatedAt = target;
  if (
    !hasDruidTrait(context, TRAIT.NATURAL_MENDER) ||
    state.astralForce >= state.maximumAstralForce ||
    target < state.naturalMenderReadyAt - context.epsilon
  ) {
    return;
  }
  const applications =
    Math.floor(
      (target - state.naturalMenderReadyAt + context.epsilon) /
        NATURAL_MENDER_INTERVAL,
    ) + 1;
  state.astralForce = Math.min(
    state.maximumAstralForce,
    state.astralForce + applications * NATURAL_MENDER_FORCE,
  );
  state.naturalMenderReadyAt += applications * NATURAL_MENDER_INTERVAL;
}

export function astralForceReadyAt(context: RangerCastContext): number | null {
  const state = druidState.from(context);
  const maximum = state.maximumAstralForce;
  const naturalMender = hasDruidTrait(context, TRAIT.NATURAL_MENDER);
  if (state.astralForce >= maximum - context.epsilon) return context.start;
  if (!naturalMender) return null;
  const applications = Math.ceil(
    (maximum - state.astralForce) / NATURAL_MENDER_FORCE,
  );
  return (
    Math.max(context.start, state.naturalMenderReadyAt) +
    (applications - 1) * NATURAL_MENDER_INTERVAL
  );
}

export function observeDruidAstralForceEvent(
  context: RangerSchedulerContext,
  event: SimulationEvent,
): void {
  if (
    event.type !== "damage" ||
    event.actorType === "summon" ||
    event.ownerActorType === "summon" ||
    event.source === "ranger-pet" ||
    event.independentSummonStrike === true
  ) {
    return;
  }
  context.tasks.schedule({
    type: DRUID_ASTRAL_FORCE_DAMAGE_TASK,
    at: event.at,
    priority: 20,
    ownerId: "ranger.druid-astral-force",
  });
}

export function handleDruidAstralForceDamageTask(
  context: RangerSchedulerContext,
): void {
  const state = druidState.from(context);
  if (state.celestialAvatarActive) return;
  state.astralForce = Math.min(
    state.maximumAstralForce,
    state.astralForce +
      DIRECT_DAMAGE_FORCE * (hasDruidTrait(context, TRAIT.ECLIPSE) ? 2 : 1),
  );
}
