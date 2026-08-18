import { professionCoreState } from '../../../platform/engine/profession.js';
import { THIEF_SKILL_IDS as ID } from '../data/ids.js';
import { thiefEnduranceReadyAt, thiefInitiativeRegenerationRate } from './resources.js';
import { spearChainStageForSkill } from './conditions.js';
import type { AvailabilityResult } from '../../../platform/engine/types.js';
import type { AntiquaryState, ThiefCoreState, ThiefPrecastContext, ThiefSkill } from '../types.js';

function deny(skill: ThiefSkill, code: string, cause: string, retryAt: number | null = null): AvailabilityResult {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`
  };
}

function activeWeapons(context: ThiefPrecastContext): readonly [string, string] {
  return context.state.activeWeaponSet === 2
    ? [context.config.weaponSet2Primary || '', context.config.weaponSet2Secondary || '']
    : [context.config.primaryWeapon || '', context.config.secondaryWeapon || ''];
}

export function thiefCoreCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult {
  const state = professionCoreState(context);
  const specialization = context.state.profession.specialization;
  const specializationState = specialization.state as Partial<AntiquaryState>;
  const stealthAttackState: Partial<AntiquaryState> = Object.hasOwn(specializationState, 'stealthAttackCharges')
    ? specializationState
    : (state as ThiefCoreState & Partial<AntiquaryState>);
  if (skill.id === ID.DODGE) {
    return state.endurance + Number(context.epsilon || 0.0001) >= 50
      ? { ready: true }
      : deny(skill, 'thief.endurance', 'requires 50 endurance.', thiefEnduranceReadyAt(context, 50));
  }
  if (skill.dualWieldFollowup && Number(state.availableFlips[skill.id] || 0) <= context.start) {
    return deny(skill, 'thief.follow-up', 'use its opening dual-wield skill first.');
  }
  const spearStage = spearChainStageForSkill(skill.id);
  if (spearStage != null && Number(state.spearChainStage || 0) !== spearStage) {
    return deny(skill, 'thief.spear-chain', `requires spear chain stage ${spearStage + 1}.`);
  }
  if (skill.id === ID.THOUSAND_NEEDLES) {
    if (!state.thousandNeedlesPrepared) {
      return deny(skill, 'thief.thousand-needles', 'prepare Thousand Needles first.');
    }
    if (Number(state.thousandNeedlesArmedAt || 0) > context.start) {
      return deny(
        skill,
        'thief.thousand-needles-arming',
        'the preparation is still arming.',
        Number(state.thousandNeedlesArmedAt)
      );
    }
  }
  if (
    skill.dualWieldOpener &&
    skill.flipSkillId != null &&
    Number(state.availableFlips[skill.flipSkillId] || 0) > context.start
  ) {
    return deny(skill, 'thief.follow-up-active', 'use or wait out the active follow-up skill.');
  }
  const [mainHand] = activeWeapons(context);
  const stealthed = state.stealthUntil > context.start && state.revealedUntil <= context.start;
  const bonusStealthAttack =
    Number(stealthAttackState.stealthAttackCharges || 0) > 0 &&
    Number(stealthAttackState.stealthAttackExpiresAt || 0) > context.start;
  if (skill.stealthAttack) {
    if (!stealthed && !bonusStealthAttack) {
      return deny(skill, 'thief.not-stealthed', 'requires stealth.');
    }
    if (skill.requiredMainHand && skill.requiredMainHand !== mainHand) {
      return deny(skill, 'thief.stealth-weapon', `requires ${skill.requiredMainHand}.`);
    }
  } else if (
    (stealthed || bonusStealthAttack) &&
    !skill.ignoresStealthWeaponReplacement &&
    skill.type === 'Weapon' &&
    skill.slot === 'Weapon_1'
  ) {
    return deny(skill, 'thief.stealth-replacement', "the active weapon's stealth attack replaces skill 1.");
  }
  if (skill.id === ID.KNEEL && state.kneeling) {
    return deny(skill, 'thief.kneeling', 'already kneeling.');
  }
  if (skill.id === ID.FREE_ACTION && !state.kneeling) {
    return deny(skill, 'thief.not-kneeling', 'kneel first.');
  }
  if (
    skill.weapon === 'Rifle' &&
    skill.id !== ID.KNEEL &&
    skill.id !== ID.FREE_ACTION &&
    !skill.stealthAttack &&
    Boolean(skill.kneelSkill) !== Boolean(state.kneeling)
  ) {
    return deny(skill, 'thief.rifle-stance', state.kneeling ? 'use a kneeling rifle skill.' : 'kneel first.');
  }
  if (
    skill.slot === 'Profession_2' &&
    (skill.categories || []).includes('stolen skill') &&
    (state.storedStolenSkillId !== skill.id || Number(state.storedStolenSkillCount || 0) <= 0)
  ) {
    return deny(skill, 'thief.stolen-skill', 'steal this skill before using it.');
  }
  if (Number(skill.initiativeCost || 0) > state.initiative + context.epsilon) {
    const missing = Number(skill.initiativeCost || 0) - Number(state.initiative || 0);
    return deny(
      skill,
      'thief.initiative',
      `requires ${skill.initiativeCost} initiative.`,
      context.start + Math.max(0, missing) / thiefInitiativeRegenerationRate(state, context)
    );
  }
  const chain = context.catalog.autoattackChainPositions.get(Number(skill.id));
  if (chain && (state.autoattackChains[chain.root] || chain.root) !== skill.id) {
    return deny(skill, 'thief.autoattack-chain', 'cast the earlier chain skill first.');
  }
  return { ready: true };
}
