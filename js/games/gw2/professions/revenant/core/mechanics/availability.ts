import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { isLegalRevenantLegendId } from '#gw2/professions/revenant/data/legends.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { revenantEnduranceReadyAt, revenantEnergyReadyAt } from '#gw2/professions/revenant/core/mechanics/energy.js';
import { runtimeRevenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { denySkillCast as denyRevenantSkill } from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { RevenantPrecastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

// Centralize Revenant cast gates for legends, energy, endurance, upkeeps, timed
// flips, and specialization ownership; shared GW2 code owns chain progression.
export function revenantCastAvailability(context: RevenantPrecastContext, skill: RevenantSkill): AvailabilityResult {
  const state = professionCoreState(context);
  const specialization = String(context.config.specialization || 'Core');
  if (skill.id === ID.UNYIELDING_IMPACT && !skillFlipReady(state.availableFlips[ID.UNYIELDING_IMPACT], context.start)) {
    return denyRevenantSkill(skill, 'revenant.unyielding-impact-inactive', 'cast Call to Anguish first.');
  }

  if (skill.id === ID.CALL_TO_ANGUISH && skillFlipReady(state.availableFlips[ID.UNYIELDING_IMPACT], context.start)) {
    return denyRevenantSkill(skill, 'revenant.unyielding-impact-ready', 'use Unyielding Impact first.');
  }

  if (skill.id === ID.TRUE_STRIKE && !skillFlipReady(state.availableFlips[ID.TRUE_STRIKE], context.start)) {
    return denyRevenantSkill(skill, 'revenant.imperial-guard-inactive', 'channel Imperial Guard first.');
  }

  if (skill.id === ID.IMPERIAL_GUARD && skillFlipReady(state.availableFlips[ID.TRUE_STRIKE], context.start)) {
    return denyRevenantSkill(skill, 'revenant.true-strike-ready', 'use or let True Strike expire first.');
  }

  const flipParent = skill.flipParentId == null ? null : context.catalog.skillsById.get(Number(skill.flipParentId));
  if (
    skill.type === 'Weapon' &&
    skill.id !== ID.TRUE_STRIKE &&
    flipParent?.flipSkillId === skill.id &&
    !skillFlipReady(state.availableFlips[Number(skill.id)], context.start)
  ) {
    return denyRevenantSkill(skill, 'revenant.weapon-flip-inactive', `use ${flipParent.name} first.`);
  }

  if (
    skill.type === 'Weapon' &&
    skill.id !== ID.IMPERIAL_GUARD &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    skillFlipReady(state.availableFlips[Number(skill.flipSkillId)], context.start)
  ) {
    return denyRevenantSkill(skill, 'revenant.weapon-flip-active', 'use or wait out the active follow-up skill.');
  }

  if (skill.id === ID.SWAP_LEGENDS) {
    if (
      state.selectedLegendIds.length !== 2 ||
      state.selectedLegendIds.some((legendId) => !isLegalRevenantLegendId(legendId, specialization))
    ) {
      return denyRevenantSkill(skill, 'revenant.legend-pair', 'select two legal legends.');
    }

    // The shared scheduler gates recharge, including changes from temporary Alacrity.
    return { ready: true };
  }

  if (skill.handlerId === 'revenant.dodge' || skill.handlerId === 'revenant.vindicator-jump') {
    const cost = Math.max(0, Number(skill.resourceCost || 0));
    return state.endurance + EPSILON >= cost
      ? { ready: true }
      : denyRevenantSkill(
          skill,
          'revenant.insufficient-endurance',
          `requires ${cost} endurance.`,
          revenantEnduranceReadyAt(context, cost)
        );
  }

  if (skill.legendId && skill.legendId !== state.activeLegendId) {
    return denyRevenantSkill(skill, 'revenant.inactive-legend', 'invoke the matching legend first.');
  }

  if (skill.handlerId === 'revenant.upkeep-release' && !skillFlipReady(state.availableFlips[skill.id], context.start)) {
    return denyRevenantSkill(skill, 'revenant.upkeep-inactive', 'activate the matching upkeep skill first.');
  }

  if (skill.handlerId === 'revenant.upkeep' && state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)) {
    return denyRevenantSkill(skill, 'revenant.upkeep-active', 'use the matching release skill.');
  }

  const cost = runtimeRevenantEnergyCost(context, skill);
  const energyReadyAt = revenantEnergyReadyAt(context, cost);
  // A fractional balance can cross a cost between action ticks; wait until the shared grid permits spending it.
  if (state.energy + EPSILON < cost || (energyReadyAt != null && energyReadyAt > context.start + EPSILON)) {
    const cooldownReadyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    return denyRevenantSkill(
      skill,
      'revenant.insufficient-energy',
      `requires ${cost} energy.`,
      cooldownReadyAt > context.start + EPSILON ? cooldownReadyAt : energyReadyAt
    );
  }

  return { ready: true };
}
