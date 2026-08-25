import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { CAST_READY } from '../../../platform/engine/skills/availability.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { denySkillCast } from '../../lib/availability.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../data/ids.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { GuardianAvailabilityContext, GuardianPrecastContext, GuardianSkill } from '../types.js';

export function selectedGuardianSpecialization(context: GuardianAvailabilityContext = {}): string {
  const config = context.config || context;
  if (typeof config.specialization === 'string') {
    return config.specialization;
  }

  return (
    (config.specializations || [])
      .map((value) => (typeof value === 'string' ? value : value?.name))
      .find((name) =>
        context.catalog?.specializations?.some((specialization) => specialization.elite && specialization.name === name)
      ) || ''
  );
}

/**
 * Permanent build gating. These decisions cannot change while a rotation is
 * running, so they deny the current command without advertising a retry time.
 */
export function guardianBuildAvailability(
  context: GuardianAvailabilityContext,
  skill: GuardianSkill
): Readonly<AvailabilityResult> {
  if (!skill.implemented)
    return denySkillCast(skill, 'guardian.not-implemented', 'it is not implemented by the simulator.');
  const specialization = selectedGuardianSpecialization(context) || 'Core';
  if (skill.type !== 'Weapon' && skill.specialization && specialization !== skill.specialization) {
    return denySkillCast(skill, 'guardian.specialization', `requires the ${skill.specialization} specialization.`);
  }

  if (skill.id === GUARDIAN_SKILL_IDS.MIGHTY_BLOW) {
    return hasTrait(context, GUARDIAN_TRAIT_IDS.GLACIAL_HEART)
      ? denySkillCast(skill, 'guardian.trait-replacement', 'Glacial Blow replaces it while Glacial Heart is selected.')
      : CAST_READY;
  }

  if (skill.id === GUARDIAN_SKILL_IDS.GLACIAL_BLOW) {
    return hasTrait(context, GUARDIAN_TRAIT_IDS.GLACIAL_HEART)
      ? CAST_READY
      : denySkillCast(skill, 'guardian.trait-replacement', 'requires the Glacial Heart trait.');
  }

  return CAST_READY;
}

/**
 * Runtime Guardian state gates. Generic cooldown and ammo readiness remains
 * scheduler-owned; active specializations contribute their resource gates.
 */
export function guardianCastAvailability(
  context: GuardianPrecastContext,
  skill: GuardianSkill
): Readonly<AvailabilityResult> {
  const state = professionCoreState(context);
  if (
    skill.id === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME &&
    Number(state.availableFlips[GUARDIAN_SKILL_IDS.ZEALOTS_FIRE] || 0) > context.start + context.epsilon
  ) {
    return denySkillCast(skill, 'guardian.flip-parent-active', 'use the active flip skill first.');
  }

  if (skill.flipParentId != null) {
    // Active specializations can own persistent or resource-driven flips whose
    // retry semantics cannot be represented by Core's short-lived flip window.
    if (skill.tags?.includes('specialization-managed-flip')) return CAST_READY;
    return Number(state.availableFlips[skill.id] || 0) > context.start + context.epsilon
      ? CAST_READY
      : denySkillCast(skill, 'guardian.flip-not-armed', 'not currently armed.');
  }

  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (!chain) return CAST_READY;
  const expected = state.autoattackChains[chain.root] || chain.root;
  if (expected === skill.id) return CAST_READY;
  const expectedSkill = context.catalog.skillsById.get(expected);
  return denySkillCast(
    skill,
    'guardian.autoattack-chain',
    `cast ${expectedSkill?.name || 'the earlier chain skill'} first.`
  );
}
