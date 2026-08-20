import { professionCoreState } from '../../../../platform/engine/profession.js';
import { emitRevenantBoon } from '../../core/boons.js';
import { emitRevenantState } from '../../core/shared.js';
import { REVENANT_SKILL_IDS as ID } from '../../data/ids.js';
import { HERALD_MECHANICS as MECHANICS } from './mechanics.js';
import type { SchedulerRecord, SkillId } from '../../../../platform/engine/types.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill
} from '../../types.js';

interface HeraldFacetPulsePayload extends SchedulerRecord {
  readonly skillId: SkillId;
}

/** Removes the active facet and consumes its temporary flip. */
export function consumeRevenantFacet(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  // Use cast completion time so cooldowns start after the animation finishes, consistent with other skills.
  const at = context.effectiveEnd;
  const facetByConsume = MECHANICS.facetSkillByConsumeId as Readonly<Record<SkillId, SkillId>>;
  const facetId = facetByConsume[skill.id];
  const facet = facetId == null ? undefined : context.catalog.skillsById.get(facetId);
  state.activeUpkeeps = state.activeUpkeeps.filter((upkeep) => upkeep.skillId !== facet?.id);
  // Remove the consume flip itself from availableFlips so it can't be cast a second time.
  delete state.availableFlips[skill.id];
  if (facet) {
    // The cooldown is placed on the parent facet, not the consume skill, so the facet can't be re-activated immediately.
    const cooldown = Math.max(0, Number(context.rechargeDuration || 0));
    if (cooldown > 0) {
      context.state.cooldowns.set(facet.id, at + cooldown);
    }

    // Cancel the recurring upkeep-pulse task; without this the pulse loop would continue firing after the facet is gone.
    context.tasks.cancelOwner(`revenant.upkeep:${facet.id}`);
  }

  emitRevenantState(context, at, 'facet-consumed');
}

export function heraldFacetConsumeId(skill: RevenantSkill, activeLegendId: string): SkillId | undefined {
  if (skill.id === ID.FACET_OF_NATURE) {
    return (MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>)[activeLegendId];
  }

  return (MECHANICS.facetConsumeBySkillId as Readonly<Record<SkillId, SkillId>>)[skill.id];
}

/** Arms the consume flip and transfers recurring boon pulses to Herald's scheduler task. */
export function afterHeraldFacetCast(context: RevenantCastContext, skill: RevenantSkill): void {
  if (!skill.facet) return;
  const state = professionCoreState(context);
  const active = state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id);
  if (!active) return;
  const consumeId = heraldFacetConsumeId(skill, state.activeLegendId);
  if (consumeId != null) state.availableFlips[consumeId] = true;
  context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
  if (!skill.upkeepPulse) return;
  context.tasks.schedule({
    type: 'revenant.herald-facet-pulse',
    at: context.effectiveEnd + Math.max(0, Number(skill.pulseInterval ?? 3)),
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id }
  });
}

/** Emits one Herald facet boon pulse and keeps its specialization-owned cadence running. */
export function handleHeraldFacetPulse(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<HeraldFacetPulsePayload>
): void {
  const skillId = task.payload?.skillId;
  if (skillId == null || !professionCoreState(context).activeUpkeeps.some((upkeep) => upkeep.skillId === skillId)) {
    return;
  }

  const skill = context.catalog.skillsById.get(skillId);
  const pulse = skill?.upkeepPulse as
    { readonly kind: string; readonly duration: number; readonly stacks: number } | undefined;
  if (!skill || !pulse) return;
  emitRevenantBoon(context, skill, pulse.kind, pulse.duration, pulse.stacks, { at: task.at });
  context.tasks.schedule({
    type: 'revenant.herald-facet-pulse',
    at: task.at + Math.max(0, Number(skill.pulseInterval ?? 3)),
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId }
  });
}
