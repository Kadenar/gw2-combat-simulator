import { professionCoreState } from "../../../../platform/engine/profession.js";
import { emitRevenantState } from "../../core/shared.js";
import {
  emitCondition,
  emitDamage,
} from "../../core/upkeep.js";
import { REVENANT_SKILL_IDS as ID } from "../../data/ids.js";
import { HERALD_MECHANICS as MECHANICS } from "./mechanics.js";
import type { SkillId } from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSkill,
} from "../../types.js";

/** Emits Elemental Blast's ordered damage/condition pulse sequence. */
export function castElementalBlast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.elementalBlast;
  const firstAt = context.start + profile.firstImpactDelay;
  const pulses = profile.conditions.length;
  for (let pulse = 1; pulse <= pulses; pulse += 1) {
    const at = firstAt + (pulse - 1) * profile.pulseInterval;
    emitDamage(context, skill, at, profile.coefficientPerPulse, {
      name: `Elemental Blast — Pulse ${pulse}`,
      hitIndex: pulse,
      totalHits: pulses,
      extendsResolutionHorizon: pulse === pulses,
    });
    const [condition, stacks, duration] = (
      profile.conditions as readonly (
        readonly [string, number, number]
      )[]
    )[pulse - 1];
    emitCondition(context, skill, at, condition, stacks, duration);
  }
}

/** Removes the active facet and consumes its temporary flip. */
export function consumeRevenantFacet(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const facetByConsume =
    MECHANICS.facetSkillByConsumeId as Readonly<Record<SkillId, SkillId>>;
  const facetId = facetByConsume[skill.id];
  const facet = facetId == null
    ? undefined
    : context.catalog.skillsById.get(facetId);
  state.activeUpkeeps = state.activeUpkeeps.filter(
    (upkeep) => upkeep.skillId !== facet?.id,
  );
  delete state.availableFlips[skill.id];
  if (facet) {
    const cooldown = Math.max(0, Number(context.rechargeDuration || 0));
    if (cooldown > 0) {
      context.state.cooldowns.set(facet.id, at + cooldown);
    }
    context.tasks.cancelOwner(`revenant.upkeep:${facet.id}`);
  }
  emitRevenantState(context, at, "facet-consumed");
}

export function heraldFacetConsumeId(
  skill: RevenantSkill,
  activeLegendId: string,
): SkillId | undefined {
  if (skill.id === ID.FACET_OF_NATURE) {
    return (
      MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>
    )[activeLegendId];
  }
  return (
    MECHANICS.facetConsumeBySkillId as Readonly<Record<SkillId, SkillId>>
  )[skill.id];
}
