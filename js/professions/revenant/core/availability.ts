import { professionCoreState } from '../../../platform/engine/profession.js';
import { isLegalRevenantLegendId } from '../legend-rules.js';
import { REVENANT_SKILL_IDS as ID } from '../data/ids.js';
import { effectiveRevenantEnergyCost, revenantEnduranceReadyAt } from './energy.js';
import type { AvailabilityResult, SkillId } from '../../../platform/engine/types.js';
import type { RevenantPrecastContext, RevenantSkill } from '../types.js';

const UPKEEP_RELEASES = new Set<SkillId>([
  ID.RELEASE_HAMMERS,
  ID.RESIST_THE_DARKNESS,
  ID.RELINQUISH_POWER,
  ID.DISMISS_LIEUTENANT_SOULCLEAVE
]);
export function denyRevenantSkill(
  skill: RevenantSkill,
  code: string,
  cause: string,
  retryAt: number | null = null
): AvailabilityResult {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`
  };
}

export function revenantCastAvailability(context: RevenantPrecastContext, skill: RevenantSkill): AvailabilityResult {
  const state = professionCoreState(context);
  const specialization = String(context.config.specialization || 'Core');
  if (skill.id === ID.ABYSSAL_FIRE) {
    return denyRevenantSkill(skill, 'revenant.abyssal-fire-hidden', 'use Abyssal Strike.');
  }
  if (skill.id === ID.UNYIELDING_IMPACT && !state.availableFlips[ID.UNYIELDING_IMPACT]) {
    return denyRevenantSkill(skill, 'revenant.unyielding-impact-inactive', 'cast Call to Anguish first.');
  }
  if (skill.id === ID.CALL_TO_ANGUISH && state.availableFlips[ID.UNYIELDING_IMPACT]) {
    return denyRevenantSkill(skill, 'revenant.unyielding-impact-ready', 'use Unyielding Impact first.');
  }
  if (skill.id === ID.TRUE_STRIKE && !state.availableFlips[ID.TRUE_STRIKE]) {
    return denyRevenantSkill(skill, 'revenant.imperial-guard-inactive', 'channel Imperial Guard first.');
  }
  if (skill.id === ID.IMPERIAL_GUARD && state.availableFlips[ID.TRUE_STRIKE]) {
    return denyRevenantSkill(skill, 'revenant.true-strike-ready', 'use or let True Strike expire first.');
  }
  const flipParent = skill.flipParentId == null ? null : context.catalog.skillsById.get(Number(skill.flipParentId));
  if (
    skill.type === 'Weapon' &&
    skill.id !== ID.TRUE_STRIKE &&
    flipParent?.flipSkillId === skill.id &&
    Number(state.availableFlips[Number(skill.id)] || 0) <= context.start
  ) {
    return denyRevenantSkill(skill, 'revenant.weapon-flip-inactive', `use ${flipParent.name} first.`);
  }
  if (
    skill.type === 'Weapon' &&
    skill.id !== ID.IMPERIAL_GUARD &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    Number(state.availableFlips[Number(skill.flipSkillId)] || 0) > context.start
  ) {
    return denyRevenantSkill(skill, 'revenant.weapon-flip-active', 'use or wait out the active follow-up skill.');
  }
  if (skill.id === -4) {
    if (
      state.selectedLegendIds.length !== 2 ||
      state.selectedLegendIds.some((legendId) => !isLegalRevenantLegendId(legendId, specialization))
    ) {
      return denyRevenantSkill(skill, 'revenant.legend-pair', 'select two legal legends.');
    }
    if (context.start < state.legendSwapReadyAt) {
      return denyRevenantSkill(
        skill,
        'revenant.legend-swap-cooldown',
        'legend swap is recharging.',
        state.legendSwapReadyAt
      );
    }
    return { ready: true };
  }
  if (skill.id === -5) {
    const cost = Math.max(0, Number(skill.resourceCost || 0));
    return state.endurance + Number(context.epsilon || 0.0001) >= cost
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
  if (skill.specialization && skill.type !== 'Weapon' && skill.specialization !== specialization) {
    return denyRevenantSkill(skill, 'revenant.wrong-specialization', `requires ${skill.specialization}.`);
  }
  if (skill.consume && !state.availableFlips[skill.id]) {
    return denyRevenantSkill(skill, 'revenant.facet-inactive', 'activate the matching facet first.');
  }
  if (UPKEEP_RELEASES.has(skill.id) && !state.availableFlips[skill.id]) {
    return denyRevenantSkill(skill, 'revenant.upkeep-inactive', 'activate the matching upkeep skill first.');
  }
  if (
    skill.handlerId === 'revenant.upkeep' &&
    !skill.facet &&
    state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)
  ) {
    return denyRevenantSkill(skill, 'revenant.upkeep-active', 'use the matching release skill.');
  }
  if (skill.facet && state.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id)) {
    return denyRevenantSkill(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');
  }
  const cost = effectiveRevenantEnergyCost(context, skill);
  if (state.energy + context.epsilon < cost) {
    const cooldownReadyAt = Number(context.state.cooldowns.get(skill.id) || 0);
    return denyRevenantSkill(
      skill,
      'revenant.insufficient-energy',
      `requires ${cost} energy.`,
      cooldownReadyAt > context.start + context.epsilon ? cooldownReadyAt : null
    );
  }
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain && (state.autoattackChains[chain.root] || chain.root) !== skill.id) {
    return denyRevenantSkill(skill, 'revenant.autoattack-chain', 'cast the earlier chain skill first.');
  }
  return { ready: true };
}
