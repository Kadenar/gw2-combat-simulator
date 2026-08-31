import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/content/professions/thief/data/ids.js';
import {
  thiefEnduranceReadyAt,
  thiefInitiativeRegenerationRate
} from '#gw2/content/professions/thief/core/mechanics/initiative-and-endurance.js';
import { spearChainStageForSkill } from '#gw2/content/professions/thief/core/skills/spear-and-venoms.js';
import { storedStolenSkillChoices } from '#gw2/content/professions/thief/core/mechanics/steal.js';
import { denySkillCast as deny } from '#gw2/content/professions/lib/availability.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import type {
  ThiefCoreState,
  ThiefPrecastContext,
  ThiefSkill,
  ThiefStealthAttackChargeState
} from '#gw2/content/professions/thief/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { THIEF_BREAK_STEALTH_TASK } from '#gw2/content/professions/thief/core/mechanics/stealth.js';

function activeWeapons(context: ThiefPrecastContext): readonly [string, string] {
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const [primary, secondary] = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return [primary || '', secondary || ''];
}

function weaponFlipActive(state: ThiefCoreState, skillId: number, at: number): boolean {
  const value = state.availableFlips[skillId];
  return Number(value || 0) > at;
}

// Centralize Thief gates for initiative, endurance, stealth replacements, weapon
// sequences, spear stages, rifle stance, preparations, and stored stolen skills.
export function thiefCoreCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult {
  const state = professionCoreState(context);
  const specialization = context.state.profession.specialization;
  const specializationState = specialization.state as Partial<ThiefStealthAttackChargeState>;
  const stealthAttackState: Partial<ThiefStealthAttackChargeState> = Object.hasOwn(
    specializationState,
    'stealthAttackCharges'
  )
    ? specializationState
    : (state as ThiefCoreState & Partial<ThiefStealthAttackChargeState>);
  if (skill.id === ID.DODGE) {
    return state.endurance + Number(context.epsilon || 0.0001) >= 50
      ? { ready: true }
      : deny(skill, 'thief.endurance', 'requires 50 endurance.', thiefEnduranceReadyAt(context, 50));
  }

  if (
    skill.type === 'Weapon' &&
    skill.flipParentId != null &&
    !weaponFlipActive(state, Number(skill.id), context.start)
  ) {
    const parent = context.catalog.skillsById.get(Number(skill.flipParentId));
    return deny(
      skill,
      'thief.follow-up',
      parent?.dualWieldOpener ? 'use its opening dual-wield skill first.' : 'use its opening weapon skill first.'
    );
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
    skill.type === 'Weapon' &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    weaponFlipActive(state, Number(skill.flipSkillId), context.start)
  ) {
    return deny(skill, 'thief.follow-up-active', 'use or wait out the active follow-up skill.');
  }

  const [mainHand] = activeWeapons(context);
  const stealthed =
    state.stealthStartedAt <= context.start &&
    state.stealthUntil > context.start &&
    state.revealedUntil <= context.start;
  const bonusStealthAttack =
    Number(stealthAttackState.stealthAttackCharges || 0) > 0 &&
    Number(stealthAttackState.stealthAttackExpiresAt || 0) > context.start;
  // At a shared activation/damage timestamp, either replacement may be the causally earlier event in EVTC.
  const strikeBreakPending =
    context.tasks.nextAt(THIEF_BREAK_STEALTH_TASK) <= context.start + Number(context.epsilon || 0.0001) * 2;
  // Stealth replaces the equipped weapon's slot one, never the separate Shadow Shroud bar.
  if (skill.stealthAttack) {
    if (!stealthed && !bonusStealthAttack) {
      return deny(skill, 'thief.not-stealthed', 'requires stealth.');
    }

    if (skill.requiredMainHand && skill.requiredMainHand !== mainHand) {
      return deny(skill, 'thief.stealth-weapon', `requires ${skill.requiredMainHand}.`);
    }
  } else if (
    ((stealthed && !strikeBreakPending) || bonusStealthAttack) &&
    !skill.shadowShroudSkill &&
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
    !storedStolenSkillChoices(state).includes(skill.id)
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

  return { ready: true };
}
