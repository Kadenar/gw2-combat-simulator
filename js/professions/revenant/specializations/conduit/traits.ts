import { conduitState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { emitRevenantBoon } from "../../core/boons.js";
import { revenantCombatActive } from "../../core/legend.js";
import {
  hasRevenantTrait,
  revenantConduitFormIsActive,
} from "../../core/state.js";
import { applyCosmicWisdomAfterCast } from "./conduit.js";
import { CONDUIT_MECHANICS as MECHANICS } from "./mechanics.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../../types.js";

const TWIN_MOON_SKILL_IDS = new Set<SkillId>([
  ID.TWIN_MOON_SWEEP,
  ID.TWIN_MOON_SWEEP_ID_77001,
]);

export function modifyConduitCastDuration(
  context: RevenantPrecastContext,
  duration: number,
): number {
  if (context.skill?.handlerId !== "revenant.beguiling-haze") return duration;
  const quickness = context.hasBuff?.("quickness", context.start);
  return Number(conduitState.from(context).beguilingHazeCharges || 0) > 0
    ? quickness
      ? 0.24
      : 0.25
    : duration + (quickness ? 0.36 : 0.4);
}

export function modifyConduitRechargeDuration(
  context: RevenantRechargeContext,
  duration: number,
): number {
  const skill = context.skill;
  if (duration === 0 && skill?.id === ID.SWAP_LEGENDS) return 0;
  if (
    skill?.id === ID.SWAP_LEGENDS &&
    revenantCombatActive(context, context.at) &&
    hasRevenantTrait(context.config, TRAIT.ENHANCED_EMBODIMENT)
  ) {
    return (
      Math.max(0, Number(skill.cooldown ?? skill.recharge ?? duration)) * 0.6
    );
  }
  if (
    (
      [
        ID.BANISH_ENCHANTMENT,
        ID.BANISH_ENCHANTMENT_ID_78587,
      ] as readonly number[]
    ).includes(Number(skill?.id)) &&
    revenantConduitFormIsActive(
      conduitState.from(context),
      "Mesmer",
      context.start ?? context.at,
    )
  ) {
    const base = MECHANICS.conduit.formOfTheMesmer.banishEnchantmentCooldown;
    const rate = context.hasBuff?.("alacrity", context.at)
      ? Number(context.config.alacrityRechargeRate || 1.25)
      : 1;
    return base / rate;
  }
  return skill?.handlerId === "revenant.release-potential" &&
    hasRevenantTrait(context.config, TRAIT.KINETIC_INSIGHT)
    ? duration * 0.8
    : duration;
}

export function afterConduitTraitCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  applyCosmicWisdomAfterCast(context, skill);
  if (
    skill.legendId === LEGEND.ENTITY &&
    hasRevenantTrait(context.config, TRAIT.SHARED_WISDOM)
  ) {
    emitRevenantBoon(
      context,
      skill,
      "swiftness",
      MECHANICS.conduit.sharedWisdomSwiftness,
    );
  }
}

export function observeConduitTraits(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (event.type === "damage" && event.affinityOnHit === true) {
    const skill =
      event.skillId == null
        ? undefined
        : context.catalog.skillsById.get(event.skillId);
    const cost = Number(skill?.energyCost || 0);
    context.tasks.schedule({
      id: `revenant.affinity-hit:${event.__order}`,
      type: "revenant.affinity-hit",
      at: event.at,
      payload: { amount: cost >= 25 ? 2 : 1 },
    });
  }
  if (
    context.config.relic === "Peitha" &&
    event.type === "damage" &&
    event.skillName === "Beguiling Haze"
  ) {
    context.emitDerived(event, {
      type: "peitha",
      at: event.at + 0.32,
      source: "revenant",
      sourceId: event.skillId ?? event.sourceId,
      actorType: "player",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Relic of Peitha",
    });
  }
  if (
    event.type !== "control" ||
    (event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) ||
    !hasRevenantTrait(context.config, TRAIT.MISTFIRE)
  ) {
    return;
  }
  const state = professionCoreState(context);
  const profile = MECHANICS.traitProcs.mistfire;
  const readyAt = Number(state.traitProcReadyAt.mistfire || 0);
  if (event.at + context.epsilon < readyAt) return;
  state.traitProcReadyAt.mistfire = event.at + profile.interval;
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.MISTFIRE,
    actorType: "effect",
    skillId: TRAIT.MISTFIRE,
    skillName: "Mistfire",
    name: "Mistfire — Burning",
    condition: "Burning",
    stacks: profile.burningStacks,
    duration: profile.burningDuration,
  });
}
