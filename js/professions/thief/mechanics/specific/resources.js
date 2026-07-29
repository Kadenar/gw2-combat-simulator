import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import { pilferArtifacts } from "./artifacts.js";
import {
  emitThiefShroudSwap,
  emitThiefState,
  gainThiefEndurance,
  gainThiefInitiative,
} from "./shared.js";

const SHADOW_FORCE_DRAIN_FRACTION_PER_SECOND = 0.02;
const ENDURANCE_REGENERATION_PER_SECOND = 5;
const VIGOR_ENDURANCE_REGENERATION_MULTIPLIER = 1.5;
const MAXIMUM_ENDURANCE_REGENERATION_PER_SECOND = 10;

export function thiefEnduranceRegenerationRate(
  context,
  at = Number(context.start ?? context.state?.time ?? 0),
) {
  const vigorActive = Boolean(
    context.config?.boons?.vigor ||
    context.hasBuff?.("vigor", at),
  );
  return Math.min(
    MAXIMUM_ENDURANCE_REGENERATION_PER_SECOND,
    ENDURANCE_REGENERATION_PER_SECOND *
      (vigorActive ? VIGOR_ENDURANCE_REGENERATION_MULTIPLIER : 1),
  );
}

export function thiefEnduranceReadyAt(context, cost) {
  const current = Number(context.state.profession.endurance || 0);
  const required = Math.max(0, Number(cost || 0));
  const missing = required - current;
  if (missing <= Number(context.epsilon || 0.0001)) return context.start;
  const rate = thiefEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
}

export function advanceThiefResources(context, target) {
  const state = context.state.profession;
  if (state.leadAttacksUntil > 0 && target >= state.leadAttacksUntil) {
    state.leadAttacksStacks = 0;
    state.leadAttacksUntil = 0;
  }
  state.activeAntiquarySummons = state.activeAntiquarySummons.filter(
    summon => Number(summon.expiresAt || 0) > target,
  );
  if (
    state.activeThievesGuild
    && Number(state.activeThievesGuild.expiresAt || 0) <= target
  ) {
    state.activeThievesGuild = null;
  }
  for (const [skillId, penalty] of Object.entries(state.backfireState)) {
    if (Number(penalty.activeUntil || 0) <= target) {
      delete state.backfireState[skillId];
    }
  }
  for (const [skillId, expiresAt] of Object.entries(state.availableFlips)) {
    if (Number(expiresAt || 0) <= target) delete state.availableFlips[skillId];
  }
  const initiativeFrom = Number(state.initiativeUpdatedAt || 0);
  if (target > initiativeFrom) {
    state.initiative = Math.min(
      state.maximumInitiative,
      state.initiative + (target - initiativeFrom),
    );
    state.initiativeUpdatedAt = target;
  }
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance +
        (target - enduranceFrom) *
          thiefEnduranceRegenerationRate(
            context,
            (enduranceFrom + target) / 2,
          ),
    );
    state.enduranceUpdatedAt = target;
  }
  const shadowFrom = Number(state.shadowForceUpdatedAt || 0);
  if (target > shadowFrom && state.shadowShroudActive) {
    state.shadowForce = Math.max(
      0,
      state.shadowForce
        - (target - shadowFrom)
        * state.maximumShadowForce
        * SHADOW_FORCE_DRAIN_FRACTION_PER_SECOND,
    );
    if (state.shadowForce === 0) {
      state.shadowShroudActive = false;
      emitThiefShroudSwap(context, {
        id: "thief.shadow-shroud-depleted",
        name: "Exit Shadow Shroud",
      }, target);
      emitThiefState(context, target, "shadow-shroud-depleted");
    }
  }
  state.shadowForceUpdatedAt = target;
  emitThiefState(context, target, "resources");
}

export function spendThiefResources(context, skill) {
  const state = context.state.profession;
  const cost = Number(skill.initiativeCost || 0);
  if (cost > 0) {
    state.initiative = Math.max(0, state.initiative - cost);
    if (context.config.specialization === "Specter") {
      state.shadowForce = Math.min(
        state.maximumShadowForce,
        state.shadowForce + cost * 1.5,
      );
    }
    state.initiativeSpentSincePilfer += cost;
    if (hasThiefTrait(context.config, TRAIT.LEAD_ATTACKS)) {
      state.leadAttacksStacks = Math.min(
        15,
        Number(state.leadAttacksStacks || 0) + cost,
      );
      state.leadAttacksUntil = context.start + 15;
    }
    if (
      context.config.specialization === "Daredevil"
      && skill.weapon === "Staff"
      && hasThiefTrait(context.config, TRAIT.STAFF_MASTER)
    ) {
      gainThiefEndurance(context, cost * 2, context.start, "staff-master");
    }
    emitThiefState(context, context.start, "initiative-spent");
    if (
      context.config.specialization === "Antiquary"
      && hasThiefTrait(context.config, TRAIT.PRODIGIOUS_PINCHER)
      && state.initiativeSpentSincePilfer >= 15
    ) {
      pilferArtifacts(context, context.start, "prodigious-pincher");
    }
  }
  if (
    (skill.categories || []).some(category =>
      String(category).toLowerCase().includes("signet"))
    && hasThiefTrait(context.config, TRAIT.SIGNETS_OF_POWER)
  ) {
    gainThiefInitiative(context, 2, context.start, "signets-of-power");
  }
  if (
    (skill.categories || []).some(category =>
      String(category).toLowerCase().includes("physical"))
    && hasThiefTrait(context.config, TRAIT.BRAWLERS_TENACITY)
  ) {
    gainThiefEndurance(context, 10, context.start, "brawlers-tenacity");
  }
}
