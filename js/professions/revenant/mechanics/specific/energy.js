/**
 * Revenant Energy and endurance lifecycle.
 *
 * The scheduler calls advanceRevenantEnergy whenever its clock advances and
 * spendRevenantEnergy at cast start. This module applies passive regeneration,
 * aggregate upkeep drain, exact starvation timing, out-of-combat Energy
 * capping, endurance regeneration, and Conduit affinity from paid costs.
 */
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  hasRevenantTrait,
  revenantConduitFormIsActive,
} from "../../state.js";
import { gainConduitAffinity } from "./conduit.js";
import { emitRevenantState } from "./shared.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";

function syncRevenantCombatState(context, state) {
  const sharedAt = context.schedulerPolicy.combatBeganAt?.();
  if (sharedAt == null) return;
  const at = Number(sharedAt);
  if (Number.isFinite(at)) state.combatBeganAt = at;
}

function regenerateRevenantEnergy(context, state, from, target, rate) {
  const combatActive =
    context.schedulerPolicy.isCombatActive?.() ?? state.combatBeganAt != null;
  const maximum = combatActive
    ? state.maximumEnergy
    : Math.max(50, state.energy);
  // Out-of-combat regeneration stops at 50 without removing energy that was
  // already above 50.
  return Math.min(maximum, state.energy + (target - from) * rate);
}

/**
 * Advances Energy, endurance, upkeep drain, starvation, and timed Conduit
 * state to the scheduler's target timestamp.
 */
export function advanceRevenantEnergy(context, target) {
  const state = context.state.profession;
  syncRevenantCombatState(context, state);
  const from = Number(state.energyUpdatedAt || 0);
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance +
        (target - enduranceFrom) * MECHANICS.endurance.regenerationPerSecond,
    );
    state.enduranceUpdatedAt = target;
  }
  if (state.cosmicWisdomUntil > 0 && target >= state.cosmicWisdomUntil) {
    state.cosmicWisdomUntil = 0;
    state.conduitForm = "";
  }
  if (target <= from) return;
  const upkeep = state.activeUpkeeps.reduce(
    (sum, active) => sum + Number(active.upkeepCost || 0),
    0,
  );
  const rate = MECHANICS.energy.regenerationPerSecond - upkeep;
  const elapsed = target - from;
  if (rate < 0 && state.energy + rate * elapsed < 0) {
    const starvedAt = from + state.energy / -rate;
    state.energy = 0;
    for (const active of state.activeUpkeeps) {
      const skill = context.catalog.skillsById.get(active.skillId);
      const cooldown = Math.max(0, Number(skill?.starvationCooldown || 0));
      if (cooldown > 0) {
        context.state.cooldowns.set(active.skillId, starvedAt + cooldown);
      }
      context.tasks.cancelOwner(`revenant.upkeep:${active.skillId}`);
    }
    state.activeUpkeeps = [];
    state.availableFlips = {};
    state.energyUpdatedAt = starvedAt;
    emitRevenantState(context, starvedAt, "upkeep-starved");
    state.energy = regenerateRevenantEnergy(
      context,
      state,
      starvedAt,
      target,
      MECHANICS.energy.regenerationPerSecond,
    );
    state.energyUpdatedAt = target;
    emitRevenantState(context, target, "energy");
    return;
  }
  state.energy =
    rate > 0
      ? regenerateRevenantEnergy(context, state, from, target, rate)
      : Math.max(
          0,
          Math.min(state.maximumEnergy, state.energy + elapsed * rate),
        );
  state.energyUpdatedAt = target;
  emitRevenantState(context, target, "energy");
}

/** Resolves state-dependent Energy overrides shared by UI and scheduling. */
export function effectiveRevenantEnergyCost(context, skill) {
  const state =
    context.state?.profession || context.professionState || context.state || {};
  const active = (state.activeUpkeeps || []).some(
    upkeep => upkeep.skillId === skill.id,
  );
  if (active) return 0;
  if (
    skill.handlerId === "revenant.beguiling-haze" &&
    Number(state.beguilingHazeCharges || 0) > 0
  ) return 0;
  const at =
    context.start ?? context.time ?? context.state?.time ?? 0;
  if (revenantConduitFormIsActive(state, "Mesmer", at)) {
    const profile = MECHANICS.conduit.formOfTheMesmer;
    if (
      [ID.BANISH_ENCHANTMENT, ID.BANISH_ENCHANTMENT_ID_78587]
        .includes(skill.id)
    ) return profile.banishEnchantmentEnergyCost;
    if (skill.id === ID.CALL_TO_ANGUISH) {
      return profile.callToAnguishEnergyCost;
    }
    if (skill.id === ID.UNYIELDING_IMPACT) {
      return profile.unyieldingImpactEnergyCost;
    }
    if (skill.id === ID.EMBRACE_THE_DARKNESS) {
      return profile.embraceTheDarknessEnergyCost;
    }
  }
  return Math.max(0, Number(skill.energyCost || 0));
}

/** Pays a cast's Energy cost and applies affinity gained from that payment. */
export function spendRevenantEnergy(context, skill) {
  if ([ID.SWAP_LEGENDS, ID.DODGE].includes(skill.id)) return;
  const state = context.state.profession;
  const cost = effectiveRevenantEnergyCost(context, skill);
  state.energy = Math.max(0, state.energy - cost);
  if (context.config.specialization === "Conduit" && cost > 0) {
    if (skill.legendId && !skill.affinityOnHit) {
      gainConduitAffinity(
        context,
        cost >= MECHANICS.energy.highCostThreshold
          ? MECHANICS.energy.highCostAffinity
          : MECHANICS.energy.standardAffinity,
        "enigmatic-connection",
      );
    } else if (
      skill.type === "Weapon" &&
      hasRevenantTrait(context.config, TRAIT.CONDUCTIVE_ARMAMENTS)
    ) {
      gainConduitAffinity(
        context,
        MECHANICS.energy.standardAffinity,
        "conductive-armaments",
      );
    }
  }
  if (cost > 0) {
    emitRevenantState(context, context.start, "energy-spent");
  }
}
