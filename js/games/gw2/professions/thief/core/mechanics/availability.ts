import { skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import {
  thiefEnduranceReadyAt,
  thiefInitiativeRegenerationRate
} from '#gw2/professions/thief/core/mechanics/resources.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import { thiefTrapCastAvailability } from '#gw2/professions/thief/core/mechanics/preparations.js';
import { storedStolenSkillChoices } from '#gw2/professions/thief/core/mechanics/steal.js';
import { denySkillCast as deny, selectedSlotSkillAvailability } from '#gw2/professions/shared/availability.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { ThiefPrecastContext, ThiefSkill } from '#gw2/professions/thief/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { thiefStealthAttackChargeState } from '#gw2/professions/thief/core/mechanics/stealth.js';

function activeWeapons(context: ThiefPrecastContext): readonly [string, string] {
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const [primary, secondary] = gw2ConfiguredWeaponSet(context.config, weaponSet);
  return [primary || '', secondary || ''];
}

// Centralize Thief gates for initiative, endurance, stealth replacements, weapon
// sequences, spear stages, rifle stance, preparations, and stored stolen skills.
export function thiefCoreCastAvailability(context: ThiefPrecastContext, skill: ThiefSkill): AvailabilityResult {
  const selection = selectedSlotSkillAvailability(context, skill);
  if (selection) return selection;
  const state = professionCoreState(context);
  const stealthAttackState = thiefStealthAttackChargeState(context);
  if (skill.id === ID.DODGE) {
    return state.endurance + EPSILON >= 50
      ? { ready: true }
      : deny(skill, 'thief.endurance', 'requires 50 endurance.', thiefEnduranceReadyAt(context, 50));
  }

  if (
    skill.type === 'Weapon' &&
    skill.flipParentId != null &&
    !skillFlipReady(state.availableFlips[skill.id], context.start)
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

  const trapAvailability = thiefTrapCastAvailability(context, skill);
  if (trapAvailability) return trapAvailability;

  if (
    skill.type === 'Weapon' &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId &&
    skillFlipReady(state.availableFlips[skill.flipSkillId], context.start)
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
  // A same-time action may precede the strike transition; let one stealth attack claim the consumed window.
  const sameTimeStrikeBreak =
    !context.events.some(
      (event) =>
        event.type === 'action' &&
        event.at === context.start &&
        event.skillId != null &&
        context.catalog.skillsById.get(event.skillId)?.stealthAttack
    ) &&
    context.events.some(
      (event) => event.type === 'thief.state' && event.reason === 'strike-broke-stealth' && event.at === context.start
    );
  // Stealth replaces the equipped weapon's slot one, never the separate Shadow Shroud bar.
  if (skill.stealthAttack) {
    if (!stealthed && !bonusStealthAttack && !sameTimeStrikeBreak) {
      return deny(skill, 'thief.not-stealthed', 'requires stealth.');
    }

    if (skill.requiredMainHand && skill.requiredMainHand !== mainHand) {
      return deny(skill, 'thief.stealth-weapon', `requires ${skill.requiredMainHand}.`);
    }
  } else if (
    (stealthed || bonusStealthAttack) &&
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

  if (Number(skill.initiativeCost || 0) > state.initiative + EPSILON) {
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
