import { professionCoreState } from "../../../../platform/engine/profession.js";
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
const ASTRAL_FORCE_PER_HEAL = 1.5;
const NATURAL_MENDER_INTERVAL = 3;
const NATURAL_MENDER_FORCE = 8;

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

function healingEventsPerSecond(
  context: RangerCastContext | RangerSchedulerContext,
): number {
  const configured =
    context.config.professionAssumptions?.astralForceHealingEventsPerSecond ??
    context.config.assumptions?.astralForceHealingEventsPerSecond;
  return Math.max(0, Number(configured) || 0);
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
  state.naturalMenderReadyAt = state.celestialAvatarEndsAt + 3;
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
  state.naturalMenderReadyAt = at + 3;
  delete professionCoreState(context).availableFlips[
    ID.RELEASE_CELESTIAL_AVATAR
  ];
  applyNaturalBalance(context, 5, at);
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
    if (
      target >= state.celestialAvatarEndsAt - context.epsilon ||
      state.astralForce <= context.epsilon
    ) {
      leaveAvatar(context, true, target);
    }
    return;
  }

  const elapsed = Math.max(0, target - state.astralForceUpdatedAt);
  state.astralForceUpdatedAt = target;
  const healingGeneration =
    elapsed * healingEventsPerSecond(context) * ASTRAL_FORCE_PER_HEAL;
  state.astralForce = Math.min(
    state.maximumAstralForce,
    state.astralForce + healingGeneration,
  );
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
  const rate = healingEventsPerSecond(context) * ASTRAL_FORCE_PER_HEAL;
  const naturalMender = hasDruidTrait(context, TRAIT.NATURAL_MENDER);
  if (state.astralForce >= maximum - context.epsilon) return context.start;
  if (rate <= 0 && !naturalMender) return null;

  let at = context.start;
  let force = state.astralForce;
  let naturalMenderAt = Math.max(at, state.naturalMenderReadyAt);
  while (force < maximum - context.epsilon) {
    const continuousReadyAt =
      rate > 0 ? at + (maximum - force) / rate : Number.POSITIVE_INFINITY;
    if (!naturalMender || continuousReadyAt <= naturalMenderAt) {
      return continuousReadyAt;
    }
    force = Math.min(
      maximum,
      force + (naturalMenderAt - at) * rate + NATURAL_MENDER_FORCE,
    );
    at = naturalMenderAt;
    naturalMenderAt += NATURAL_MENDER_INTERVAL;
  }
  return at;
}

export function generateAstralForce(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  const state = druidState.from(context);
  let applications = (skill.effects || [])
    .filter(
      (effect) =>
        effect.type === "strike" &&
        effect.actorType !== "summon" &&
        effect.source !== "ranger-pet",
    )
    .reduce(
      (total, effect) =>
        total +
        (Array.isArray(effect.ticks)
          ? effect.ticks.length
          : Number(effect.hits || effect.applications || 1)),
      0,
    );
  const eclipse = hasDruidTrait(context, TRAIT.ECLIPSE);
  if (eclipse && skill.celestialAvatarSkill && applications === 0) {
    applications = 1;
  }
  const baseGeneration =
    !state.celestialAvatarActive && !skill.celestialAvatarSkill ? 0.75 : 0;
  const eclipseGeneration = eclipse && skill.celestialAvatarSkill ? 0.75 : 0;
  if (baseGeneration + eclipseGeneration <= 0 || applications <= 0) return;
  state.astralForce = Math.min(
    state.maximumAstralForce,
    state.astralForce + applications * (baseGeneration + eclipseGeneration),
  );
}
